# Task: Set Up GCP Dev Environment

**ID:** 001
**Priority:** P0
**Effort:** M
**Status:** backlog
**Domain:** infra
**Dependencies:** none

## Problem
No dedicated staging/dev GCP environment. Local Docker dev works but there's no git-branch-based staging.

## Proposed Solution
Create dedicated GCP project + Cloud Run service for staging. Map `dev` branch to staging deploy. Local Docker dev remains for fast iteration.

## Acceptance Criteria
- [ ] Staging URL exists and is accessible
- [ ] Deploys automatically on push to dev branch

## Implementation Notes
Technical details, gotchas, references.

## Test Plan
What needs to be tested and how.
