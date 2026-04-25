# Movie Club Hub - Architecture & Design Document

## Overview

Movie Club Hub is a web application for managing movie watching groups. Members take turns picking movies, watch them together, and submit ratings/reviews. The system tracks turns, votes, and provides group analytics.

**Live URL**: https://ibi-gooch.com

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript, Vite, TailwindCSS, Radix UI, TanStack Query |
| Backend | Go 1.22+, Chi router, sqlc (type-safe SQL) |
| Database | PostgreSQL 15+ |
| Auth | Session-based (alexedwards/scs) with bcrypt password hashing |
| API Contract | OpenAPI 3.1 spec with orval-generated React hooks |
| Deployment | GCP Cloud Run + Cloud SQL |

## Project Structure

```
Movie-Club-Hub/
├── go-api/                      # Go backend
│   ├── cmd/
│   │   ├── server/              # Main API server (embeds static frontend)
│   │   ├── migrate/             # Database migration CLI
│   │   ├── seed/                # Database seeding CLI
│   │   └── reset-password/      # Password reset utility
│   ├── internal/
│   │   ├── db/                  # sqlc-generated database layer
│   │   ├── handler/             # HTTP handlers (controllers)
│   │   ├── service/             # Business logic layer
│   │   ├── middleware/          # Auth, rate limiting, logging
│   │   └── session/             # Session management
│   └── migrations/              # SQL migration files
│
├── artifacts/movie-club/        # React frontend
│   └── src/
│       ├── pages/               # Route components
│       ├── domains/             # Feature-organized components
│       │   ├── admin/           # Admin panel components
│       │   ├── auth/            # Login/register forms
│       │   ├── groups/          # Group management
│       │   ├── movies/          # Movie selection/display
│       │   ├── nominations/     # Nomination pool
│       │   ├── turns/           # Turn navigation logic
│       │   └── verdicts/        # Rating/review forms
│       ├── components/ui/       # Shared UI primitives (shadcn/ui)
│       ├── hooks/               # Custom React hooks
│       └── lib/                 # Utilities
│
├── lib/
│   ├── api-spec/                # OpenAPI specification
│   └── api-client-react/        # Generated API client (orval)
│
├── Makefile                     # Build & dev commands
└── docker-compose.yaml          # Local Postgres
```

## Database Schema

### Core Tables

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    users     │     │    groups    │     │ memberships  │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id           │◄────│ owner_id     │     │ user_id      │───►users
│ username     │     │ name         │     │ group_id     │───►groups
│ password_hash│     │ start_date   │     │ role         │ (owner/admin/member)
│ created_at   │     │ turn_length  │     │ joined_at    │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │    turns     │  (Single source of truth for scheduling)
                     ├──────────────┤
                     │ group_id     │
                     │ turn_index   │  (0, 1, 2, ...)
                     │ week_of      │  (turn start date)
                     │ picker_user  │───►users
                     │ start_date   │
                     │ end_date     │  (can be extended)
                     │ movie_unlock │
                     │ review_unlock│
                     └──────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │    movies    │  │   verdicts   │  │ watch_status │
   ├──────────────┤  ├──────────────┤  ├──────────────┤
   │ group_id     │  │ user_id      │  │ user_id      │
   │ week_of      │  │ group_id     │  │ group_id     │
   │ title        │  │ turn_id      │  │ week_of      │
   │ film_id      │──►films         │ week_of      │  │ watched      │
   │ set_by_user  │  │ rating       │  └──────────────┘
   │ nominator    │  │ review       │
   └──────────────┘  │ watched      │
                     └──────────────┘

   ┌──────────────┐  ┌──────────────┐
   │    films     │  │ nominations  │
   ├──────────────┤  ├──────────────┤
   │ imdb_id (UK) │  │ group_id     │
   │ title        │  │ user_id      │
   │ year         │  │ imdb_id      │
   │ poster_url   │  │ title        │
   │ director     │  │ year, poster │
   │ genre        │  └──────────────┘
   │ runtime      │
   └──────────────┘
