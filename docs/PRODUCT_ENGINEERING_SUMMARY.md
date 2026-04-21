# Movie Club Hub — Product Engineering Summary

**Date:** 2026-04-19
**Purpose:** Context document for PRD drafting and future implementation planning

---

## 1. Product Overview

Movie Club Hub is a web application for managing rotating movie clubs. Groups of people take turns picking films, nominate titles in advance, rate and review each week's watch, and track who has actually seen it.

### Core Value Proposition

- **Organized rotation system** — automatic picker scheduling with configurable turn lengths
- **Movie discovery** — OMDb-powered search with poster, director, genre, runtime, and year metadata
- **Community engagement** — nominations from group members, ratings, and written reviews
- **Accountability tracking** — watch status for each member per turn

### Target Users

- Friend groups running weekly/bi-weekly movie clubs
- Small private communities (10–30 members typical)
- Users who want structure without spreadsheet overhead

---

## 2. Technical Architecture

### Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Go 1.25, chi router, pgx/v5 |
| **Database** | PostgreSQL 16 with sqlc-generated queries |
| **Sessions** | scs (alexedwards/scs) with PostgreSQL store |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Radix UI |
| **Data Fetching** | TanStack Query with generated React Query hooks |
| **Routing** | wouter (client-side SPA) |
| **Infrastructure** | Docker, GCP Cloud Run, Cloud SQL, Artifact Registry |
| **CI/CD** | GitHub Actions (test → build → push → deploy) |

### Repository Structure

```
Movie-Club-Hub/
├── go-api/
│   ├── cmd/server/          # Main HTTP server
│   ├── cmd/seed/            # JSON fixture importer
│   ├── internal/
│   │   ├── db/              # sqlc-generated database layer
│   │   ├── handler/         # HTTP handlers (auth, groups, movies, votes, admin)
│   │   ├── middleware/      # Auth guard, logger, rate limiter
│   │   └── session/         # PostgreSQL-backed session manager
│   └── migrations/          # SQL migrations (golang-migrate)
├── artifacts/movie-club/    # React frontend
│   └── src/
│       ├── pages/           # Route components
│       ├── components/ui/   # Radix-based component library
│       └── lib/             # Generated API client, utilities
├── lib/
│   ├── api-client-react/    # Generated React Query hooks
│   └── db/                  # Shared TypeScript DB types
├── Dockerfile               # Multi-stage production build (~20MB)
└── .github/workflows/
    └── deploy.yml           # CI/CD pipeline
```

### Data Model (Core Entities)

| Table | Purpose |
|-------|---------|
| `users` | User accounts (username, bcrypt password hash) |
| `groups` | Movie clubs (name, owner, start date, turn length) |
| `memberships` | User-group relationships with roles (member/admin/owner) |
| `movies` | Selected films per turn (OMDb metadata, picker, nominator) |
| `votes` | Ratings (0.0–10.0) and reviews per user/group/week — domain type `Verdict` (watch status + rating + review); DB table name retained for schema stability |
| `picker_assignments` | Who picks for which week |
| `nominations` | Pool of suggested movies from group members |
| `watch_status` | Per-user watched/not-watched flag per turn |
| `turn_overrides` | Admin adjustments (extended days, start offset, unlock flags) |
| `invites` | Shareable invite codes for joining groups |

---

## 3. Implemented Features

### Authentication & User Management

- **Registration/Login** — username + password with bcrypt hashing
- **Session management** — PostgreSQL-backed sessions via scs
- **Profile page** — users can update username and password (`/profile`)
- **Rate limiting** — token bucket limiter on auth (10/min) and search (20/min) endpoints

### Group Management

- **Create group** — owner becomes admin automatically
- **Invite system** — shareable invite codes; members join via link
- **Role system** — member, admin, owner with escalating permissions
- **Member management** — kick members, change roles, transfer ownership

### Turn System

- **Automatic scheduling** — turns calculated from group start date + turn length
- **Picker rotation** — round-robin assignment among members
- **Flexible deadlines** — admins can extend or shorten turns via calendar picker
- **Turn start adjustment** — admins can shift when a turn begins (added in migration 0002)
- **Early unlocks** — admins can unlock movie selection or reviews before deadline

### Movie Selection

- **OMDb search** — real-time movie search with caching
- **IMDb ID search** — direct lookup by IMDb code
- **Metadata capture** — poster, director, genre, runtime, year stored automatically
- **Nomination pool** — members suggest movies; picker chooses from pool or searches new

### Verdicts

- **Numeric rating** — wheel picker UI (0.0–10.0 in 0.5 increments)
- **Written reviews** — optional text review per rating
- **Watch-status gating** — rating UI only visible when user marks "Watched" (implemented Apr 18)
- **Results page** — aggregated ratings, individual reviews, navigable from dashboard
- **Verdict model** — watch status + rating + review unified as a single `Verdict` domain type; submitted and deleted as one unit

