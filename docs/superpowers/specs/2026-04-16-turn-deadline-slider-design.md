# Turn Deadline Slider — Design Spec

**Date:** 2026-04-16

## Summary

Allow admins to move a turn's deadline forward or backward. Replace the numeric
"days extended" input in the admin panel with a horizontal slider whose labels
display deadline dates instead of integers.

## Scope

- `go-api/internal/handler/admin.go` — backend validation
- `artifacts/movie-club/src/pages/group-admin.tsx` — frontend UI

## Backend

### `AdminExtendTurn`

Relax the lower bound on `extendedDays`:

- **Before:** `extendedDays < 0` → 400 error
- **After:** `extendedDays < -(group.TurnLengthDays - 1)` → 400 error

This ensures a turn is always at least 1 day long. The upper bound (365) is
unchanged. No schema or endpoint changes.

The group must be fetched before the validation check (it was previously fetched
after); the refactored handler fetches the group once and reuses it.

## Frontend

### `TurnDeadlineInput` component (inside `group-admin.tsx`)

A self-contained component with the following interface:

```ts
interface TurnDeadlineInputProps {
  weekOf: string;          // turn start date (YYYY-MM-DD)
  turnLengthDays: number;  // group's base turn length
  extendedDays: number;    // current value
  onChange: (days: number) => void;
}
```

Internals:
- `min = -(turnLengthDays - 1)` — ensures ≥ 1 day duration
- `max = 365` — practical upper bound (matches backend)
- Slider value = `extendedDays` integer; displayed label = computed deadline date
- Deadline date = `weekOf` date + `turnLengthDays` + `extendedDays` days
- Label uses `formatDateET` from `@/lib/utils`
- Min/max boundary dates shown as small labels beneath the slider ends

### Migration path to Option C (date picker)

Because `TurnDeadlineInput` owns the UX entirely behind a `(extendedDays,
onChange)` interface, replacing the slider body with a `<input type="date">`
is a localised swap with no changes to the parent component or the API.

## Constraints enforced

| Constraint | Where enforced |
|---|---|
| Turn ≥ 1 day (backward limit) | Frontend slider min + backend validation |
| Practical max (+365 days) | Frontend slider max + backend validation |
| Next turn's slider min updates when prev turn extends | Naturally by cascading turn math already in system |
