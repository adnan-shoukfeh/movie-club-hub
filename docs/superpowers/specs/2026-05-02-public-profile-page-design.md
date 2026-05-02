# Public Profile Page

> **Context:** The `/users/:userId` public profile page was deferred from `2026-05-01-letterboxd-production-port-design.md`. The Go backend is already shipped (`GET /users/:userId/profile`, full `ProfileResponse` with stats, top genres, recent activity, viewer-scoped activity filtering). This spec covers the frontend port plus the routing rename that separates private settings from the public profile, and the rollout of clickable user identities across the app.

## Goal

Ship the public, shareable user profile page through the production frontend, and make every user identity in the app a link to that page. Cleanly split private settings (where Letterboxd linking lives) from the public profile (where the linked Letterboxd account, stats, and recent activity are displayed for other club members).

## Already Done (no change)

- Backend in `go-api/`: migration `000014_user_profiles_letterboxd`, `000015_user_profile_indexes`; `ProfileService.GetProfile` with viewer-scoped activity; route `GET /users/:userId/profile`. Returns 403 if viewer shares no club with target, 404 if user not found.
- Production frontend Letterboxd port: `LetterboxdForm`, `MovieLinkPreferenceForm`, `getMovieUrl`, OpenAPI for `PATCH /me/profile` and `PATCH /me/settings`.

## Routing Decisions

| Route | Page | Status |
|---|---|---|
| `/users/:userId` | New public profile page | new |
| `/settings` | Private settings (was `/profile`) | rename |
| `/profile` | Permanent redirect → `/users/<viewer-id>` | rewired |

Rationale: "Profile" in normal product usage means the public-facing page; the existing settings page is honestly named with "Settings". Old `/profile` bookmarks redirect to the new public page (low user count, low risk).

## In Scope

### 1. OpenAPI + generated client (`lib/api-spec/openapi.yaml`)

Add:

- `GET /users/{userId}/profile` — operationId `getUserProfile`, path param `userId: integer`. Responses:
  - 200 `UserProfile` schema (see below)
  - 403 `Error`
  - 404 `Error`
- New schemas:
  - `UserProfile`: `{ id: int32, username: string, avatarUrl: string|null, letterboxdUsername: string|null, createdAt: date-time, stats: UserStats, topGenres: string[], recentActivity: ActivityItem[] }`
  - `UserStats`: `{ totalWatched: int64, totalReviews: int64, avgRating: number }`
  - `ActivityItem`: `{ filmId: int64, title: string, year: int32|null, posterUrl: string|null, rating: number|null, review: string|null, watchedAt: date-time }`

Regenerate via the existing orval pipeline. Commit only the intentional diffs.

### 2. New domain folder `artifacts/movie-club/src/domains/profiles/`

```
domains/profiles/
  components/
    UserLink.tsx
    ProfileIdentityCard.tsx
    RecentActivityCard.tsx
    ProfileNotFound.tsx
    ProfileForbidden.tsx
  hooks/
    useGetUserProfile.ts
```

**`UserLink`** — single shared component:

```tsx
interface UserLinkProps {
  userId: number;
  className?: string;
  children: React.ReactNode;
}
// Renders a wouter <Link to={`/users/${userId}`} className={cn("cursor-pointer hover:opacity-80 transition-opacity", className)}>{children}</Link>
```

Pure wrapping — no styling beyond a hover affordance. Consumers continue to render their own `<Avatar>` or text inside.

**`ProfileIdentityCard`** — avatar, username (with "You" tag when `viewerId === profile.id`), "Member since" line, Letterboxd badge (if set; opens `https://letterboxd.com/<username>/` in new tab), stats trio (Watched / Avg★ / Reviews), top genres chips (hidden when empty).

**`RecentActivityCard`** — title "Recent Activity", up to 10 rows: poster + title · year + ★ rating + 2-line truncated review + relative timestamp (e.g. `3d ago`, `1w ago` — use `Intl.RelativeTimeFormat` or a small helper, no `date-fns` dependency). Empty state: italic muted "No activity yet."

**`ProfileNotFound` / `ProfileForbidden`** — centered single card with message and "Back to dashboard" button. Forbidden copy: "You don't share a club with this member yet."

**`useGetUserProfile(userId)`** — thin wrapper around the generated `useGetUserProfile` hook. Surfaces typed `{ status: "ok" | "forbidden" | "notFound" | "error"; profile?: UserProfile }` based on HTTP status, so the page renders the right state without inspecting the raw error.

### 3. New page `pages/user-profile.tsx`

Layout (matches the approved mockup, lives at `.superpowers/brainstorm/89573-1777751898/content/profile-mockup-v1.html`):

