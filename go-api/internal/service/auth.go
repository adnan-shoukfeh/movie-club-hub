package service

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

var (
	ErrUsernameTaken      = errors.New("username is already taken")
	ErrInvalidUsername    = errors.New("username must be 2-32 characters, alphanumeric and underscores only")
	ErrWeakPassword       = errors.New("password must be at least 8 characters")
	ErrInvalidCredentials = errors.New("invalid username or password")
	ErrNotFound           = errors.New("not found")
	ErrForbidden          = errors.New("forbidden")
)

var usernameRegex = regexp.MustCompile(`^[a-z0-9_]{2,32}$`)

func sanitizeUsername(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	if len(s) > 32 {
		s = s[:32]
	}
	return s
}

func isValidUsername(username string) bool {
	return usernameRegex.MatchString(username)
}

// AuthService handles user authentication and account management.
type AuthService struct {
	queries *db.Queries
	config  Config
}

// NewAuthService creates a new AuthService.
func NewAuthService(q *db.Queries, cfg Config) *AuthService {
	return &AuthService{queries: q, config: cfg}
}

// RegisterUser validates, hashes password, and creates user. Returns created user.
// Errors: ErrUsernameTaken, ErrInvalidUsername, ErrWeakPassword, wrapped DB errors.
func (s *AuthService) RegisterUser(ctx context.Context, username, password string) (db.User, error) {
	username = sanitizeUsername(username)
	if !isValidUsername(username) {
		return db.User{}, ErrInvalidUsername
	}
	if len(password) < 8 {
		return db.User{}, ErrWeakPassword
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return db.User{}, err
	}

	// Check if user exists without password (created via some other flow)
	existing, err := s.queries.GetUserByUsername(ctx, username)
	if err == nil && existing.PasswordHash == nil {
		hashStr := string(hash)
		if err := s.queries.UpdateUserPasswordHash(ctx, db.UpdateUserPasswordHashParams{
			Username:     username,
			PasswordHash: &hashStr,
		}); err != nil {
			return db.User{}, err
		}
		// Fetch and return the updated user
		return s.queries.GetUserByUsername(ctx, username)
	} else if err == nil {
		return db.User{}, ErrUsernameTaken
	}

	hashStr := string(hash)
	row, err := s.queries.CreateUser(ctx, db.CreateUserParams{
		Username:     username,
		PasswordHash: &hashStr,
	})
	if err != nil {
		return db.User{}, ErrUsernameTaken
	}

	return db.User{
		ID:        row.ID,
		Username:  row.Username,
		CreatedAt: row.CreatedAt,
	}, nil
}

// Login validates credentials and returns the user.
// Errors: ErrInvalidCredentials on bad username/password.
func (s *AuthService) Login(ctx context.Context, username, password string) (db.User, error) {
	username = sanitizeUsername(username)
	user, err := s.queries.GetUserByUsername(ctx, username)
	if err != nil {
		return db.User{}, ErrInvalidCredentials
	}

	if user.PasswordHash == nil {
		return db.User{}, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)); err != nil {
		return db.User{}, ErrInvalidCredentials
	}

	return user, nil
}

// UpdatePassword verifies current password and sets new one.
// Errors: ErrInvalidCredentials, ErrWeakPassword.
func (s *AuthService) UpdatePassword(ctx context.Context, userID int32, currentPassword, newPassword string) error {
	if len(newPassword) < 8 {
		return ErrWeakPassword
	}

	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	if user.PasswordHash == nil {
		return ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(currentPassword)); err != nil {
		return ErrInvalidCredentials
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return err
	}

	hashStr := string(hash)
	return s.queries.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{
		PasswordHash: &hashStr,
		ID:           userID,
	})
}

// UpdateUsername checks uniqueness and updates username.
// Errors: ErrUsernameTaken, ErrInvalidUsername.
func (s *AuthService) UpdateUsername(ctx context.Context, userID int32, newUsername string) (db.User, error) {
	newUsername = sanitizeUsername(newUsername)
	if !isValidUsername(newUsername) {
		return db.User{}, ErrInvalidUsername
	}

	// Check uniqueness — allow same username (user keeping their name)
	existing, err := s.queries.GetUserByUsername(ctx, newUsername)
	if err == nil && existing.ID != userID {
		return db.User{}, ErrUsernameTaken
	}

	if err := s.queries.UpdateUsername(ctx, db.UpdateUsernameParams{
		Username: newUsername,
		ID:       userID,
	}); err != nil {
		return db.User{}, err
	}

	return s.queries.GetUserByID(ctx, userID)
}
