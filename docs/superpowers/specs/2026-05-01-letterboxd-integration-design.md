# Letterboxd Integration Design

## Overview

Add user profile pages with Letterboxd account linking, and allow users to choose whether movie titles link to Letterboxd or IMDB.

## Phases

### Phase 1: Profile Pages
Build user profile pages with stats, activity history, and Letterboxd username display.

### Phase 2: Movie Link Preferences
Add user preference for movie link destination (Letterboxd default, IMDB option).

---

## Phase 1: Profile Pages

### Database Changes

Add column to `users` table:

```sql
ALTER TABLE users ADD COLUMN letterboxd_username text;
```

### API Endpoints

#### GET /api/users/:userId/profile

Returns profile data for a user. Requires authentication. Returns 403 if viewer does not share a club with the target user.

**Response:**
```json
{
  "id": 123,
  "username": "sarah_chen",
  "avatar_url": "https://storage.googleapis.com/...",
  "letterboxd_username": "sarahchen",
  "stats": {
    "avg_rating": 4.2,
    "total_watched": 47,
    "total_reviews": 12,
    "top_genres": ["Drama", "Thriller", "Sci-Fi"]
  },
  "recent_activity": [
    {
      "film_id": 1,
      "title": "Parasite",
      "year": 2019,
      "rating": 5.0,
      "review": "Brilliant social commentary...",
      "watched_at": "2026-04-25T18:00:00Z"
    }
  ]
}
```

**Notes:**
- `recent_activity` returns the 10 most recent watched films (ordered by `watched_at` desc)
- Only includes films from clubs shared between viewer and target user
```

**Access Control Logic:**
```sql
SELECT EXISTS (
  SELECT 1 FROM memberships m1
  JOIN memberships m2 ON m1.group_id = m2.group_id
  WHERE m1.user_id = :viewer_id AND m2.user_id = :target_id
)
```

#### PATCH /api/users/me/profile

Update current user's profile. Only `letterboxd_username` is editable via this endpoint (avatar uses existing upload flow).

**Request:**
```json
{
  "letterboxd_username": "sarahchen"
}
```

**Validation:**
- Username must match pattern `^[a-zA-Z0-9_]+$` (alphanumeric + underscore)
- Max length: 50 characters
- Empty string clears the field

### Frontend

#### New Route

Add `/user/:userId` route in `FE-Design/src/app/routes.tsx`:

```tsx
{
  path: "/user/:userId",
  Component: UserProfile,
}
```

#### Profile Component Structure

`FE-Design/src/app/components/UserProfile.tsx`:

- **Desktop (md+):** Two-column layout
  - Left sidebar (40%): Stats cards, top genres
  - Right content (60%): Recent activity feed
- **Mobile:** Single column, stats-first
  - Centered avatar + name + Letterboxd badge
  - Stats row (avg rating, watched, reviews)
  - Genre pills
  - Activity list

#### Clickable Avatars

Update all user avatar/name displays to link to `/user/:userId`:
- `ClubView.tsx`: Picker info, watch status grid, ratings
- `TurnResults.tsx`: Review authors
- `Dashboard.tsx`: Any user references

Use a shared `UserLink` component:
```tsx
interface UserLinkProps {
  user: { id: string; name: string; avatar: string };
  showAvatar?: boolean;
  showName?: boolean;
}
```

#### Edit Mode

When viewing own profile, show "Edit" button that reveals:
- Letterboxd username input field
- Save/Cancel buttons

### Stats Calculation

Stats are computed server-side from the `verdicts` table:

```sql
-- Average rating
SELECT AVG(rating) FROM verdicts WHERE user_id = :id AND rating IS NOT NULL;

-- Total watched
SELECT COUNT(*) FROM verdicts WHERE user_id = :id AND watched = true;

-- Total reviews
SELECT COUNT(*) FROM verdicts WHERE user_id = :id AND review IS NOT NULL;

