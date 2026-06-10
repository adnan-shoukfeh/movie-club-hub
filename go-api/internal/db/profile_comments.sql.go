// Hand-written to match the sqlc generation style for profile.sql. These two
// queries power "comments" in a user's recent activity. They are kept here (not
// in the generated profile.sql.go) so a future `sqlc generate` won't clobber
// them; the matching SQL lives in queries/profile.sql for when sqlc is run.

package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

const getUserRecentComments = `-- name: GetUserRecentComments :many
SELECT
    f.id AS film_id,
    f.title,
    f.year,
    f.poster_url,
    vr.body AS comment,
    vr.created_at AS commented_at
FROM verdict_replies vr
JOIN verdicts v ON v.id = vr.verdict_id
JOIN turns t ON v.turn_id = t.id
JOIN movies m ON m.turn_id = t.id
JOIN films f ON m.film_id = f.id
WHERE vr.user_id = $1
ORDER BY vr.created_at DESC
LIMIT 10
`

type GetUserRecentCommentsRow struct {
	FilmID      int64              `json:"film_id"`
	Title       string             `json:"title"`
	Year        *int32             `json:"year"`
	PosterUrl   *string            `json:"poster_url"`
	Comment     string             `json:"comment"`
	CommentedAt pgtype.Timestamptz `json:"commented_at"`
}

func (q *Queries) GetUserRecentComments(ctx context.Context, userID int32) ([]GetUserRecentCommentsRow, error) {
	rows, err := q.db.Query(ctx, getUserRecentComments, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []GetUserRecentCommentsRow{}
	for rows.Next() {
		var i GetUserRecentCommentsRow
		if err := rows.Scan(
			&i.FilmID,
			&i.Title,
			&i.Year,
			&i.PosterUrl,
			&i.Comment,
			&i.CommentedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const getUserRecentCommentsForViewer = `-- name: GetUserRecentCommentsForViewer :many
SELECT
    f.id AS film_id,
    f.title,
    f.year,
    f.poster_url,
    vr.body AS comment,
    vr.created_at AS commented_at
FROM verdict_replies vr
JOIN verdicts v ON v.id = vr.verdict_id
JOIN turns t ON v.turn_id = t.id
JOIN movies m ON m.turn_id = t.id
JOIN films f ON m.film_id = f.id
WHERE vr.user_id = $1
  AND t.group_id IN (
      SELECT m1.group_id FROM memberships m1
      JOIN memberships m2 ON m1.group_id = m2.group_id
      WHERE m1.user_id = $1 AND m2.user_id = $2
  )
ORDER BY vr.created_at DESC
LIMIT 10
`

type GetUserRecentCommentsForViewerParams struct {
	UserID   int32 `json:"user_id"`
	UserID_2 int32 `json:"user_id_2"`
}

type GetUserRecentCommentsForViewerRow struct {
	FilmID      int64              `json:"film_id"`
	Title       string             `json:"title"`
	Year        *int32             `json:"year"`
	PosterUrl   *string            `json:"poster_url"`
	Comment     string             `json:"comment"`
	CommentedAt pgtype.Timestamptz `json:"commented_at"`
}

// GetUserRecentCommentsForViewer only returns comments from clubs shared between
// the viewer and the target user.
func (q *Queries) GetUserRecentCommentsForViewer(ctx context.Context, arg GetUserRecentCommentsForViewerParams) ([]GetUserRecentCommentsForViewerRow, error) {
	rows, err := q.db.Query(ctx, getUserRecentCommentsForViewer, arg.UserID, arg.UserID_2)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []GetUserRecentCommentsForViewerRow{}
	for rows.Next() {
		var i GetUserRecentCommentsForViewerRow
		if err := rows.Scan(
			&i.FilmID,
			&i.Title,
			&i.Year,
			&i.PosterUrl,
			&i.Comment,
			&i.CommentedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
