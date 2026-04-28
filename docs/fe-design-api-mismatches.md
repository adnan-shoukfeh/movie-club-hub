# FE-Design vs API Mismatches

This document lists gaps between the FE-Design mockup data structure and the current API that should be addressed for full design parity.

## Summary

The FE-Design uses a mock data structure with additional fields that the current API doesn't provide. Most gaps are cosmetic (posters, avatars) rather than functional.

---

## 1. Movie Posters in Dashboard

**FE-Design expects:** Movie poster thumbnails on club cards in the dashboard

**Current API (`GroupSummary`):**
```typescript
{
  currentMovie: string;
  moviePoster?: string | null;
}
```

**Status:** ✅ RESOLVED - GroupSummary already includes `moviePoster`. Frontend updated to display posters when available.

---

## 2. Recently Watched Section

**FE-Design expects:** Grid of movie posters with ratings

**Current API (`RecentResult`):**
```typescript
{
  movie: string;
  moviePoster?: string | null;
  averageRating: number;
  groupName: string;
}
```

**Status:** ✅ RESOLVED - Added `moviePoster` to SQL query, Go handler, OpenAPI spec, and TypeScript types. Frontend displays actual poster when available.

---

## 3. User Avatars

**FE-Design expects:** Circular user avatar images throughout
- In picker schedule
- In member watch status
- In reviews/ratings

**Current API:** Only provides `username`, no avatar URLs

**What's needed:** Add `avatar?: string` to user-related types (`GroupMember`, `PickerScheduleSlot`, `VoteResult`)

**Workaround applied:** Showing User icon in a colored square instead

---

## 4. Club Description

**FE-Design expects:** Club cards show a description
```
"A club for arthouse cinephiles..."
```

**Current API (`GroupSummary`):** No description field

**What's needed:** Add `description?: string` to `GroupSummary`

**Workaround applied:** Showing role instead (e.g., "admin", "member")

---

## 5. Turn Numbers vs Week Dates

**FE-Design expects:** Turn numbers (Turn 1, Turn 2, etc.)

**Current API:** Uses `weekOf` dates (e.g., "2026-04-21")

**Notes:** This is a design choice, not a bug. The current approach is more flexible. No change needed, but could add `turnNumber` if desired.

---

## 6. Movie Selection - Nomination Pool Display

**FE-Design expects:** Rich nomination cards with:
- Movie poster
- Title
- Year
- Nominator avatar
- "Suggested by" label

**Current API (`NominationSheet`):** Has most of this via `Nomination` type with `moviePoster`, `nominatorUsername`, etc.

**Status:** ✅ Should work - verify implementation matches

---

## Priority Order

1. ~~**High:** Movie posters in dashboard/recently watched (most visual impact)~~ ✅ DONE
2. **Medium:** User avatars (enhances social feel) - Using colored icon placeholders
3. **Low:** Club descriptions (nice to have) - Using role as fallback

---

## Implementation Notes

Poster URLs are now included in both `GroupSummary` and `RecentResult`. Changes made:
- `go-api/internal/db/queries/movies.sql`: Added `f.poster_url AS movie_poster` to `GetRecentMoviesWithResults`
- `go-api/internal/handler/dashboard.go`: Added `MoviePoster` field to `recentResult` struct
- `lib/api-spec/openapi.yaml`: Added `moviePoster` field to `RecentResult` schema
- `lib/api-client-react/src/generated/api.schemas.ts`: Added `moviePoster` to `RecentResult` interface
- Frontend components: Updated to display posters with Film icon fallback

To add avatars later:
- Could use gravatar based on email hash
- Or allow user-uploaded avatars (more complex)
- Or generate identicons from username