-- Top genres (from films joined through turns)
SELECT f.genre, COUNT(*) as cnt
FROM verdicts v
JOIN turns t ON v.turn_id = t.id
JOIN movies m ON m.turn_id = t.id
JOIN films f ON m.film_id = f.id
WHERE v.user_id = :id AND v.watched = true
GROUP BY f.genre
ORDER BY cnt DESC
LIMIT 3;
```

Note: `genre` is stored as a comma-separated string in `films`. Parse and aggregate individual genres.

---

## Phase 2: Movie Link Preferences

### Database Changes

Add column to `users` table:

```sql
ALTER TABLE users ADD COLUMN movie_link_preference text NOT NULL DEFAULT 'letterboxd'
  CHECK (movie_link_preference IN ('letterboxd', 'imdb'));
```

### API Changes

#### GET /api/users/me

Include `movie_link_preference` in response.

#### PATCH /api/users/me/settings

Update user preferences:

```json
{
  "movie_link_preference": "imdb"
}
```

### Frontend

#### Settings Page

Add movie link preference toggle to user settings (not profile page per split approach decision):
- Radio buttons or toggle: "Letterboxd" / "IMDB"
- Persists via PATCH /api/users/me/settings

#### Movie Title Links

Make movie titles clickable throughout the app. Link destination based on user preference:

**Letterboxd URL format:** `https://letterboxd.com/film/{slug}/`
- Slug derived from title: lowercase, hyphens for spaces, remove special chars
- Example: "The Grand Budapest Hotel" → `the-grand-budapest-hotel`

**IMDB URL format:** `https://www.imdb.com/title/{imdb_id}/`
- Uses existing `imdb_id` from `films` table

**Components to update:**
- `ClubView.tsx`: Movie title in main display
- `TurnResults.tsx`: Movie references
- Suggestion cards in sidebar

#### Letterboxd Slug Generation

Client-side utility:
```typescript
function toLetterboxdSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}
```

Note: This is a best-effort slug. Letterboxd's actual slugs may differ for edge cases (foreign films, duplicates). For future P2 sync work, we could fetch and cache the canonical Letterboxd slug.

---

## Data Flow

### Profile View Flow

```
User clicks avatar → /user/:userId → 
  Frontend checks auth → 
  GET /api/users/:userId/profile →
  Backend checks shared club membership →
  Returns profile data or 403 →
  Frontend renders profile page
```

### Movie Link Flow

```
User clicks movie title →
  Check user.movie_link_preference →
  If 'letterboxd': open letterboxd.com/film/{slug}
  If 'imdb': open imdb.com/title/{imdb_id}
```

---

## Error Handling

### Profile Access Denied
- 403 response when viewer doesn't share a club with target user
- Frontend shows "You don't have access to this profile" message

### Missing Letterboxd Username
- Profile page shows "Link your Letterboxd" prompt when viewing own profile
- Shows nothing (no badge) when viewing others without Letterboxd linked

### Missing IMDB ID
- If user prefers IMDB but film lacks `imdb_id`, fall back to Letterboxd slug
- Log warning for data quality tracking

---

## Testing Strategy

### Backend
- Unit tests for profile access control (shared club check)
- Unit tests for stats aggregation queries
- Integration tests for profile endpoints

### Frontend
- Component tests for UserProfile layout (desktop/mobile)
- Component tests for UserLink clickability
- E2E test: navigate to profile via avatar click

---

## Migration Path

### Phase 1 Migration
```sql
-- 000014_add_letterboxd_username.up.sql
ALTER TABLE users ADD COLUMN letterboxd_username text;

-- 000014_add_letterboxd_username.down.sql
ALTER TABLE users DROP COLUMN letterboxd_username;
```

### Phase 2 Migration
```sql
-- 000015_add_movie_link_preference.up.sql
ALTER TABLE users ADD COLUMN movie_link_preference text NOT NULL DEFAULT 'letterboxd'
  CHECK (movie_link_preference IN ('letterboxd', 'imdb'));

-- 000015_add_movie_link_preference.down.sql
ALTER TABLE users DROP COLUMN movie_link_preference;
```

---

## Roadmap Impact

This work addresses/modifies these roadmap items:
- **P1: Profile Pages** — Fully implemented by Phase 1
- **P1: Movie Title Links** — Implemented by Phase 2 (changed from IMDB-only to user preference)
- **P2: Letterboxd Integration** — Partially addressed; `letterboxd_username` stored for future sync work

Recommend removing standalone "Movie Title Links" item and updating "Letterboxd Integration" to note username storage is complete.
