package middleware

import (
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/session"
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

// NewRateLimiter creates a RateLimiter and starts a background cleanup goroutine.
func NewRateLimiter(r rate.Limit, b int) *RateLimiter {
	rl := &RateLimiter{
		entries: make(map[string]*entry),
		r:       r,
		b:       b,
	}
	go rl.cleanup()
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

func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		rl.cleanupOlderThan(10 * time.Minute)
	}
}

// RateLimit returns chi-compatible middleware that limits requests by key.
// Returns 429 Too Many Requests when the limit is exceeded.
func RateLimit(rl *RateLimiter, keyFn func(*http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !rl.getLimiter(keyFn(r)).Allow() {
				w.Header().Set("Retry-After", "60")
				http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// IPKey extracts the client IP from RemoteAddr (port stripped).
func IPKey(r *http.Request) string {
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// UserIDKey returns a key function that uses the authenticated user ID,
// falling back to IP for unauthenticated requests.
func UserIDKey(sm *session.Manager) func(*http.Request) string {
	return func(r *http.Request) string {
		userID, ok := sm.GetUserID(r)
		if !ok {
			return IPKey(r)
		}
		return fmt.Sprintf("user:%d", userID)
	}
}
