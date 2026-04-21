package middleware

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/session"
)

// contextKey is the unexported type used for context keys in this package.
type contextKey string

// MembershipKey is the context key for storing the membership fetched by middleware.
const MembershipKey contextKey = "membership"

// RequireAuth checks the session. Responds 401 if the user is not authenticated.
func RequireAuth(sm *session.Manager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if _, ok := sm.GetUserID(r); !ok {
				writeJSONError(w, http.StatusUnauthorized, "Not authenticated")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireGroupMembership extracts {groupId} from chi URL params, fetches the
// membership from the DB, and stores it in context under MembershipKey.
// Responds 403 if the user is not a member of the group.
func RequireGroupMembership(q *db.Queries, sm *session.Manager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			groupIDStr := chi.URLParam(r, "groupId")
			groupIDInt, err := strconv.Atoi(groupIDStr)
			if err != nil {
				writeJSONError(w, http.StatusBadRequest, "Invalid group ID")
				return
			}
			groupID := int32(groupIDInt)

			userID, ok := sm.GetUserID(r)
			if !ok {
				writeJSONError(w, http.StatusUnauthorized, "Not authenticated")
				return
			}

			mem, err := q.GetMembership(r.Context(), db.GetMembershipParams{
				UserID:  int32(userID),
				GroupID: groupID,
			})
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					writeJSONError(w, http.StatusForbidden, "Not a member of this group")
					return
				}
				writeJSONError(w, http.StatusInternalServerError, "Failed to check membership")
				return
			}

			ctx := context.WithValue(r.Context(), MembershipKey, &mem)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireGroupAdmin wraps RequireGroupMembership, then checks that the role is
// "admin" or "owner". Responds 403 if the role is insufficient.
func RequireGroupAdmin(q *db.Queries, sm *session.Manager) func(http.Handler) http.Handler {
	membershipMW := RequireGroupMembership(q, sm)
	return func(next http.Handler) http.Handler {
		return membershipMW(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			mem, ok := MembershipFromCtx(r.Context())
			if !ok {
				writeJSONError(w, http.StatusInternalServerError, "Membership not found in context")
				return
			}
			if mem.Role != "owner" && mem.Role != "admin" {
				writeJSONError(w, http.StatusForbidden, "Insufficient permissions")
				return
			}
			next.ServeHTTP(w, r)
		}))
	}
}

// RequireGroupOwner wraps RequireGroupMembership, then checks that the role is
// "owner". Responds 403 otherwise.
func RequireGroupOwner(q *db.Queries, sm *session.Manager) func(http.Handler) http.Handler {
	membershipMW := RequireGroupMembership(q, sm)
	return func(next http.Handler) http.Handler {
		return membershipMW(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			mem, ok := MembershipFromCtx(r.Context())
			if !ok {
				writeJSONError(w, http.StatusInternalServerError, "Membership not found in context")
				return
			}
			if mem.Role != "owner" {
				writeJSONError(w, http.StatusForbidden, "Only the current owner can transfer ownership")
				return
			}
			next.ServeHTTP(w, r)
		}))
	}
}

// MembershipFromCtx retrieves the membership stored by RequireGroupMembership.
func MembershipFromCtx(ctx context.Context) (*db.Membership, bool) {
	mem, ok := ctx.Value(MembershipKey).(*db.Membership)
	return mem, ok
}
