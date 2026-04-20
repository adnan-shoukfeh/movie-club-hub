# Architecture

## Overview

Movie Club Hub uses a **domain-driven architecture** on both frontend and backend. Business logic lives in domain services (Go) and domain hooks (React), not in HTTP handlers or UI components.

## Layers

### Backend

```
cmd/server/main.go          → HTTP server setup, router, middleware wiring
internal/handler/           → HTTP handlers (thin: validate input, call service, write response)
internal/service/           → Domain services (business logic, no HTTP)
internal/db/                → SQLC-generated type-safe queries
internal/middleware/        → HTTP middleware (auth, rate limiting, logging)
internal/session/           → Session management (scs)
```

### Frontend

```
src/pages/                  → Page-level components (thin: compose domain components)
src/domains/*/components/   → Domain-specific UI components
src/hooks/                  → Cross-domain hooks (useTurnState, usePermissions, etc.)
lib/api-client-react/       → ORVAL-generated TanStack Query hooks from OpenAPI spec
```

## Key Principles

### Single Source of Truth

- **Turn deadline**: `service.GetEffectiveDeadline()` — one function used by all callers
- **Current picker**: `service.GetPicker()` — canonical source is `picker_assignments` table; rotation is a fallback that persists
- **Verdict + watch status**: `VerdictService.SubmitVerdict()` — transactional write to both `watch_status` and `votes` tables

### Service Pattern

Services receive `*db.Queries` and `Config`. They have no HTTP dependencies and are testable in isolation.

```go
type VerdictService struct {
    queries *db.Queries
    pool    *pgxpool.Pool
    config  Config
}
```

### Terminology

The domain uses **"verdict"** (not "vote") to represent a user's assessment of a movie. A verdict encompasses watch status + optional rating + optional review. The DB table is still named `votes` (schema migration deferred); all code above the DB layer uses `Verdict`.

## Docs

- `docs/architecture/domains.md` — Domain responsibilities and cross-domain dependencies
- `docs/roadmap/` — Task tracking with active/backlog/done structure