```

### Supporting Tables

- **invites**: Group join codes with optional expiry
- **sessions**: SCS session store for auth
- **turn_extensions** (legacy): Extra days per turn index
- **turn_overrides** (legacy): Per-week admin overrides

## API Structure

### Endpoints by Domain

```
/api
├── /healthz                    GET     Health check
│
├── /auth
│   ├── /login                  POST    Session login
│   ├── /register               POST    Create account
│   ├── /logout                 POST    End session
│   ├── /me                     GET     Current user
│   └── /me/password            PUT     Change password
│
├── /dashboard                  GET     User's groups overview
│
├── /groups
│   ├── /                       GET     List user's groups
│   ├── /                       POST    Create group
│   ├── /:groupId               GET     Group detail + turn data
│   ├── /:groupId/status        GET     Voting status for turn
│   ├── /:groupId/admin/*       *       Admin operations
│   └── /:groupId/results       GET     Turn results + analytics
│
├── /movies
│   └── /:groupId/:weekOf       PUT     Set movie for turn
│
├── /verdicts
│   └── /:groupId/:weekOf       POST    Submit rating/review
│
├── /nominations
│   ├── /:groupId               GET     List nominations
│   ├── /:groupId               POST    Add nomination
│   └── /:groupId/:id           DELETE  Remove nomination
│
├── /invites
│   ├── /:groupId               POST    Generate invite code
│   ├── /validate/:code         GET     Validate code
│   └── /accept/:code           POST    Join group
│
└── /watch-status
    └── /:groupId/:weekOf       PUT     Mark watched/unwatched
```

## Frontend Architecture

### Page Structure

```
/                       → Login (or redirect to /dashboard if authed)
/dashboard              → Group list + summary cards
/groups/new             → Create group form
/groups/:id             → Main group view (current turn, movie, verdicts)
/groups/:id/admin       → Admin panel (picker schedule, overrides)
/groups/:id/results     → Turn results with charts
/profile                → User settings
/join                   → Enter invite code
/invite/:code           → Direct invite link
```

### Domain Components

```
domains/
├── admin/              # Admin-only functionality
│   └── components/
│       ├── GroupSettingsForm.tsx
│       ├── PickerScheduleEditor.tsx
│       ├── TurnOverrideEditor.tsx
│       ├── VerdictOverridePanel.tsx
│       ├── MemberRoleManager.tsx
│       ├── UnlockControls.tsx
│       └── OwnershipTransferDialog.tsx
│
├── auth/
│   └── components/
│       ├── PasswordForm.tsx
│       └── UsernameForm.tsx
│
├── groups/
│   └── components/
│       ├── GroupList.tsx
│       ├── DashboardHeader.tsx
│       └── DashboardStats.tsx
│
├── movies/
│   └── components/
│       ├── CurrentTurnMovie.tsx    # Display current movie
│       └── PickerMovieSelector.tsx # Movie search + select
│
├── nominations/
│   └── components/
│       └── NominationSheet.tsx     # Nomination pool UI
│
├── turns/
│   ├── turnUtils.ts                # Date/index calculations
│   ├── turnUtils.test.ts           # Navigation tests
│   └── components/
│       └── TurnStatusBanner.tsx    # Turn nav + status
│
└── verdicts/
    └── components/
        ├── VerdictForm.tsx         # Rating slider + review
        ├── VerdictList.tsx         # Display all verdicts
        └── RecentVerdictsList.tsx  # Dashboard widget
```

### State Management

- **Server state**: TanStack Query (React Query) with generated hooks
- **Local state**: React useState/useReducer
- **URL state**: Wouter for routing, query params for turn selection

### Key Hooks

```typescript
// API hooks (generated from OpenAPI)
useGetGroup(groupId, { weekOf })     // Group + turn data
useGetGroupStatus(groupId, { weekOf }) // Voting status
useGetDashboard()                    // User overview
useSubmitVerdict()                   // Rate movie
useSetMovie()                        // Picker sets movie

// Custom hooks
useTurnState(groupId, userId)        // Aggregated turn info
usePermissions(group)                // Role-based checks
useVerdictSubmission(groupId)        // Form state + submit
```

## Turn System

### Concepts

- **Turn**: A time period when one member (picker) chooses a movie
- **Turn Index**: Zero-based sequential number (0, 1, 2, ...)
- **Week Of**: Start date of the turn (YYYY-MM-DD format)
- **Turn Length**: Default days per turn (typically 7)
- **Extension**: Extra days added to a turn

### Turn Calculation Flow

```
1. Group has: start_date, turn_length_days
2. For each turn:
   - turn_index = sequential (0, 1, 2, ...)
   - week_of = start_date + cumulative_days
   - cumulative_days += turn_length + any_extensions
3. Current turn = turn containing today's date
```

### Navigation

- Back/Forward buttons adjust `selectedWeek` state
- `offsetWeekOf(currentWeek, ±1, config)` computes adjacent turn dates
- Back disabled at turn 0, forward disabled at cap (current + member_count)

## Authentication Flow

```
1. User submits username/password
2. Server validates credentials (bcrypt)
3. Server creates session (SCS with pgxstore)
4. Session token stored in HTTP-only cookie
5. Subsequent requests include cookie automatically
6. Middleware validates session on protected routes
```

## Deployment

### Local Development

```bash
make docker-up       # Start Postgres
make dev             # Start Go API (port 8080)
make fe-dev          # Start Vite dev server (port 5173, proxies /api)
```

### Production Build

```bash
make build           # Build frontend + embed in Go binary
make docker-build    # Build production Docker image
```

### GCP Deployment

```bash
make gcp-push        # Build + push to Artifact Registry
make gcp-deploy      # Deploy to Cloud Run
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| DATABASE_URL | Postgres connection string |
| SESSION_SECRET | Session encryption key |
| OMDB_API_KEY | OMDb API for movie metadata |
| PORT | Server port (default 8080) |

## Testing

### Backend (Go)

```bash
make test            # Run all tests
make test-verbose    # With detailed output
make test-cover      # Generate coverage report
```

Test files: `*_test.go` alongside source files

Key test suites:
- `turn_test.go` - Turn calculations
- `turn_json_test.go` - JSON serialization
- `turn_navigation_test.go` - Navigation edge cases

### Frontend (TypeScript)

```bash
cd artifacts/movie-club
pnpm test            # Run vitest
pnpm test:watch      # Watch mode
```

Test files: `*.test.ts` alongside source files

## Common Operations

### Add a new feature

1. Update OpenAPI spec (`lib/api-spec/openapi.yaml`)
2. Run `pnpm generate` to regenerate client
3. Add handler in `go-api/internal/handler/`
4. Add service logic if needed
5. Add frontend components in appropriate domain
6. Add tests

### Database changes

1. Create migration: `go-api/migrations/NNNNNN_description.{up,down}.sql`
2. Run `make migrate-up`
3. Regenerate sqlc: `make sqlc`

### Debug turn issues

1. Check `turns` table for group
2. Verify `week_of` dates align with expected schedule
3. Check for extensions in `turn_extensions` (legacy) or `end_date` adjustments
4. Run turn navigation tests: `go test -v -run Navigation`
