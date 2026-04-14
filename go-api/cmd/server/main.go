package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/handler"
	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/middleware"
	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/session"
)

//go:embed all:static
var staticFS embed.FS

func main() {
	// Logger
	level := slog.LevelInfo
	if l := os.Getenv("LOG_LEVEL"); l != "" {
		switch strings.ToLower(l) {
		case "debug":
			level = slog.LevelDebug
		case "warn":
			level = slog.LevelWarn
		case "error":
			level = slog.LevelError
		}
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level}))
	slog.SetDefault(logger)

	// Database
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		slog.Error("DATABASE_URL is required")
		os.Exit(1)
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(context.Background()); err != nil {
		slog.Error("failed to ping database", "error", err)
		os.Exit(1)
	}
	slog.Info("connected to database")

	// Auto-migrate on startup
	migrationDir := os.Getenv("MIGRATION_DIR")
	if migrationDir == "" {
		migrationDir = "migrations"
	}
	pgxURL := strings.Replace(dbURL, "postgres://", "pgx5://", 1)
	pgxURL = strings.Replace(pgxURL, "postgresql://", "pgx5://", 1)
	if m, err := migrate.New("file://"+migrationDir, pgxURL); err != nil {
		slog.Warn("migrations unavailable", "error", err)
	} else {
		if err := m.Up(); err != nil && err != migrate.ErrNoChange {
			slog.Error("migration failed", "error", err)
			os.Exit(1)
		}
		m.Close()
		slog.Info("migrations applied")
	}

	queries := db.New(pool)

	// Session manager
	sessionSecret := os.Getenv("SESSION_SECRET")
	if sessionSecret == "" {
		sessionSecret = "movie-club-dev-secret"
	}
	sm := session.NewManager(pool, sessionSecret)

	// Router
	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.Logger)
	r.Use(chimw.Recoverer)
	r.Use(sm.LoadAndSave)

	// API routes
	h := handler.New(queries, pool, sm)
	r.Route("/api", func(r chi.Router) {
		r.Get("/health", h.HealthCheck)

		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", h.Register)
			r.Post("/login", h.Login)
			r.With(middleware.RequireAuth(sm)).Post("/logout", h.Logout)
			r.With(middleware.RequireAuth(sm)).Get("/me", h.Me)
		})

		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth(sm))

			r.Get("/groups", h.ListGroups)
			r.Post("/groups", h.CreateGroup)
			r.Get("/groups/{groupId}", h.GetGroup)
			r.Get("/groups/{groupId}/status", h.GetGroupStatus)
			r.Post("/groups/{groupId}/kick", h.KickMember)
			r.Post("/groups/{groupId}/role", h.UpdateMemberRole)
			r.Post("/groups/{groupId}/picker", h.AssignPicker)
			r.Post("/groups/{groupId}/turns/{turnIndex}/extension", h.SetTurnExtension)

			r.Get("/movies/search", h.SearchMovies)
			r.Post("/groups/{groupId}/movie", h.SetMovie)

			r.Post("/groups/{groupId}/vote", h.SubmitVote)
			r.Delete("/groups/{groupId}/vote", h.DeleteVote)
			r.Get("/groups/{groupId}/results", h.GetResults)

			r.Get("/groups/{groupId}/nominations", h.ListNominations)
			r.Post("/groups/{groupId}/nominations", h.CreateNomination)
			r.Delete("/groups/{groupId}/nominations/{nominationId}", h.DeleteNomination)

			r.Post("/groups/{groupId}/invite", h.CreateInvite)
			r.Get("/invites/{code}", h.GetInvite)
			r.Post("/groups/join", h.JoinGroup)

			r.Get("/dashboard", h.Dashboard)

			r.Post("/groups/{groupId}/watch-status", h.SetWatchStatus)

			// Admin routes
			r.Get("/admin/groups/{groupId}/schedule", h.AdminGetSchedule)
			r.Post("/admin/groups/{groupId}/picker", h.AdminSetPicker)
			r.Post("/admin/groups/{groupId}/extend-turn", h.AdminExtendTurn)
			r.Post("/admin/groups/{groupId}/unlock-movie", h.AdminUnlockMovie)
			r.Post("/admin/groups/{groupId}/unlock-reviews", h.AdminUnlockReviews)
			r.Get("/admin/groups/{groupId}/votes", h.AdminGetVotes)
			r.Post("/admin/groups/{groupId}/vote-override", h.AdminVoteOverride)
			r.Delete("/admin/groups/{groupId}/vote-override", h.AdminDeleteVoteOverride)
			r.Post("/admin/groups/{groupId}/transfer-ownership", h.AdminTransferOwnership)
			r.Delete("/admin/groups/{groupId}/nomination", h.AdminDeleteNomination)
			r.Delete("/admin/groups/{groupId}/movie", h.AdminDeleteMovie)
			r.Get("/admin/groups/{groupId}/turn-override", h.AdminGetTurnOverride)
			r.Patch("/admin/groups/{groupId}/settings", h.AdminUpdateSettings)
		})
	})

	// SPA fallback: serve React static files
	setupSPA(r)

	// Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		slog.Info("server starting", "port", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("shutting down server")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server forced shutdown", "error", err)
	}
	slog.Info("server stopped")
}

func setupSPA(r chi.Router) {
	// Try to serve from embedded static files
	sub, err := fs.Sub(staticFS, "static")
	if err != nil {
		slog.Warn("no embedded static files, SPA serving disabled")
		return
	}

	fileServer := http.FileServer(http.FS(sub))

	r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		// Try to serve the exact file first
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		if f, err := sub.Open(path); err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// SPA fallback: serve index.html for any non-file route
		indexFile, err := sub.Open("index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer indexFile.Close()

		stat, err := indexFile.Stat()
		if err != nil {
			http.NotFound(w, r)
			return
		}

		// Read index.html and serve it
		data := make([]byte, stat.Size())
		if rs, ok := indexFile.(interface{ Read([]byte) (int, error) }); ok {
			rs.Read(data)
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Content-Length", fmt.Sprintf("%d", stat.Size()))
		w.Write(data)
	})
}
