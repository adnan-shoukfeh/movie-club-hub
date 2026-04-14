# Movie Club Hub

A web app for managing a rotating movie club. Groups of people take turns picking a film, nominate titles in advance, rate and review each week's watch, and track who has actually seen it — all in one place.

## What it does

- **Groups & invites** — create a club, invite members via a shareable link, and assign roles (member, admin, owner)
- **Turn rotation** — each turn a designated picker selects the movie; the schedule advances automatically based on configurable turn lengths
- **Movie search** — search for films via the OMDb API; poster, director, genre, runtime, and year are fetched and stored automatically
- **Nominations** — members can queue up suggestions for the current picker to choose from
- **Ratings & reviews** — members submit a numeric rating and optional written review per film
- **Watch status** — members mark whether they watched the movie that turn
- **Admin controls** — admins can override the picker, extend a turn, unlock movie selection or reviews early, override votes, and transfer group ownership

## What it contains

```
.
├── go-api/                    # Go backend
│   ├── cmd/server/            # Main HTTP server binary
│   ├── cmd/migrate/           # Standalone migration runner
│   ├── cmd/seed/              # Import data from JSON fixtures into the DB
│   ├── cmd/prune-movies/      # Remove orphaned movies outside valid turn boundaries
│   ├── internal/
│   │   ├── db/                # sqlc-generated database layer
│   │   ├── handler/           # HTTP handlers (auth, groups, movies, votes, ...)
│   │   ├── middleware/        # Auth guard, request logger
│   │   └── session/           # PostgreSQL-backed session manager (scs)
│   └── migrations/            # SQL migration files (golang-migrate)
├── artifacts/movie-club/      # React frontend (Vite + TypeScript + Tailwind + Radix UI)
├── lib/
│   ├── api-client-react/      # Generated API client (React Query hooks)
│   └── db/                    # Shared TypeScript DB schema types
├── scripts/                   # Workspace utility scripts
├── Dockerfile                 # Multi-stage production build
├── docker-compose.yml         # Local PostgreSQL
└── .github/workflows/
    └── deploy.yml             # CI: test → build → push → Cloud Run deploy
```

**Backend:** Go 1.25 · chi · pgx/v5 · sqlc · golang-migrate · scs sessions
**Frontend:** React · Vite · TypeScript · Tailwind CSS · Radix UI · TanStack Query · Zod · wouter
**Database:** PostgreSQL 16
**Infra:** Docker · GCP Cloud Run · Artifact Registry · Cloud SQL

## Requirements

| Tool | Version | Purpose |
|---|---|---|
| Go | 1.25+ | Backend |
| Node.js | 24+ | Frontend toolchain |
| pnpm | 9+ (via corepack) | JS package manager |
| Docker | any recent | Local database + production image |
| Docker Compose | v2 | Local dev orchestration |
| sqlc | latest | Regenerate DB layer from SQL (optional) |
| gcloud CLI | any recent | GCP deployments (optional) |

Install pnpm via corepack if you don't have it:

```sh
corepack enable
```

## Environment variables

The server reads these from the process environment. Variables marked **required** will cause the server to exit on startup if missing.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string. Use `postgres://` scheme for the dev server; migrations also accept `pgx5://`. |
| `SESSION_SECRET` | Yes (prod) | `movie-club-dev-secret` | Random secret used to sign session cookies. Set a strong value in production. |
| `OMDB_API_KEY` | No | — | API key from [omdbapi.com](https://www.omdbapi.com/). Required for movie search to work. |
| `PORT` | No | `8080` | HTTP port the server listens on. |
| `LOG_LEVEL` | No | `info` | Structured log verbosity: `debug`, `info`, `warn`, or `error`. |
| `MIGRATION_DIR` | No | `migrations` | Path to the SQL migration files. Overridden to `/migrations` in the production Docker image. |
| `NODE_ENV` | No | — | Set to `production` to enable `Secure` flag on session cookies. |

For local development create a `.env` file (not committed) or export these in your shell:

```sh
export DATABASE_URL="postgres://dev:dev@localhost:5433/movieclub?sslmode=disable"
export SESSION_SECRET="change-me"
export OMDB_API_KEY="your-omdb-key"
```

## Running locally

### 1. Install dependencies

```sh
make install
```

### 2. Start PostgreSQL

```sh
make docker-up
```

This starts a PostgreSQL 16 container on port `5433` (to avoid conflicting with a local install on `5432`).

### 3. Run database migrations

```sh
make migrate-up
```

Migrations run automatically on server startup too, but running them once now means the first boot is faster.

### 4. Start the backend

```sh
make dev
```

The Go server starts on `http://localhost:8080`. It serves both the API (`/api/...`) and the embedded React SPA.

### 5. (Optional) Start the frontend dev server

For hot module replacement during frontend work, run the Vite dev server in a second terminal:

```sh
make fe-dev
```

The dev server starts on `http://localhost:5173` and proxies API calls to the Go server.

## Running with Docker

Build and run the full production image locally:

```sh
make docker-up          # start postgres
make docker-build       # build the image
make docker-run         # run the image against local postgres
```

The production image is a multi-stage build: it compiles the React frontend, then the Go binary, and produces a minimal Alpine runtime image (~20 MB).

## All available commands

Run `make` (or `make help`) to see every target with a description:

```
make help
```

Key groups:

| Category | Commands |
|---|---|
| Local dev | `dev`, `fe-dev`, `fe-serve`, `install` |
| Build | `build`, `frontend`, `copy-frontend`, `clean` |
| Test & quality | `test`, `test-verbose`, `test-cover`, `lint`, `typecheck`, `fe-typecheck`, `sqlc` |
| Database | `docker-up`, `docker-down`, `docker-logs`, `migrate-up`, `migrate-down`, `seed`, `db-proxy` |
| Docker | `docker-build`, `docker-run` |
| GCP | `gcp-auth`, `gcp-push`, `gcp-deploy`, `gcp-logs`, `gcp-status`, `gcp-url` |

## CI / CD

GitHub Actions runs on every push to `main`:

1. **Test** — `go test ./...`
2. **Build & push** — builds the Docker image and pushes two tags (`latest` + commit SHA) to GCP Artifact Registry
3. **Deploy** — deploys the commit-SHA-tagged image to Cloud Run with Cloud SQL, secrets from Secret Manager, and zero-to-three auto-scaling

The workflow requires these GitHub secrets:

| Secret | Description |
|---|---|
| `GCP_PROJECT_ID` | GCP project ID |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload identity provider for keyless auth |
| `GCP_SERVICE_ACCOUNT` | Service account email for deployment |
| `CLOUD_SQL_CONNECTION_NAME` | Cloud SQL instance connection name |

Database credentials, session secret, and OMDb key are stored in GCP Secret Manager and mounted at runtime — they are never in the image or workflow.

## GCP manual deployment

For a one-off manual push (assuming you are already authenticated with `gcloud`):

```sh
export GCP_PROJECT_ID=your-project-id

make gcp-auth      # configure Docker for Artifact Registry
make gcp-push      # build + push image (tagged with current git SHA)
make gcp-deploy    # deploy to Cloud Run
make gcp-url       # print the live service URL
```

Note: manual deploys via the Makefile skip the Cloud SQL and Secret Manager flags that the CI workflow sets. Use these targets for quick iteration on an already-configured service, not for first-time setup.
