package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"golang.org/x/time/rate"
)

var okHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
})

func makeRequest(ip string) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = ip
	return r
}

func TestRateLimit_AllowsRequestsWithinBurst(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	rl := NewRateLimiter(ctx, rate.Every(time.Hour), 3)
	handler := RateLimit(rl, IPKey)(okHandler)

	for i := range 3 {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, makeRequest("10.0.0.1:1234"))
		if w.Code != http.StatusOK {
			t.Errorf("request %d: got status %d, want %d", i+1, w.Code, http.StatusOK)
		}
	}
}

func TestRateLimit_BlocksRequestsExceedingBurst(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	rl := NewRateLimiter(ctx, rate.Every(time.Hour), 2)
	handler := RateLimit(rl, IPKey)(okHandler)

	for i := range 2 {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, makeRequest("10.0.0.1:1234"))
		if w.Code != http.StatusOK {
			t.Errorf("request %d: got status %d, want %d", i+1, w.Code, http.StatusOK)
		}
	}

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, makeRequest("10.0.0.1:1234"))
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("request 3: got status %d, want %d", w.Code, http.StatusTooManyRequests)
	}
}

func TestRateLimit_TracksKeysSeparately(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	rl := NewRateLimiter(ctx, rate.Every(time.Hour), 1)
	handler := RateLimit(rl, IPKey)(okHandler)

	// First request from 10.0.0.1 — should pass.
	w1 := httptest.NewRecorder()
	handler.ServeHTTP(w1, makeRequest("10.0.0.1:1234"))
	if w1.Code != http.StatusOK {
		t.Errorf("10.0.0.1 first request: got %d, want %d", w1.Code, http.StatusOK)
	}

	// First request from 10.0.0.2 — independent limiter, should pass.
	w2 := httptest.NewRecorder()
	handler.ServeHTTP(w2, makeRequest("10.0.0.2:1234"))
	if w2.Code != http.StatusOK {
		t.Errorf("10.0.0.2 first request: got %d, want %d", w2.Code, http.StatusOK)
	}

	// Second request from 10.0.0.1 — burst exhausted, should be blocked.
	w3 := httptest.NewRecorder()
	handler.ServeHTTP(w3, makeRequest("10.0.0.1:1234"))
	if w3.Code != http.StatusTooManyRequests {
		t.Errorf("10.0.0.1 second request: got %d, want %d", w3.Code, http.StatusTooManyRequests)
	}
}

func TestRateLimit_SetsRetryAfterHeader(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	rl := NewRateLimiter(ctx, rate.Every(time.Hour), 1)
	handler := RateLimit(rl, IPKey)(okHandler)

	// Consume the single burst token.
	w1 := httptest.NewRecorder()
	handler.ServeHTTP(w1, makeRequest("10.0.0.1:1234"))
	if w1.Code != http.StatusOK {
		t.Fatalf("first request: got %d, want %d", w1.Code, http.StatusOK)
	}

	// Second request should be rejected with Retry-After set.
	w2 := httptest.NewRecorder()
	handler.ServeHTTP(w2, makeRequest("10.0.0.1:1234"))
	if w2.Code != http.StatusTooManyRequests {
		t.Fatalf("second request: got %d, want %d", w2.Code, http.StatusTooManyRequests)
	}

	retryAfter := w2.Header().Get("Retry-After")
	if retryAfter == "" {
		t.Fatal("Retry-After header is missing on 429 response")
	}
	val, err := strconv.Atoi(retryAfter)
	if err != nil {
		t.Errorf("Retry-After header is not a valid integer: %q", retryAfter)
	}
	if val <= 0 || val > 3600 {
		t.Errorf("Retry-After value out of expected range [1, 3600]: got %d", val)
	}
}

func TestRateLimiter_CleanupRemovesStaleEntries(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	rl := NewRateLimiter(ctx, rate.Every(time.Second), 10)
	handler := RateLimit(rl, IPKey)(okHandler)

	req := makeRequest("10.0.0.1:1234")

	// Trigger entry creation.
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	// Mark the entry as stale by backdating lastSeen.
	rl.mu.Lock()
	key := IPKey(req)
	if e, ok := rl.entries[key]; ok {
		e.lastSeen = time.Now().Add(-11 * time.Minute)
	} else {
		rl.mu.Unlock()
		t.Fatalf("entry for key %q was not created", key)
	}
	rl.mu.Unlock()

	// Add a fresh entry that should survive cleanup.
	req2 := makeRequest("10.0.0.2:1234")
	rl.getLimiter(IPKey(req2))

	rl.cleanupOlderThan(10 * time.Minute)

	rl.mu.Lock()
	remaining := len(rl.entries)
	rl.mu.Unlock()

	if remaining != 1 {
		t.Errorf("expected 1 entry after cleanup (fresh entry preserved), got %d", remaining)
	}
}
