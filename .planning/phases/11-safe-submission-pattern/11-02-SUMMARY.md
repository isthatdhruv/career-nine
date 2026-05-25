---
phase: 11-safe-submission-pattern
plan: 02
subsystem: api
tags: [redis, draft-save, crash-recovery, spring-boot]

# Dependency graph
requires:
  - phase: 10-session-management
    provides: AssessmentSessionService with Redis operations
provides:
  - POST /assessment-answer/draft-save endpoint for periodic answer backup
  - GET /assessment-answer/draft-restore/{studentId}/{assessmentId} for crash recovery
  - Draft cleanup on successful submission
  - saveDraft, getDraft, deleteDraft service methods
affects: [12-frontend-resilience]

# Tech tracking
tech-stack:
  added: []
  patterns: [redis-backed-draft-save, draft-cleanup-on-submit]

key-files:
  created: []
  modified:
    - spring-social/src/main/java/com/kccitm/api/service/AssessmentSessionService.java
    - spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentAnswerController.java

key-decisions:
  - "career9:draft: key prefix for draft namespace isolation, consistent with session/submit prefixes"
  - "24h TTL on drafts — matches session TTL, long enough for any assessment"

patterns-established:
  - "Draft lifecycle: save periodically -> restore on load -> delete on submit"

# Metrics
duration: 2min
completed: 2026-03-07
---

# Phase 11 Plan 02: Draft Auto-Save Summary

**Redis-backed draft save/restore endpoints with 24h TTL and automatic cleanup on successful submission**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T13:26:43Z
- **Completed:** 2026-03-07T13:28:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Three draft methods (saveDraft, getDraft, deleteDraft) added to AssessmentSessionService with career9:draft: key prefix
- Two new REST endpoints for frontend draft backup and crash recovery
- Draft cleanup integrated into submission flow to prevent stale data

## Task Commits

Each task was committed atomically:

1. **Task 1: Add draft save/restore/delete methods to AssessmentSessionService** - `0e3a43b` (feat)
2. **Task 2: Add draft-save, draft-restore endpoints and draft cleanup on submission** - `b158137` (feat)

## Files Created/Modified
- `spring-social/src/main/java/com/kccitm/api/service/AssessmentSessionService.java` - Added saveDraft, getDraft, deleteDraft methods with Redis 24h TTL
- `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentAnswerController.java` - Added POST /draft-save, GET /draft-restore endpoints, deleteDraft call after submission

## Decisions Made
- Used career9:draft: key prefix, consistent with existing career9:session: and career9:submit: prefixes
- 24h TTL on drafts matches session TTL and is long enough for any assessment duration
- Draft cleanup placed after deleteSession in submit flow for consistent cleanup ordering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Draft save/restore backend is ready for frontend integration in Phase 12
- Frontend can call POST /assessment-answer/draft-save every 30s to back up localStorage
- Frontend can call GET /assessment-answer/draft-restore/{studentId}/{assessmentId} on page load for crash recovery

---
*Phase: 11-safe-submission-pattern*
*Completed: 2026-03-07*
