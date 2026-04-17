# Admin Picker Schedule — Combined Date Range Input

**Date:** 2026-04-17

## Problem

Each turn row in the admin Picker Schedule section currently shows two separate calendar rows (Start and Deadline), each with its own popover and Set button. This takes up vertical space and makes the relationship between start and deadline dates implicit.

## Solution

Replace both rows with a single row containing two pill-buttons and one Set button. Clicking a pill opens one shared calendar popover focused on that field. One Set button saves both values.

## UI Design

### Trigger row (closed)

```
[Start: Apr 17] → [End: Apr 24]  [Set]
```

- **Start pill**: clickable button, purple tint border to indicate it's the primary date.
- **End pill**: clickable button, default border.
- **Set button**: saves both dates (same as today's two Set buttons combined).
- Replaces the two current rows entirely. All on one line.

### Calendar popover (open — Start active)

- Header label: "Editing start date"
- Disabled dates: before prev turn's deadline; on or after the current deadline date
- Current range (start → end) shaded in the calendar; end date shown with a dashed outline (not clickable in this mode)
- Selecting a date updates local start state and closes the popover

### Calendar popover (open — End active)

- Header label: "Editing deadline"
- Disabled dates: on or before current start date; after weekOf + turnLengthDays + 365 days
- Current range shaded; start date shown as solid (not clickable in this mode)
- Selecting a date updates local end state and closes the popover

Only one popover can be open at a time.

## Component

**New component:** `TurnDateRangeInput`

Replaces both `TurnStartInput` and `TurnDeadlineInput`.

```ts
interface TurnDateRangeInputProps {
  weekOf: string;
  turnLengthDays: number;
  extendedDays: number;        // current deadline extension (from entry or local state)
  startOffsetDays: number;     // current start offset (from entry or local state)
  prevDeadlineMs: number | null;
  onStartChange: (offsetDays: number) => void;
  onDeadlineChange: (extendedDays: number) => void;
}
```

Internal state: `activeField: "start" | "deadline" | null` (controls which pill opened the popover).

## Save Behavior

Clicking **Set** shows one confirm dialog:
> "Update start and deadline for turn starting [date]? This adjusts when the turn opens and when rating closes."

On confirm: fires `POST /api/admin/groups/{groupId}/turn-start` and `POST /api/admin/groups/{groupId}/extend-turn` sequentially. Both calls always fire (idempotent — no value-changed diffing needed).

Error handling: same as today — toast on failure, schedule reloads on success.

## Files Changed

- `artifacts/movie-club/src/pages/group-admin.tsx`
  - Remove `TurnStartInput` and `TurnDeadlineInput` components
  - Add `TurnDateRangeInput` component
  - Replace the two-row layout in the schedule entry with the new single row
  - Add `handleSetTurnDates(weekOf)` that wraps both API calls under one confirm
