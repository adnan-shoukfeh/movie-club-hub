package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/session"
)

type Handler struct {
	q         *db.Queries
	pool      *pgxpool.Pool
	sm        *session.Manager
	omdbCache *omdbCache
}

func New(q *db.Queries, pool *pgxpool.Pool, sm *session.Manager) *Handler {
	return &Handler{q: q, pool: pool, sm: sm, omdbCache: newOMDBCache()}
}

// JSON helpers

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func writeMessage(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"message": msg})
}

func decodeBody(r *http.Request, v any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

func pathInt(r *http.Request, key string) (int32, error) {
	v, err := strconv.Atoi(chi.URLParam(r, key))
	if err != nil {
		return 0, err
	}
	return int32(v), nil
}

func queryString(r *http.Request, key string) string {
	return r.URL.Query().Get(key)
}

// pgtype conversion helpers

func toPgDate(t time.Time) pgtype.Date {
	return pgtype.Date{Time: t, Valid: true}
}

func timeToPgDate(s string) pgtype.Date {
	t, _ := time.Parse("2006-01-02", s)
	return pgtype.Date{Time: t, Valid: true}
}

func pgDateToString(d pgtype.Date) string {
	if !d.Valid {
		return ""
	}
	return d.Time.Format("2006-01-02")
}

func pgDateToTime(d pgtype.Date) time.Time {
	return d.Time
}
