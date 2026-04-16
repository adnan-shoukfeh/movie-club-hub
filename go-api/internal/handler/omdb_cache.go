package handler

import (
	"sync"
	"time"
)

type omdbCacheEntry struct {
	body      []byte
	expiresAt time.Time
}

// omdbCache is a simple in-memory cache for OMDB API responses.
// Search results are cached for a shorter duration than detail lookups,
// since movie metadata (poster, director, etc.) is effectively immutable.
type omdbCache struct {
	mu      sync.Mutex
	entries map[string]omdbCacheEntry
}

func newOMDBCache() *omdbCache {
	return &omdbCache{entries: make(map[string]omdbCacheEntry)}
}

func (c *omdbCache) get(key string) ([]byte, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[key]
	if !ok || time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e.body, true
}

func (c *omdbCache) set(key string, body []byte, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = omdbCacheEntry{body: body, expiresAt: time.Now().Add(ttl)}
}
