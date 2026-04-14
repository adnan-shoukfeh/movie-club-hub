# Stage 1: Build React frontend
FROM node:24-alpine AS frontend
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY artifacts/movie-club/package.json ./artifacts/movie-club/
COPY lib/ ./lib/
RUN pnpm install --frozen-lockfile --filter movie-club...
COPY artifacts/movie-club/ ./artifacts/movie-club/
RUN pnpm --filter movie-club build

# Stage 2: Build Go binary
FROM golang:1.25-alpine AS backend
WORKDIR /app/go-api
COPY go-api/go.mod go-api/go.sum ./
RUN go mod download
COPY go-api/ ./
COPY --from=frontend /app/artifacts/movie-club/dist/public ./cmd/server/static/
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

# Stage 3: Minimal runtime
FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=backend /server /server
COPY go-api/migrations/ /migrations/
EXPOSE 8080
CMD ["/server"]
