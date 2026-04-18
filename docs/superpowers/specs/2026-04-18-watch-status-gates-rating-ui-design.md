# Watch Status Gates Rating UI

**Date:** 2026-04-18

## Problem

The rating/review/submit UI is always visible inside the "Rate this Film" card, even when the user's watch status is "Not Yet". Users who haven't watched the film shouldn't see or interact with the rating entry form.

Additionally, switching to "Not Yet" currently clears any unsaved rating/review values, forcing the user to re-enter them if they switch back to "Watched" in the same session.

## Requirements

- The "Select your rating" wheel picker, review textarea, and submit button are only shown when `group.myWatched === true`.
- The "Your Rating" display (post-vote) is also gated on `group.myWatched` for cleanliness (in practice it cannot appear in "Not Yet" state since the button is disabled when voted).
- The watch status toggle ("Watched" / "Not Yet") remains always visible so the user can switch.
- Switching to "Not Yet" **does not clear** unsaved `intIdx`, `decIdx`, or `reviewText` values — they persist in React component state for the session.
- Switching back to "Watched" restores the preserved values so the user can continue where they left off.

## Out of Scope

- Backend changes — no API or DB changes needed.
- Persisting draft values across page reloads or sessions.
- Any change to the "Not Yet" disable-when-voted constraint (lines 966–967).

## Changes

**File:** `artifacts/movie-club/src/pages/group-detail.tsx`

### 1. `handleNotYet` (lines 446–452)

Remove state-clearing lines. The function becomes:

```ts
const handleNotYet = () => {
  setEditingVote(false);
  handleWatchedToggle(false);
};
```

`setEditingVote(false)` is kept because editing mode implies a "Watched" context and should reset on status change.

### 2. Rating/review/submit block (lines 984–1066)

Wrap the entire ternary block in `{group.myWatched && (...)}`:

```tsx
{group.myWatched && (
  <>
    {status.hasVoted && !editingVote ? (
      // "Your Rating" display
    ) : (
      // Wheel picker + review textarea + submit button
    )}
  </>
)}
```

## Behavior Summary

| Watch Status | Voted? | Rating block visible? | Values preserved? |
|---|---|---|---|
| Watched | No | Yes (entry form) | N/A |
| Watched | Yes | Yes (display) | N/A |
| Not Yet | No | No | Yes (in session) |
| Not Yet | Yes | N/A (button disabled) | N/A |
