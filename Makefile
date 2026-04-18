.PHONY: help \
        dev fe-dev fe-serve install \
        build frontend copy-frontend clean \
        test test-verbose test-cover lint fe-typecheck typecheck sqlc \
        docker-up docker-down docker-logs \
        migrate-up migrate-down \
        seed \
        db-proxy \
        docker-build docker-run \
        gcp-auth gcp-push gcp-deploy gcp-logs gcp-status gcp-url \
        ci-test

# ─── Load .env if present ─────────────────────────────────────────────────────
-include .env
export

# ─── Variables ────────────────────────────────────────────────────────────────

# Local database URLs
DATABASE_URL ?= pgx5://dev:dev@localhost:5433/movieclub?sslmode=disable
DEV_DB_URL   ?= postgres://dev:dev@localhost:5433/movieclub?sslmode=disable

# GCP / Cloud Run — set GCP_PROJECT_ID in your environment or on the command line
GCP_PROJECT_ID ?=
REGION         := us-central1
SERVICE        := movieclub
REGISTRY       := us-central1-docker.pkg.dev/$(GCP_PROJECT_ID)/movieclub/server
TAG            ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo latest)

# ─── Help ─────────────────────────────────────────────────────────────────────

.DEFAULT_GOAL := help

help: ## List all available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Local Development ────────────────────────────────────────────────────────

install: ## Install all pnpm dependencies
	pnpm install

dev: ## Run Go API server locally (requires postgres — run make docker-up first)
	cd go-api && DATABASE_URL="$(DEV_DB_URL)" SESSION_SECRET="dev-secret" PORT=8080 go run ./cmd/server

fe-dev: ## Run React frontend dev server with HMR
	pnpm --filter movie-club dev

fe-serve: ## Preview the production frontend build locally
	pnpm --filter movie-club serve

# ─── Build ────────────────────────────────────────────────────────────────────

build: frontend copy-frontend ## Full production build: React frontend + Go binary
	cd go-api && go build -o bin/server ./cmd/server

frontend: ## Build the React frontend
	pnpm --filter movie-club build

