package session

import (
	"net/http"
	"os"
	"time"

	"github.com/alexedwards/scs/pgxstore"
	"github.com/alexedwards/scs/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

const UserIDKey = "userId"

type Manager struct {
	*scs.SessionManager
}

func NewManager(pool *pgxpool.Pool, secret string) *Manager {
	sm := scs.New()
	sm.Store = pgxstore.New(pool)
	sm.Lifetime = 30 * 24 * time.Hour
	sm.Cookie.HttpOnly = true
	sm.Cookie.SameSite = http.SameSiteLaxMode
	sm.Cookie.Secure = os.Getenv("NODE_ENV") == "production"
	sm.Cookie.Path = "/"

	return &Manager{SessionManager: sm}
}

func (m *Manager) GetUserID(r *http.Request) (int64, bool) {
	val := m.GetInt64(r.Context(), UserIDKey)
	if val == 0 {
		return 0, false
	}
	return val, true
}

func (m *Manager) SetUserID(r *http.Request, id int64) {
	m.Put(r.Context(), UserIDKey, id)
}
