# Domain Reference

Each domain owns its slice of the application. Cross-domain calls go through service interfaces, never directly to another domain's DB queries.

## Backend Domains

### auth
- **Service:** `AuthService`
- **Responsibilities:** Registration, login, password hashing, username validation, session management
- **Sentinel errors:** `ErrUsernameTaken`, `ErrInvalidCredentials`, `ErrWeakPassword`, `ErrInvalidUsername`

### groups
- **Service:** `GroupService`
- **Responsibilities:** Group CRUD, membership management, invite codes, role enforcement
- **Sentinel errors:** `ErrForbidden`, `ErrNotFound`

### turns
- **Service:** `TurnService`
- **Responsibilities:** Turn schedule, deadline calculation, picker assignment, start-offset logic
- **Key function:** `GetEffectiveDeadline(weekOf, config, adminExtendedDays, startOffsetDays)` — single source of truth for all deadline logic

### verdicts
- **Service:** `VerdictService`
- **Responsibilities:** Watch status + rating + review unified as `Verdict`; transactional writes
- **DB:** Writes to both `watch_status` and `votes` tables in a single transaction

### movies
- **Service:** `MovieService`
- **Responsibilities:** Movie selection for a turn, OMDb metadata fetch and caching

### nominations
- **Service:** `NominationService`
- **Responsibilities:** Nomination CRUD, authorization (only nominator/admin/owner may delete)

## Frontend Domains

### turns
- `TurnStatusBanner` — deadline countdown, turn phase indicator
- `turnUtils.ts` — pure functions for turn state derived from API data

### movies
- `CurrentTurnMovie` — display selected movie with poster
- `PickerMovieSelector` — OMDB search + movie selection for the picker

### nominations
- `NominationSheet` — add/remove nominations with search

### verdicts
- `VerdictForm` — watch status toggle + rating + review submission
- `VerdictList` — per-member verdict display
- `RecentVerdictsList` — dashboard quick view

### groups
- `GroupList` — dashboard group cards
- `DashboardStats` — aggregate stats across groups
- `DashboardHeader` — page header with user info

### auth
- `UsernameForm` — update username
- `PasswordForm` — change password

### admin
- `ScheduleEditor`, `PickerScheduleEditor`, `TurnOverrideEditor`, `UnlockControls`, `MemberManager`, `VoteOverridePanel`, `SettingsPanel`

## Cross-Domain Dependencies

```
verdicts  → groups (membership check)
movies    → turns (current weekOf)
admin     → all domains (read + override)
```
