# Movie Club Hub — Roadmap

A running list of features, improvements, and technical work. Add ideas anywhere; move them into a priority bucket when they're ready to be worked on.

---

## P0 — Critical / Do First

| Task | Notes | Effort |
|------|-------|--------|
| Set up GCP dev environment | Dedicated GCP environment + git branch for staging/dev; local Docker dev already works | M |
| Fix invite code system | One shared invite code for all admins at a time; visible in the same place it's currently generated; persists until manually regenerated | S |
| Add rate limiting | Protect API endpoints from abuse | S |

## P1 — High Value

| Task | Notes | Effort |
|------|-------|--------|
| Rating slider gating | Only show the rating slider after a user marks a movie as watched; moving back to "unwatched" clears the rating (but restores it if they re-mark watched) | S |
| Movie title links | Clicking a movie title opens either the IMDb page or an internal movie detail page (populated via OMDb + nominations, picks, and reviews) | M |
| Profile images | Allow users to upload/set a profile photo | M |

## P2 — Nice to Have

| Task | Notes | Effort |
|------|-------|--------|
| Review reactions | Users can react to reviews (e.g. "sleeper pick") | S |
| Review replies | Threaded responses to reviews (follow-on from reactions) | M |
| Add logo | Brand identity for the app | S |
| Add tests | CI/CD and local dev test suites | S |

## P3 — Technical Debt / Infrastructure

| Task | Notes | Effort |
|------|-------|--------|
| Refactor into smaller components | Break up large handlers/components incrementally, one at a time | L |
---

## Completed

| Task | Notes |
|------|-------|
| Go backend rewrite | `go-api/` exists with full structure (cmd, internal, migrations, sqlc); Docker + docker-compose in place |

---

## Effort Scale
`S` = hours · `M` = 1–2 days · `L` = ~1 week · `XL` = multi-week
