# Task: Refactor Large Components

**ID:** 011
**Priority:** P3
**Effort:** L
**Status:** backlog
**Domain:** groups
**Dependencies:** none

## Problem
`group-detail.tsx` (61KB) and `group-admin.tsx` (58KB) too large to maintain.

## Proposed Solution
Break into domain-driven components (see REFACTORING_PLAN.md).

## Acceptance Criteria
- [ ] Large components broken into smaller, domain-driven components
- [ ] No single component file exceeds a reasonable size threshold

## Implementation Notes
See `docs/REFACTORING_PLAN.md` for detailed breakdown.

## Test Plan
What needs to be tested and how.