### Admin Panel

- **Picker schedule** — view/edit picker assignments for upcoming turns
- **Date range controls** — combined start/deadline calendar picker per turn
- **Vote management** — view all votes, override ratings, delete votes
- **Group settings** — update start date, turn length
- **Nomination management** — delete inappropriate nominations
- **Movie management** — delete movie selections

### Dashboard

- **My groups** — list of groups user belongs to
- **Recent results** — clickable cards linking to past results
- **Navigation** — gear icon to profile, IMDB links from movie posters

---

## 4. Recent Development (Last 2 Weeks)

| Date | Feature | Status |
|------|---------|--------|
| Apr 7–8 | Initial migration from Replit, Docker setup | Done |
| Apr 13 | Go backend rewrite complete | Done |
| Apr 14 | GCP deployment, CI/CD pipeline | Done |
| Apr 16 | Calendar date picker in admin panel | Done |
| Apr 16 | User profile page (username/password update) | Done |
| Apr 16 | Turn deadline slider → calendar picker | Done |
| Apr 16 | Turn start date adjustment | Done |
| Apr 16 | Movie click navigation (dashboard results, IMDB links) | Done |
| Apr 17 | Admin picker schedule combined date range input | Done |
| Apr 17–18 | Rate limiting middleware with tests | Done |
| Apr 18 | Watch-status gates rating UI | Done |

---

## 5. Roadmap Snapshot

### P0 — Critical

| Task | Notes | Effort |
|------|-------|--------|
| Set up GCP dev environment | Dedicated staging/dev branch + GCP project | M |
| Fix invite code system | Single shared code per group, visible to admins, persists until regenerated | S |
| ~~Add rate limiting~~ | **Done** — auth (10/min), search (20/min) | ~~S~~ |

### P1 — High Value

| Task | Notes | Effort |
|------|-------|--------|
| ~~Rating slider gating~~ | **Done** — rating UI gated on watch status | ~~S~~ |
| Movie title links | Click title → IMDb page or internal detail page with OMDb + nominations + reviews | M |
| Profile images | User-uploaded profile photos | M |

### P2 — Nice to Have

| Task | Notes | Effort |
|------|-------|--------|
| Review reactions | Reactions on reviews (e.g., "sleeper pick") | S |
| Review replies | Threaded responses to reviews | M |
| Add logo | Brand identity | S |
| Add tests | CI/CD + local test suites | S |

### P3 — Technical Debt

| Task | Notes | Effort |
|------|-------|--------|
| Refactor into smaller components | Break up large handlers/pages incrementally | L |

---

## 6. Key Technical Decisions

### Why Go for the Backend?

- Previous Replit version used Node.js/TypeScript
- Rewrite to Go for: single binary deployment, smaller Docker images, better performance under Cloud Run's scale-to-zero model
- sqlc for type-safe SQL without ORM overhead

### Session Strategy

- PostgreSQL-backed sessions (not JWT) for simplicity + revocability
- Session cookie with `Secure` flag in production
- No need for token refresh logic

### Rate Limiting Approach

- Per-instance in-memory token bucket (golang.org/x/time/rate)
- Under Cloud Run autoscaling, effective limit is per-instance (acceptable for small private app)
- Key functions: IP-based (auth endpoints), user ID (authenticated endpoints)

### Frontend Architecture

- Single SPA embedded in Go binary (no separate frontend deployment)
- React Query for server state, no global client state library
- Radix UI primitives with Tailwind styling (custom component library in `components/ui/`)
- Generated API client from OpenAPI-like definitions

### Deployment Model

- Cloud Run with scale-to-zero (0–3 instances)
- Cloud SQL PostgreSQL (managed)
- Secrets in GCP Secret Manager (DATABASE_URL, SESSION_SECRET, OMDB_API_KEY)
- ~20MB production image via multi-stage Docker build

---

## 7. Design System & UI Patterns

### Visual Language

- Dark theme (purple/violet accent colors)
- Card-based layout with rounded corners
- Radix Popover/Calendar for date inputs
- Wheel picker for ratings (mobile-friendly)
- Sticky headers with back navigation

### Key Components (in `components/ui/`)

- `Calendar` — date picker
- `Popover` — floating overlay
- `Dialog` — modal confirmations
- `Select` — styled dropdowns
- `Input`, `Button`, `Textarea` — form primitives
- `Sheet` — bottom sheet for mobile (nominations pool)

### Page Structure

| Page | Route | Description |
|------|-------|-------------|
| Login/Register | `/` | Auth forms |
| Dashboard | `/dashboard` | Group list, recent results |
| Profile | `/profile` | Username/password update |
| Group Detail | `/groups/:id` | Current turn, nominations, rating |
| Group Results | `/groups/:id/results` | Past turn results |
| Group Admin | `/groups/:id/admin` | Admin controls |
| Accept Invite | `/invite/:code` | Join flow |