- Top bar: page-local simpler header (do **not** literally reuse `DashboardHeader` — its props are dashboard-specific). New small header inside this page: brutalist navy bg + gold bottom border, "Movie Clubs" wordmark on the left, settings gear + logout on the right (no avatar self-link on this page since you may already be on your own profile).
- Back-to-dashboard link.
- **Desktop:** two-column grid `grid-cols-[320px_1fr] gap-5`. Left: `ProfileIdentityCard`. Right: `RecentActivityCard`.
- **Mobile (< 1024px):** single column, identity above activity. Avatar shrinks to a 72×72 inline block with username/Letterboxd-badge stacked beside it.
- Loading: two-card skeleton (left identity skeleton, right four activity-row skeletons).
- 403 → `ProfileForbidden`. 404 → `ProfileNotFound`.

### 4. Settings page rename (`pages/profile.tsx` → `pages/settings.tsx`)

- File rename only. Update header title from "Profile Settings" to "Settings". Update back button target stays `/dashboard`.
- Update `App.tsx`:
  - Remove `<Route path="/profile">` for the Profile component.
  - Add `<Route path="/settings" component={Settings} />`.
  - Add `<Route path="/profile">{() => <RedirectToOwnProfile />}</Route>` where `RedirectToOwnProfile` reads `useGetMe()` and `<Redirect to={"/users/" + me.id} />` (or to `/` if logged out).
  - Add `<Route path="/users/:userId" component={UserProfile} />`.

### 5. Dashboard header (`DashboardHeader.tsx`)

Props change:
- Drop `onProfile`.
- Add `onSettings: () => void` and `onViewProfile: () => void`.
- Add `avatarUrl?: string|null` prop.

Right-side layout: `[avatar button → /users/me.id] [gear → /settings] [logout]`. Avatar button uses the existing `Avatar` primitive (32×32, gold border) with `me.avatarUrl` and `me.username[0]` fallback. The dashboard page wires both callbacks via `setLocation`.

### 6. UserLink rollout (a–g)

Wrap the existing `<Avatar>` (and any adjacent name text) in `UserLink` at:

| ID | File | Location |
|---|---|---|
| a | `domains/groups/components/DashboardHeader.tsx` | Header avatar (handled in §5) |
| b | `pages/group-detail.tsx` | Members list (line ~301) |
| c | `pages/group-detail.tsx` | Schedule sidebar picker chips (line ~429) |
| d | `domains/verdicts/components/TurnResultsInline.tsx` | Vote rows (line ~196) |
| e | `domains/verdicts/components/TurnResultsInline.tsx` | Member roll call (line ~243) |
| f | `domains/admin/components/MemberRoleManager.tsx` | Member rows |
| g | `domains/admin/components/PickerScheduleEditor.tsx` | Picker chips |

Pure mechanical wrap — no visual change beyond hover affordance.

### 7. Roadmap edits (`docs/roadmap/ROADMAP.md`)

- Update Done item `Profile Pages` to reflect that the served production page shipped in this PR (the previous tick referred to the FE-Design prototype, not the deployed frontend).
- **Remove** P1 item `Settings Consolidation — move user settings into profile page and remove standalone settings`. The decision in this spec inverts that direction: settings stay separate, profile becomes public-only.
- **Add** P2 item: `Activity Pagination — Load more / paginate the profile recent-activity feed (currently capped at 10).`

## Out of Scope

- Stats backfill or recompute logic (unchanged from backend).
- Activity pagination (tracked on roadmap).
- Username slugs in URL (numeric ID is sufficient; deferred indefinitely).
- Letterboxd sync (already on roadmap as P2).
- Mutating reviews/ratings from the profile page (read-only).

## Test Plan

- `pnpm --filter movie-club typecheck` after each commit.
- `cd go-api && go test ./...` — should remain green; backend untouched.
- `make build` round-trip.
- Manual:
  1. Login → click avatar in dashboard header → land on `/users/<your-id>` with "You" tag.
  2. Click a club → click another member's avatar → see their profile (no "You" tag).
  3. Visit `/users/999999` (a user you don't share a club with) → see 403 forbidden state.
  4. Visit `/users/0` (nonexistent) → see 404 not-found state.
  5. Toggle Letterboxd username in `/settings` → reload `/users/<your-id>` → badge updates.
  6. Visit `/profile` directly → redirected to `/users/<your-id>`.
  7. Mobile viewport (375px): identity card stacks above activity, all touch targets ≥ 44px.

## Risks

- **Wouter redirect timing.** `RedirectToOwnProfile` depends on `useGetMe()` being resolved. If `me` is loading, render a brief skeleton; if `me` is null (unauthenticated), redirect to `/`.
- **`UserLink` regressions.** Wrapping members in seven places risks breaking surface-specific layouts (e.g., a flex container that expected a direct `Avatar` child). Each call-site change must be visually verified at desktop and mobile.
- **OpenAPI regen drift.** Orval may format adjacent generated files; commit only intentional diffs.
- **Self-link inside `DashboardHeader`.** Header is sticky and `UserLink` adds a `<Link>` — make sure the click target doesn't bubble into any parent click handlers (none exist today, but worth a glance).

## References

- Approved mockup: `.superpowers/brainstorm/89573-1777751898/content/profile-mockup-v1.html`
- Backend service: `go-api/internal/service/profile.go`
- Prior production port spec: `docs/superpowers/specs/2026-05-01-letterboxd-production-port-design.md`
