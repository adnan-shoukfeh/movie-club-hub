# Calendar Date Picker + User Profile Page

**Date:** 2026-04-16

---

## Overview

Two independent features:

1. Replace the plain `<input type="date">` in the admin panel's Group Settings section with a popover-based calendar picker.
2. Add a user profile page accessible from the dashboard header via a gear icon, allowing users to update their username and password.

---

## Feature 1: Calendar Date Picker (Admin Panel)

### What changes

In `artifacts/movie-club/src/pages/group-admin.tsx`, the "Group Start Date" field in the Group Settings section currently renders a native `<input type="date">`. This is replaced with a `Popover` + `Calendar` component, both of which already exist in `src/components/ui/`.

### Behavior

- The trigger is a styled button showing the currently selected date (formatted as "MMM D, YYYY") with a `CalendarIcon` from lucide.
- Clicking the trigger opens a `Popover` containing the `Calendar` component.
- Selecting a date closes the popover and updates `settingsStartDate` state (still stored as a `YYYY-MM-DD` string).
- The value sent to `PATCH /api/admin/groups/:id/settings` is unchanged — no backend changes required.

### Scope

- Only the "Group Start Date" field is changed. Turn Length and the Save button are untouched.
- No new dependencies introduced; `Popover` and `Calendar` are already in the project.

---

## Feature 2: User Profile Page

### Frontend

**New file:** `artifacts/movie-club/src/pages/profile.tsx`

- Follows existing page conventions: sticky header with back arrow (`ArrowLeft`), `max-w-2xl` centered content, dark card sections.
- Route: `/profile`, added to `artifacts/movie-club/src/App.tsx`.
- Requires authentication — redirects to `/` if `useGetMe` returns no user.

**Dashboard header change** (`artifacts/movie-club/src/pages/dashboard.tsx`):

- A `Settings` gear icon button is added to the header next to the existing logout button.
- Clicking it navigates to `/profile`.

**Profile page sections:**

1. **Username section**
   - Pre-filled text input with current username from `useGetMe`.
   - Validates: 2–32 characters, alphanumeric and underscores only (same rules as registration).
   - Calls `PATCH /api/me/username` on submit.
   - On success: invalidates `getGetMeQueryKey` so the username updates everywhere (dashboard header, etc.) + success toast.

2. **Password section**
   - Three inputs: current password, new password (≥8 chars), confirm new password.
   - Client-side validation: new password and confirm must match before submitting.
   - Calls `PATCH /api/me/password` on submit.
   - On success: success toast. No re-fetch needed.

### Backend (Go API)

**New endpoints registered in `go-api/internal/handler/handler.go`:**

- `PATCH /api/me/username` — handler `UpdateUsername`
- `PATCH /api/me/password` — handler `UpdatePassword`

Both require an active session (existing `requireAuth` middleware).

**Handler logic in `go-api/internal/handler/auth.go`:**

`UpdateUsername`:
- Validates new username format (2–32 chars, alphanumeric + underscores).
- Checks uniqueness via `GetUserByUsername`; returns 409 if taken.
- Calls new SQL query `UpdateUsername`.
- Returns updated user response.

`UpdatePassword`:
- Accepts `{ currentPassword, newPassword }`.
- Fetches current user, verifies `currentPassword` against stored bcrypt hash.
- Returns 401 if current password is wrong.
- Validates new password ≥ 8 characters.
- Bcrypt-hashes new password (cost 12) and calls new SQL query `UpdateUserPassword`.
- Returns 200 on success.

**New SQL queries** (`go-api/internal/db/queries/auth.sql`):

```sql
-- name: UpdateUsername :exec
UPDATE users SET username = $1 WHERE id = $2;

-- name: UpdateUserPassword :exec
UPDATE users SET password_hash = $1 WHERE id = $2;
```

Generated Go methods added to `go-api/internal/db/auth.sql.go` via sqlc.

---

## Out of Scope

- Email field (not in the schema).
- Avatar / profile picture.
- Account deletion.
- Admin ability to update other users' profiles.
