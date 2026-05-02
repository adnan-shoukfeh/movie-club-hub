package handler

import (
	"strings"
	"testing"
)

func TestSanitizeFeedback(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"trims whitespace", "  hello  ", "hello"},
		{"strips control chars except whitespace", "ab\x00c\x07d\nE", "abcd\nE"},
		{"keeps newlines and tabs", "line1\nline2\tindented", "line1\nline2\tindented"},
		{"empty string passes through", "", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizeFeedback(tt.in)
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestSanitizeFeedback_TruncatesAt5000(t *testing.T) {
	in := strings.Repeat("a", 6000)
	got := sanitizeFeedback(in)
	if len(got) != 5000 {
		t.Errorf("got len %d, want 5000", len(got))
	}
}
