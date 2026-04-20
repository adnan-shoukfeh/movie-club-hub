package service

import (
	"context"
	"errors"
	"testing"
)

func TestSanitizeUsername(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"Alice", "alice"},
		{"  bob  ", "bob"},
		{"UPPERCASE", "uppercase"},
		{"a_long_username_that_exceeds_thirty_two_characters", "a_long_username_that_exceeds_thi"},
		{"", ""},
		{"  ", ""},
	}
	for _, tt := range tests {
		got := sanitizeUsername(tt.input)
		if got != tt.want {
			t.Errorf("sanitizeUsername(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestIsValidUsername(t *testing.T) {
	valid := []string{"alice", "bob_42", "ab", "a_b_c", "username32characters12345678901"}
	for _, u := range valid {
		if !isValidUsername(u) {
			t.Errorf("isValidUsername(%q) = false, want true", u)
		}
	}

	invalid := []string{"", "a", "has space", "UPPER", "special!", "toolongusernamethatexceedsthirtytwocharacters"}
	for _, u := range invalid {
		if isValidUsername(u) {
			t.Errorf("isValidUsername(%q) = true, want false", u)
		}
	}
}

// TestAuthService_ValidationErrors tests that validation errors are returned
// before any DB access, allowing these paths to be tested without a database.
func TestAuthService_ValidationErrors(t *testing.T) {
	svc := &AuthService{queries: nil, config: Config{}}
	ctx := context.Background()

	t.Run("register invalid username", func(t *testing.T) {
		_, err := svc.RegisterUser(ctx, "A!", "password123")
		if !errors.Is(err, ErrInvalidUsername) {
			t.Errorf("got %v, want ErrInvalidUsername", err)
		}
	})

	t.Run("register weak password", func(t *testing.T) {
		_, err := svc.RegisterUser(ctx, "validuser", "short")
		if !errors.Is(err, ErrWeakPassword) {
			t.Errorf("got %v, want ErrWeakPassword", err)
		}
	})

	t.Run("update username invalid", func(t *testing.T) {
		_, err := svc.UpdateUsername(ctx, 1, "BAD NAME!")
		if !errors.Is(err, ErrInvalidUsername) {
			t.Errorf("got %v, want ErrInvalidUsername", err)
		}
	})

	t.Run("update password too short", func(t *testing.T) {
		err := svc.UpdatePassword(ctx, 1, "current", "short")
		if !errors.Is(err, ErrWeakPassword) {
			t.Errorf("got %v, want ErrWeakPassword", err)
		}
	})
}
