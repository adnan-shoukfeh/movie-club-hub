# Calendar Date Picker + User Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin panel's plain date input with a popover calendar picker, and add a `/profile` page (username + password update) accessible via a gear icon in the dashboard header.

**Architecture:** Two independent feature tracks. The calendar picker is a pure frontend change in `group-admin.tsx` — swap `<input type="date">` for the existing `Popover`+`Calendar` components. The profile page requires new SQL queries, Go handler methods, route registration, a new React page, and small changes to the dashboard header and router.

**Tech Stack:** Go (chi router, sqlc, bcrypt), React + TypeScript (wouter, tanstack-query, lucide-react, react-day-picker via existing Calendar component), Tailwind CSS

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `go-api/internal/db/queries/auth.sql` | Modify | Add UpdateUsername, UpdateUserPassword queries |
| `go-api/internal/db/auth.sql.go` | Modify (manual, mirrors sqlc output) | Generated Go methods for new queries |
| `go-api/internal/handler/auth.go` | Modify | Add UpdateUsername and UpdatePassword handlers |
| `go-api/cmd/server/main.go` | Modify | Register two new PATCH /api/me/* routes |
| `artifacts/movie-club/src/pages/group-admin.tsx` | Modify | Swap `<input type="date">` for Popover+Calendar |
| `artifacts/movie-club/src/pages/profile.tsx` | Create | New profile page with username + password forms |
| `artifacts/movie-club/src/pages/dashboard.tsx` | Modify | Add gear icon button to header |
| `artifacts/movie-club/src/App.tsx` | Modify | Register `/profile` route |

---

## Task 1: Add SQL Queries for Username and Password Update

**Files:**
- Modify: `go-api/internal/db/queries/auth.sql`
- Modify: `go-api/internal/db/auth.sql.go`

- [ ] **Step 1: Add SQL queries to auth.sql**

Open `go-api/internal/db/queries/auth.sql` and append these two queries at the end:

```sql
-- name: UpdateUsername :exec
UPDATE users SET username = $1 WHERE id = $2;

-- name: UpdateUserPassword :exec
UPDATE users SET password_hash = $1 WHERE id = $2;
```

- [ ] **Step 2: Run sqlc to regenerate**

```bash
cd /Users/adnanshoukfeh/Documents/Projects/Code/Movie-Club-Hub
make sqlc
```

Expected: no errors, `go-api/internal/db/auth.sql.go` updated with two new methods.

If `sqlc` is not installed, manually append the following to the bottom of `go-api/internal/db/auth.sql.go` (after the last function):

```go
const updateUsername = `-- name: UpdateUsername :exec
UPDATE users SET username = $1 WHERE id = $2
`

func (q *Queries) UpdateUsername(ctx context.Context, username string, id int32) error {
	_, err := q.db.Exec(ctx, updateUsername, username, id)
	return err
}

const updateUserPassword = `-- name: UpdateUserPassword :exec
UPDATE users SET password_hash = $1 WHERE id = $2
`

func (q *Queries) UpdateUserPassword(ctx context.Context, passwordHash string, id int32) error {
	_, err := q.db.Exec(ctx, updateUserPassword, passwordHash, id)
	return err
}
```

- [ ] **Step 3: Verify Go compiles**

```bash
cd /Users/adnanshoukfeh/Documents/Projects/Code/Movie-Club-Hub/go-api && go build ./...
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/adnanshoukfeh/Documents/Projects/Code/Movie-Club-Hub
git add go-api/internal/db/queries/auth.sql go-api/internal/db/auth.sql.go
git commit -m "feat: add UpdateUsername and UpdateUserPassword SQL queries"
```

---

## Task 2: Add Go Handler Methods for Profile Update

**Files:**
- Modify: `go-api/internal/handler/auth.go`

- [ ] **Step 1: Add UpdateUsername handler**

Append the following to the bottom of `go-api/internal/handler/auth.go`:

```go
type updateUsernameRequest struct {
	Username string `json:"username"`
}

func (h *Handler) UpdateUsername(w http.ResponseWriter, r *http.Request) {
	var req updateUsernameRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	newUsername := sanitizeUsername(req.Username)
	if !isValidUsername(newUsername) {
		writeError(w, http.StatusBadRequest, "Username must be 2-32 characters, alphanumeric and underscores only.")
		return
	}

	userID := h.userID(r)

	// Check uniqueness
	existing, err := h.q.GetUserByUsername(r.Context(), newUsername)
	if err == nil && existing.ID != userID {
		writeError(w, http.StatusConflict, "Username is already taken.")
		return
	}

	if err := h.q.UpdateUsername(r.Context(), newUsername, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update username")
		return
	}

	user, err := h.q.GetUserByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch updated user")
		return
	}

	writeJSON(w, http.StatusOK, toUserResponse(user))
}

type updatePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

func (h *Handler) UpdatePassword(w http.ResponseWriter, r *http.Request) {
	var req updatePasswordRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if len(req.NewPassword) < 8 {
		writeError(w, http.StatusBadRequest, "New password must be at least 8 characters.")
		return
	}

	userID := h.userID(r)
	user, err := h.q.GetUserByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch user")
		return
	}

	if user.PasswordHash == nil {
		writeError(w, http.StatusBadRequest, "Account has no password set.")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		writeError(w, http.StatusUnauthorized, "Current password is incorrect.")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	if err := h.q.UpdateUserPassword(r.Context(), string(hash), userID); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update password")
		return
	}

	writeMessage(w, http.StatusOK, "Password updated")
}
```

- [ ] **Step 2: Verify Go compiles**

```bash
cd /Users/adnanshoukfeh/Documents/Projects/Code/Movie-Club-Hub/go-api && go build ./...
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/adnanshoukfeh/Documents/Projects/Code/Movie-Club-Hub
git add go-api/internal/handler/auth.go
git commit -m "feat: add UpdateUsername and UpdatePassword API handlers"
```

---

## Task 3: Register New Routes

**Files:**
- Modify: `go-api/cmd/server/main.go`

- [ ] **Step 1: Add routes inside the authenticated group**

In `go-api/cmd/server/main.go`, find the authenticated group block (the one starting with `r.Group(func(r chi.Router) {`). Add these two routes anywhere inside it (e.g., after the `r.Get("/dashboard", h.Dashboard)` line):

```go
r.Patch("/me/username", h.UpdateUsername)
r.Patch("/me/password", h.UpdatePassword)
```

- [ ] **Step 2: Verify Go compiles**

```bash
cd /Users/adnanshoukfeh/Documents/Projects/Code/Movie-Club-Hub/go-api && go build ./...
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/adnanshoukfeh/Documents/Projects/Code/Movie-Club-Hub
git add go-api/cmd/server/main.go
git commit -m "feat: register PATCH /api/me/username and /api/me/password routes"
```

---

## Task 4: Calendar Picker in Admin Panel

**Files:**
- Modify: `artifacts/movie-club/src/pages/group-admin.tsx`

- [ ] **Step 1: Add Calendar and Popover imports**

In `group-admin.tsx`, find the existing imports block. Add these imports after the existing UI component imports:

```tsx
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parse, isValid } from "date-fns";
```

Also add `CalendarIcon` to the existing lucide-react import line (it already imports from lucide-react):

```tsx
import {
  ArrowLeft,
  Shield,
  Calendar,
  CalendarIcon,    // ← add this
  Clock,
  // ... rest unchanged
} from "lucide-react";
```

Note: There is a naming collision — the existing `Calendar` import from lucide is used as an icon in the section headers. Rename the lucide one to avoid conflict. Change the lucide import to import `CalendarIcon` only (the lucide `Calendar` icon is used in two places in the JSX as `<Calendar className="w-4 h-4 text-primary" />`). 

Do this carefully: change the lucide import line so `Calendar` from lucide becomes `Calendar as CalendarIcon2` OR just rename them clearly. The cleanest approach: 

In the lucide import, rename `Calendar` to `CalendarIcon2`:
```tsx
import {
  ArrowLeft,
  Shield,
  Calendar as CalendarIcon2,
  Clock,
  Film,
  Users,
  Star,
  Unlock,
  Lock,
  Trash2,
  UserCheck,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Check,
  X,
  Pencil,
} from "lucide-react";
```

Then update the two JSX usages of the old `Calendar` icon (section headers) to `CalendarIcon2`:
- Line ~595: `<Calendar className="w-4 h-4 text-primary" />` → `<CalendarIcon2 className="w-4 h-4 text-primary" />`
- Line ~1066: `<Calendar className="w-4 h-4 text-primary" />` → `<CalendarIcon2 className="w-4 h-4 text-primary" />`

- [ ] **Step 2: Add useState for popover open state**

In `group-admin.tsx`, find the Group Settings state block (around line 182-184):

```tsx
// Group Settings state
const [settingsStartDate, setSettingsStartDate] = useState<string>("");
const [settingsTurnLength, setSettingsTurnLength] = useState<string>("");
const [settingsSaving, setSettingsSaving] = useState(false);
```

Add one more state variable after `settingsSaving`:

```tsx
const [settingsDateOpen, setSettingsDateOpen] = useState(false);
```

- [ ] **Step 3: Replace the date input with Popover + Calendar**

Find this block in the Group Settings section (around line 1080-1089):

```tsx
<div>
  <label className="text-xs text-muted-foreground block mb-1">Group Start Date</label>
  <input
    type="date"
    value={settingsStartDate}
    onChange={(e) => setSettingsStartDate(e.target.value)}
    className="h-9 text-sm rounded-md bg-background border border-border px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs"
  />
  <p className="text-xs text-muted-foreground/60 mt-1">The date when turn 1 began</p>
</div>
```

Replace it with:

```tsx
<div>
  <label className="text-xs text-muted-foreground block mb-1">Group Start Date</label>
  <Popover open={settingsDateOpen} onOpenChange={setSettingsDateOpen}>
    <PopoverTrigger asChild>
      <button
        type="button"
        className="h-9 text-sm rounded-md bg-background border border-border px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs flex items-center gap-2 text-left"
      >
        <CalendarIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        {settingsStartDate
          ? format(parse(settingsStartDate, "yyyy-MM-dd", new Date()), "MMM d, yyyy")
          : <span className="text-muted-foreground/60">Pick a date</span>}
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        selected={
          settingsStartDate && isValid(parse(settingsStartDate, "yyyy-MM-dd", new Date()))
            ? parse(settingsStartDate, "yyyy-MM-dd", new Date())
            : undefined
        }
        onSelect={(date) => {
          if (date) {
            setSettingsStartDate(format(date, "yyyy-MM-dd"));
            setSettingsDateOpen(false);
          }
        }}
      />
    </PopoverContent>
  </Popover>
  <p className="text-xs text-muted-foreground/60 mt-1">The date when turn 1 began</p>
</div>
```

- [ ] **Step 4: Check date-fns is available**

```bash
cd /Users/adnanshoukfeh/Documents/Projects/Code/Movie-Club-Hub
grep -r "date-fns" artifacts/movie-club/package.json lib/api-client-react/package.json 2>/dev/null || grep -r "\"date-fns\"" package.json
```

If `date-fns` is not a dependency of the `movie-club` package, add it:

```bash
pnpm --filter movie-club add date-fns
```

Note: `react-day-picker` (used by the Calendar component) typically already depends on `date-fns`. Check with:

```bash
grep "date-fns" /Users/adnanshoukfeh/Documents/Projects/Code/Movie-Club-Hub/node_modules/react-day-picker/package.json 2>/dev/null | head -3
```

- [ ] **Step 5: Check Popover is importable**

Verify `src/components/ui/popover.tsx` exists (it was listed in the UI components directory listing). If it exists, the import path `@/components/ui/popover` is correct.

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/adnanshoukfeh/Documents/Projects/Code/Movie-Club-Hub
make fe-typecheck
```

Expected: no errors related to group-admin.tsx.

- [ ] **Step 7: Commit**

```bash
cd /Users/adnanshoukfeh/Documents/Projects/Code/Movie-Club-Hub
git add artifacts/movie-club/src/pages/group-admin.tsx
git commit -m "feat: replace date input with popover calendar picker in admin panel"
```

---

## Task 5: Create Profile Page

**Files:**
- Create: `artifacts/movie-club/src/pages/profile.tsx`

- [ ] **Step 1: Create profile.tsx**

Create `artifacts/movie-club/src/pages/profile.tsx` with the following content:

```tsx
import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, User, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

async function apiCall<T = Record<string, unknown>>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, credentials: "include" });
  const data: Record<string, unknown> = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  return data as T;
}

export default function Profile() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me, isLoading } = useGetMe();

  const [username, setUsername] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!me) {
    setLocation("/");
    return null;
  }

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      toast({ title: "Username required", variant: "destructive" });
      return;
    }
    setUsernameSaving(true);
    try {
      await apiCall("/api/me/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      toast({ title: "Username updated" });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setUsername("");
    } catch (err: unknown) {
      toast({
        title: "Failed to update username",
        description: err instanceof Error ? err.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setUsernameSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "New password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setPasswordSaving(true);
    try {
      await apiCall("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast({ title: "Password updated" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast({
        title: "Failed to update password",
        description: err instanceof Error ? err.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <span className="font-serif font-semibold text-foreground">Profile Settings</span>
            <p className="text-xs text-muted-foreground">{me.username}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6 space-y-4">

        {/* Username */}
        <div className="bg-card/50 border border-border/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-primary" />
            <span className="font-serif font-semibold text-foreground">Username</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Current username: <span className="text-foreground font-medium">{me.username}</span>
          </p>
          <form onSubmit={handleUpdateUsername} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">New username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={me.username}
                maxLength={32}
                className="h-9 text-sm rounded-md bg-background border border-border px-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs"
              />
              <p className="text-xs text-muted-foreground/60 mt-1">2–32 characters, letters, numbers, and underscores only</p>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={usernameSaving || !username.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {usernameSaving ? "Saving..." : "Update Username"}
            </Button>
          </form>
        </div>

        {/* Password */}
        <div className="bg-card/50 border border-border/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-primary" />
            <span className="font-serif font-semibold text-foreground">Password</span>
          </div>
          <form onSubmit={handleUpdatePassword} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="h-9 text-sm rounded-md bg-background border border-border px-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="h-9 text-sm rounded-md bg-background border border-border px-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs"
              />
              <p className="text-xs text-muted-foreground/60 mt-1">Minimum 8 characters</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="h-9 text-sm rounded-md bg-background border border-border px-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              className="bg-primary hover:bg-primary/90"
            >
              {passwordSaving ? "Saving..." : "Update Password"}
            </Button>
          </form>
        </div>

      </main>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/adnanshoukfeh/Documents/Projects/Code/Movie-Club-Hub
make fe-typecheck
```

Expected: no errors in profile.tsx.

- [ ] **Step 3: Commit**

```bash
cd /Users/adnanshoukfeh/Documents/Projects/Code/Movie-Club-Hub
git add artifacts/movie-club/src/pages/profile.tsx
git commit -m "feat: add user profile page with username and password update"
```

---

## Task 6: Wire Up Dashboard Gear Icon and Router

**Files:**
- Modify: `artifacts/movie-club/src/pages/dashboard.tsx`
- Modify: `artifacts/movie-club/src/App.tsx`

- [ ] **Step 1: Add gear icon to dashboard header**

In `artifacts/movie-club/src/pages/dashboard.tsx`, find the lucide-react import line:

```tsx
import { Film, Plus, LogOut, Users, Star, Clock } from "lucide-react";
```

Add `Settings` to it:

```tsx
import { Film, Plus, LogOut, Users, Star, Clock, Settings } from "lucide-react";
```

Then find the logout button in the header (around line 113-121):

```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={handleLogout}
  className="text-muted-foreground hover:text-foreground"
>
  <LogOut className="w-4 h-4 mr-1.5" />
  Out
</Button>
```

Replace it with a `div` containing both buttons side by side:

```tsx
<div className="flex items-center gap-1">
  <Button
    variant="ghost"
    size="icon"
    onClick={() => setLocation("/profile")}
    className="text-muted-foreground hover:text-foreground"
    title="Profile settings"
  >
    <Settings className="w-4 h-4" />
  </Button>
  <Button
    variant="ghost"
    size="sm"
    onClick={handleLogout}
    className="text-muted-foreground hover:text-foreground"
  >
    <LogOut className="w-4 h-4 mr-1.5" />
    Out
  </Button>
</div>
```

- [ ] **Step 2: Register /profile route in App.tsx**

In `artifacts/movie-club/src/App.tsx`, add the Profile import with the other page imports:

```tsx
import Profile from "./pages/profile";
```

Then add the route inside the `<Switch>` block, after the `/dashboard` route:

```tsx
<Route path="/profile" component={Profile} />
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/adnanshoukfeh/Documents/Projects/Code/Movie-Club-Hub
make fe-typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/adnanshoukfeh/Documents/Projects/Code/Movie-Club-Hub
git add artifacts/movie-club/src/pages/dashboard.tsx artifacts/movie-club/src/App.tsx
git commit -m "feat: add gear icon to dashboard header and register /profile route"
```

---

## Final Verification

- [ ] Go API compiles: `cd go-api && go build ./...`
- [ ] Frontend typechecks: `make fe-typecheck`
- [ ] Start the API server (`make dev`) and confirm routes respond at `PATCH /api/me/username` and `PATCH /api/me/password` (401 without auth, as expected)
- [ ] Start the frontend dev server (`make fe-dev`) and manually verify:
  - Dashboard header shows gear icon next to "Out" button
  - Gear icon navigates to `/profile`
  - Profile page shows current username, has username form and password form
  - Admin panel Group Settings shows calendar button instead of date input; clicking it opens a calendar picker; selecting a date closes the picker and updates the displayed date
