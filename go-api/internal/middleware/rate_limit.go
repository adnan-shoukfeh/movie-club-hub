package middleware

import (
	"context"
	"fmt"
	"math"
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/session"
)

const (
	cleanupInterval = 5 * time.Minute
	entryMaxAge     = 10 * time.Minute
)

type entry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// RateLimiter tracks per-key token bucket limiters with periodic cleanup.
type RateLimiter struct {
	mu      sync.Mutex
	entries map[string]*entry
	r       rate.Limit
	b       int
}

// NewRateLimiter creates a RateLimiter and starts a background cleanup goroutine
// that runs until ctx is cancelled.
func NewRateLimiter(ctx context.Context, r rate.Limit, b int) *RateLimiter {
	rl := &RateLimiter{
		entries: make(map[string]*entry),
		r:       r,
		b:       b,
	}
	go rl.cleanup(ctx)
	return rl
}

func (rl *RateLimiter) getLimiter(key string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	e, ok := rl.entries[key]
	if !ok {
		e = &entry{limiter: rate.NewLimiter(rl.r, rl.b)}
		rl.entries[key] = e
	}
	e.lastSeen = time.Now()
	return e.limiter
}

func (rl *RateLimiter) cleanupOlderThan(age time.Duration) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	for key, e := range rl.entries {
		if time.Since(e.lastSeen) > age {
			delete(rl.entries, key)
		}
	}
}

func (rl *RateLimiter) cleanup(ctx context.Context) {
	ticker := time.NewTicker(cleanupInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			rl.cleanupOlderThan(entryMaxAge)
		}
	}
}

// RateLimit returns chi-compatible middleware that limits requests by key.
// Returns 429 Too Many Requests when the limit is exceeded; Retry-After reflects
// the actual time until the next token is available.
func RateLimit(rl *RateLimiter, keyFn func(*http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reservation := rl.getLimiter(keyFn(r)).Reserve()
			if delay := reservation.Delay(); delay > 0 {
				reservation.Cancel()
				retrySeconds := min(int(math.Ceil(delay.Seconds())), 3600)
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", strconv.Itoa(retrySeconds))
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"rate limit exceeded"}`)) //nolint:errcheck
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// IPKey extracts the client IP from RemoteAddr (port stripped).
// Relies on chimw.RealIP having already rewritten RemoteAddr from X-Forwarded-For.
// This is trustworthy behind Cloud Run's load balancer; do not use in a non-proxied environment.
func IPKey(r *http.Request) string {
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// UserIDKeyFunc returns a key function that uses the authenticated user ID,
// falling back to IP for unauthenticated requests.
func UserIDKeyFunc(sm *session.Manager) func(*http.Request) string {
	return func(r *http.Request) string {
		userID, ok := sm.GetUserID(r)
		if !ok {
			return IPKey(r)
		}
		return fmt.Sprintf("user:%d", userID)
	}
}