copy-frontend: ## Copy React build output into the Go embed directory
	rm -rf go-api/cmd/server/static/*
	cp -r artifacts/movie-club/dist/public/. go-api/cmd/server/static/

clean: ## Remove all build artifacts and stray Go binaries
	rm -rf go-api/bin/
	rm -rf go-api/cmd/server/static/*
	rm -rf artifacts/movie-club/dist/
	rm -f go-api/coverage.out
	rm -f go-api/server go-api/seed go-api/reset-password

# ─── Testing & Quality ────────────────────────────────────────────────────────

test: ## Run Go tests
	cd go-api && go test ./...

test-verbose: ## Run Go tests with verbose output
	cd go-api && go test -v ./...

test-cover: ## Run Go tests and open an HTML coverage report
	cd go-api && go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out

lint: ## Run go vet
	cd go-api && go vet ./...

fe-typecheck: ## Type-check the React frontend
	pnpm --filter movie-club typecheck

typecheck: ## Type-check everything (libs + frontend)
	pnpm typecheck

sqlc: ## Regenerate sqlc models from SQL queries
	cd go-api && sqlc generate

# ─── Local Database ───────────────────────────────────────────────────────────

docker-up: ## Start local PostgreSQL via Docker Compose
	docker compose up -d postgres

docker-down: ## Stop all Docker Compose services and remove containers
	docker compose down

docker-logs: ## Stream Docker Compose logs
	docker compose logs -f

migrate-up: ## Apply all pending database migrations
	cd go-api && go run -tags migrate cmd/migrate/main.go -dir migrations -db "$(DATABASE_URL)" up

migrate-down: ## Roll back the most recent database migration
	cd go-api && go run -tags migrate cmd/migrate/main.go -dir migrations -db "$(DATABASE_URL)" down 1

seed: ## Seed the database from embedded JSON fixtures (set DATABASE_URL first)
	cd go-api && DATABASE_URL="$(DATABASE_URL)" go run ./cmd/seed

seed-fresh: ## Wipe the database and re-seed from scratch
	cd go-api && DATABASE_URL="$(DEV_DB_URL)" go run ./cmd/seed -reset

reset-password: ## Reset a user's password: make reset-password ENV=dev USER=adnan PASS=newpassword
	@test -n "$(ENV)"  || (echo "error: ENV is required (dev or prod)" && exit 1)
	@test -n "$(USER)" || (echo "error: USER is required" && exit 1)
	@test -n "$(PASS)" || (echo "error: PASS is required" && exit 1)
	cd go-api && go run ./cmd/reset-password "$(ENV)" "$(USER)" "$(PASS)"

db-proxy: ## Open Cloud SQL Auth Proxy on localhost:5454 (use for Postico / psql)
	@test -n "$(GCP_PROJECT_ID)" || (echo "error: GCP_PROJECT_ID is not set" && exit 1)
	cloud-sql-proxy \
		--port 5454 \
		"$(CLOUD_SQL_CONNECTION_NAME)"

# ─── Docker (production image) ────────────────────────────────────────────────

docker-build: ## Build the production Docker image
	docker build -t movieclub .

docker-run: ## Run the production Docker image locally against local postgres
	docker run --rm -p 8080:8080 \
		-e DATABASE_URL="$(DEV_DB_URL)" \
		-e SESSION_SECRET=dev-secret \
		-e OMDB_API_KEY="$(OMDB_API_KEY)" \
		movieclub

# ─── GCP / Cloud Run ──────────────────────────────────────────────────────────
# Set GCP_PROJECT_ID in your environment before using these targets.
# Example: GCP_PROJECT_ID=my-project make gcp-push

gcp-auth: ## Authenticate Docker with GCP Artifact Registry
	gcloud auth configure-docker us-central1-docker.pkg.dev --quiet

gcp-push: ## Build and push the Docker image to Artifact Registry (linux/amd64 for Cloud Run)
	@test -n "$(GCP_PROJECT_ID)" || (echo "error: GCP_PROJECT_ID is not set" && exit 1)
	docker build \
		--platform linux/amd64 \
		--tag "$(REGISTRY):$(TAG)" \
		--tag "$(REGISTRY):latest" \
		.
	docker push "$(REGISTRY):$(TAG)"
	docker push "$(REGISTRY):latest"

gcp-deploy: ## Deploy the image to Cloud Run (CI manages secrets/Cloud SQL; use this for quick manual pushes)
	@test -n "$(GCP_PROJECT_ID)" || (echo "error: GCP_PROJECT_ID is not set" && exit 1)
	gcloud run deploy $(SERVICE) \
		--image "$(REGISTRY):$(TAG)" \
		--region $(REGION) \
		--platform managed \
		--quiet

gcp-logs: ## Tail Cloud Run service logs
	@test -n "$(GCP_PROJECT_ID)" || (echo "error: GCP_PROJECT_ID is not set" && exit 1)
	gcloud beta logging tail \
		"resource.type=cloud_run_revision AND resource.labels.service_name=$(SERVICE) AND resource.labels.location=$(REGION)" \
		--project="$(GCP_PROJECT_ID)"

gcp-status: ## Describe the Cloud Run service (replicas, env, traffic split)
	@test -n "$(GCP_PROJECT_ID)" || (echo "error: GCP_PROJECT_ID is not set" && exit 1)
	gcloud run services describe $(SERVICE) --region $(REGION) --project="$(GCP_PROJECT_ID)"

gcp-url: ## Print the public URL of the deployed service
	@test -n "$(GCP_PROJECT_ID)" || (echo "error: GCP_PROJECT_ID is not set" && exit 1)
	@gcloud run services describe $(SERVICE) \
		--region $(REGION) \
		--project="$(GCP_PROJECT_ID)" \
		--format='value(status.url)'

# ─── CI ───────────────────────────────────────────────────────────────────────

ci-test: ## Run the same test suite that the CI pipeline runs
	cd go-api && go test ./...
