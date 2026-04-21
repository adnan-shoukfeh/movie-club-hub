# Task: Rating Slider Gating

**ID:** 004
**Priority:** P1
**Effort:** S
**Status:** backlog
**Domain:** verdicts
**Dependencies:** none

## Problem
Rating slider visible even when user hasn't watched the movie. Resetting to unwatched should clear rating but restore it if they re-mark watched.

## Proposed Solution
Gate rating/review UI behind watch status toggle. Store tentative rating in local state.

## Acceptance Criteria
- [ ] Rating slider only appears after "watched" toggle is enabled
- [ ] Rating is cleared when user unmarks a movie as watched
- [ ] Rating is restored if user re-marks the movie as watched

## Implementation Notes
Technical details, gotchas, references.

## Test Plan
What needs to be tested and how.
