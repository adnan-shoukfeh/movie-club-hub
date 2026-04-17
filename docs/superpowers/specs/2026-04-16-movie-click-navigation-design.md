# Movie Click Navigation — Design Spec

**Date:** 2026-04-16

## Summary

Two small navigation improvements:
1. Dashboard "Recent Results" cards navigate to the results page on click.
2. Movie poster covers in main display views open the IMDB page in a new tab.

## Feature 1 — Dashboard results navigation

`artifacts/movie-club/src/pages/dashboard.tsx`

Recent result cards are currently plain `<div>` elements. Wrap each in a `<button>`
with an `onClick` that navigates to `/groups/${result.groupId}/results?weekOf=${result.weekOf}`.
Add the same hover styling pattern used by `GroupCard` (border highlight, cursor pointer).

Data already present: `result.groupId` and `result.weekOf` are both included in the
`recentResults` API response from the backend.

## Feature 2 — IMDB poster links

Approach: wrap each qualifying poster `<img>` in `<a href target="_blank" rel="noopener noreferrer">`.
When `imdbId` is absent the image renders without a link. No overlay, no extra affordance UI.

IMDB URL format: `https://www.imdb.com/title/${imdbId}/`

### Views updated

| File | Location | Condition |
|---|---|---|
| `group-detail.tsx` | Current/past turn movie poster (w-16 h-24) | `movie.imdbId` truthy |
| `group-results.tsx` | Movie header banner poster | `movie.imdbId` truthy |
| `group-detail.tsx` | Nominations pool sheet — each nomination in the list | `nom.imdbId` truthy |

### Views NOT updated

- Movie search result dropdown — selection UI
- `nomSelectedMovie` preview card — pre-submit selection UI
- Admin panel movie references — utility admin context