---

## 8. API Surface

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account (rate limited) |
| POST | `/api/auth/login` | Login (rate limited) |
| POST | `/api/auth/logout` | Logout (authenticated) |
| GET | `/api/me` | Current user |
| PATCH | `/api/me/username` | Update username |
| PATCH | `/api/me/password` | Update password |

### Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | List user's groups |
| POST | `/api/groups` | Create group |
| GET | `/api/groups/:id` | Group detail with current turn |
| GET | `/api/groups/:id/status` | Voting/deadline status |
| POST | `/api/groups/:id/kick` | Remove member |
| POST | `/api/groups/:id/role` | Change member role |

### Movies & Verdicts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/movies/search` | OMDb search (rate limited) |
| POST | `/api/groups/:id/movie` | Set turn's movie |
| POST | `/api/groups/:id/verdict` | Submit verdict (watch status + rating + review) |
| DELETE | `/api/groups/:id/verdict` | Delete own verdict |
| GET | `/api/groups/:id/verdicts` | Get verdicts for current turn |
| POST | `/api/groups/:id/watch-status` | Set watched flag |
| POST | `/api/groups/:id/vote` | Submit verdict (legacy alias) |
| DELETE | `/api/groups/:id/vote` | Delete verdict (legacy alias) |
| GET | `/api/groups/:id/results` | Turn results (legacy alias) |

### Nominations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups/:id/nominations` | List nominations |
| POST | `/api/groups/:id/nominations` | Add nomination |
| DELETE | `/api/groups/:id/nominations/:nomId` | Remove own nomination |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/groups/:id/schedule` | Picker schedule |
| POST | `/api/admin/groups/:id/picker` | Override picker |
| POST | `/api/admin/groups/:id/extend-turn` | Extend/shorten deadline |
| POST | `/api/admin/groups/:id/turn-start` | Adjust turn start date |
| POST | `/api/admin/groups/:id/unlock-movie` | Early movie unlock |
| POST | `/api/admin/groups/:id/unlock-reviews` | Early review unlock |
| GET | `/api/admin/groups/:id/votes` | View all votes |
| POST | `/api/admin/groups/:id/vote-override` | Override a vote |
| PATCH | `/api/admin/groups/:id/settings` | Update group settings |
| POST | `/api/admin/groups/:id/transfer-ownership` | Transfer ownership |

---

## 9. Development Workflow

### Local Setup

```bash
make install          # Install pnpm dependencies
make docker-up        # Start PostgreSQL container (port 5433)
make migrate-up       # Apply database migrations
make dev              # Start Go server (port 8080)
make fe-dev           # Optional: Vite dev server with HMR (port 5173)
```

### Testing

```bash
make test             # Run Go tests
make test-cover       # Coverage report
make lint             # go vet
make typecheck        # TypeScript type-check (frontend + libs)
```

### Deployment

- Push to `main` triggers GitHub Actions
- Pipeline: test → build Docker image → push to Artifact Registry → deploy to Cloud Run
- Manual: `make gcp-push && make gcp-deploy`

---

## 10. Open Questions for PRD Discussions

### Product Direction

1. **Mobile app or PWA?** — Current web app works on mobile but no native features
2. **Notifications?** — Email/push for new picks, deadline reminders, new reviews
3. **Discovery features?** — Public groups, group search, trending movies across platform
4. **Gamification?** — Streaks, badges, leaderboards, "sleeper pick" awards

### Feature Depth

1. **Movie detail page** — Internal page with full OMDb data + all nominations/reviews vs. always link to IMDb?
2. **Review reactions** — Emoji reactions, upvotes, or custom tags?
3. **Review replies** — Threaded vs. flat?
4. **Profile images** — Upload vs. avatar picker vs. Gravatar integration?

### Technical Decisions

1. **Dev/staging environment** — Separate GCP project or same project with different Cloud Run service?
2. **Invite code UX** — Per-group single code vs. per-invite unique codes?
3. **Test coverage targets** — What level of coverage for backend handlers?
4. **Component refactoring** — Which large files (group-detail at 61KB, group-admin at 58KB) to split first?

---

## 11. Metrics to Consider

### Engagement

- Active groups per week
- Movies watched per group per month
- Average rating submissions per turn
- Review length distribution

### Retention

- Users returning week over week
- Groups with consistent activity (no skipped turns)
- Time from group creation to first movie pick

### Quality

- API response times (p50, p95)
- Error rates by endpoint
- Cloud Run cold start frequency

---

## 12. Reference Links

- **Design Specs:** `docs/superpowers/specs/`
- **Implementation Plans:** `docs/superpowers/plans/`
- **Roadmap:** `ROADMAP.md`
- **Local Tasks:** `.local/tasks/`

---

*Last updated: 2026-04-20*
