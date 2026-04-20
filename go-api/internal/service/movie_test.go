package service

import (
	"context"
	"testing"
)

func TestIsImdbID(t *testing.T) {
	valid := []string{"tt1234567", "tt12345678", "TT1234567"}
	for _, id := range valid {
		if !isImdbID(id) {
			t.Errorf("isImdbID(%q) = false, want true", id)
		}
	}
	invalid := []string{"", "tt123456", "nm1234567", "1234567", "tt123456789"}
	for _, id := range invalid {
		if isImdbID(id) {
			t.Errorf("isImdbID(%q) = true, want false", id)
		}
	}
}

func TestFilterNA(t *testing.T) {
	if filterNA("") != nil {
		t.Error("filterNA('') should return nil")
	}
	if filterNA("N/A") != nil {
		t.Error("filterNA('N/A') should return nil")
	}
	got := filterNA("hello")
	if got == nil || *got != "hello" {
		t.Errorf("filterNA('hello') = %v, want 'hello'", got)
	}
}

func TestSanitizeReview(t *testing.T) {
	got := sanitizeReview("  great film  ")
	if got != "great film" {
		t.Errorf("got %q", got)
	}
	long := make([]byte, 3000)
	for i := range long {
		long[i] = 'a'
	}
	truncated := sanitizeReview(string(long))
	if len(truncated) != 2000 {
		t.Errorf("got len %d, want 2000", len(truncated))
	}
}

func TestSanitizeMovieTitle(t *testing.T) {
	long := make([]byte, 300)
	for i := range long {
		long[i] = 'x'
	}
	truncated := sanitizeMovieTitle(string(long))
	if len(truncated) != 200 {
		t.Errorf("got len %d, want 200", len(truncated))
	}
}

func TestMovieService_SearchNoKey(t *testing.T) {
	svc := &MovieService{queries: nil, config: Config{OmdbAPIKey: ""}}
	_, err := svc.Search(context.Background(), "inception")
	if err == nil {
		t.Error("expected error for missing OMDB key")
	}
}

func TestMovieService_SearchShortQuery(t *testing.T) {
	// Short query (< 2 chars) returns empty results without hitting OMDB.
	svc := &MovieService{queries: nil, config: Config{OmdbAPIKey: "fake-key"}}
	results, err := svc.Search(context.Background(), "a")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected empty results for short query, got %d", len(results))
	}
}

func TestNewMovieService(t *testing.T) {
	svc := NewMovieService(nil, Config{OmdbAPIKey: "key"})
	if svc == nil {
		t.Error("NewMovieService returned nil")
	}
}

func TestSanitizeImdbID(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"tt1234567", "tt1234567"},
		{"  tt1234567  ", "tt1234567"},
		{"tt1234567!", "tt1234567"},
		{"tt-1234-567", "tt1234567"},
		{"tt123456789012345678XX", "tt123456789012345678"},
		{"", ""},
		{"!@#$%^", ""},
	}
	for _, tt := range tests {
		got := sanitizeImdbID(tt.input)
		if got != tt.want {
			t.Errorf("sanitizeImdbID(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
