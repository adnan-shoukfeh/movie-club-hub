package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
)

// GroupService handles group creation and management.
type GroupService struct {
	queries *db.Queries
	config  Config
}

// NewGroupService creates a new GroupService.
func NewGroupService(q *db.Queries, cfg Config) *GroupService {
	return &GroupService{queries: q, config: cfg}
}

// Create creates a new group and adds the creator as owner.
func (s *GroupService) Create(ctx context.Context, ownerID int32, name string, startDate string, turnLengthDays int32) (db.Group, error) {
	name = sanitizeGroupName(name)
	if name == "" {
		return db.Group{}, errors.New("group name is required")
	}

	if turnLengthDays < 1 || turnLengthDays > 365 {
		return db.Group{}, errors.New("turnLengthDays must be between 1 and 365")
	}

	var start time.Time
	if startDate != "" {
		if !isValidDateStr(startDate) {
			return db.Group{}, errors.New("startDate must be a YYYY-MM-DD date string")
		}
		parsed, _ := time.Parse("2006-01-02", startDate)
		start = parsed
	} else {
		start = time.Now().UTC()
	}

	pgStart := pgtype.Date{Time: start, Valid: true}

	group, err := s.queries.CreateGroup(ctx, db.CreateGroupParams{
		Name:           name,
		OwnerID:        ownerID,
		StartDate:      pgStart,
		TurnLengthDays: turnLengthDays,
	})
	if err != nil {
		return db.Group{}, err
	}

	_, err = s.queries.CreateMembership(ctx, db.CreateMembershipParams{
		UserID:  ownerID,
		GroupID: group.ID,
		Role:    "owner",
	})
	if err != nil {
		return db.Group{}, err
	}

	return group, nil
}

// GetDetail returns the group. ErrForbidden if userID is not a member.
func (s *GroupService) GetDetail(ctx context.Context, userID, groupID int32) (*db.Group, error) {
	group, err := s.queries.GetGroupByID(ctx, groupID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	_, err = s.queries.GetMembership(ctx, db.GetMembershipParams{
		UserID:  userID,
		GroupID: groupID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrForbidden
		}
		return nil, err
	}

	return &group, nil
}

// RemoveMember kicks a member. Admins can kick members; owners can kick anyone.
func (s *GroupService) RemoveMember(ctx context.Context, requesterID, groupID, targetUserID int32) error {
	callerMem, err := s.queries.GetMembership(ctx, db.GetMembershipParams{
		UserID:  requesterID,
		GroupID: groupID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrForbidden
		}
		return err
	}

	if callerMem.Role != "owner" && callerMem.Role != "admin" {
		return ErrForbidden
	}

	targetMem, err := s.queries.GetMembership(ctx, db.GetMembershipParams{
		UserID:  targetUserID,
		GroupID: groupID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	if targetMem.Role == "owner" {
		return errors.New("cannot kick the owner")
	}

	if callerMem.Role == "admin" && targetMem.Role == "admin" {
		return errors.New("admins cannot kick other admins")
	}

	return s.queries.DeleteMembership(ctx, db.DeleteMembershipParams{
		UserID:  targetUserID,
		GroupID: groupID,
	})
}

// UpdateMemberRole updates a member's role (member→admin, admin→member). Requires owner.
func (s *GroupService) UpdateMemberRole(ctx context.Context, requesterID, groupID, targetUserID int32, role string) error {
	callerMem, err := s.queries.GetMembership(ctx, db.GetMembershipParams{
		UserID:  requesterID,
		GroupID: groupID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrForbidden
		}
		return err
	}

	if callerMem.Role != "owner" {
		return ErrForbidden
	}

	if role != "member" && role != "admin" {
		return errors.New("invalid role: must be 'member' or 'admin'")
	}

	targetMem, err := s.queries.GetMembership(ctx, db.GetMembershipParams{
		UserID:  targetUserID,
		GroupID: groupID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	if targetMem.Role == "owner" {
		return errors.New("cannot change the owner's role")
	}

	return s.queries.UpdateMemberRole(ctx, db.UpdateMemberRoleParams{
		UserID:  targetUserID,
		GroupID: groupID,
		Role:    role,
	})
}

// CreateInvite generates a new invite code for the group. Requires membership.
func (s *GroupService) CreateInvite(ctx context.Context, userID, groupID int32) (db.Invite, error) {
	_, err := s.queries.GetMembership(ctx, db.GetMembershipParams{
		UserID:  userID,
		GroupID: groupID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.Invite{}, ErrForbidden
		}
		return db.Invite{}, err
	}

	bytes := make([]byte, 6)
	if _, err := rand.Read(bytes); err != nil {
		return db.Invite{}, err
	}
	code := strings.ToUpper(hex.EncodeToString(bytes))

	return s.queries.CreateInvite(ctx, db.CreateInviteParams{
		Code:            code,
		GroupID:         groupID,
		CreatedByUserID: userID,
		ExpiresAt:       nil,
	})
}

// sanitizeGroupName trims and limits group name to 100 characters.
func sanitizeGroupName(raw string) string {
	return sanitizeText(raw, 100)
}

// isValidDateStr checks if a string matches YYYY-MM-DD format.
func isValidDateStr(s string) bool {
	if len(s) != 10 {
		return false
	}
	for i, c := range s {
		if i == 4 || i == 7 {
			if c != '-' {
				return false
			}
		} else {
			if c < '0' || c > '9' {
				return false
			}
		}
	}
	return true
}
