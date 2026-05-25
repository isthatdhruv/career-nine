---
phase: 11-safe-submission-pattern
plan: 01
subsystem: api
tags: [spring-boot, jpa, transaction-safety, data-integrity]

# Dependency graph
requires:
  - phase: 10-session-management
    provides: "Idempotent submission with Redis locks"
provides:
  - "Save-before-delete pattern in all 4 answer submission endpoints"
  - "ID-specific deletion replacing broad delete-by-query"
affects: [12-frontend-resilience]

# Tech tracking
tech-stack:
  added: []
  patterns: [save-before-delete, id-specific-deletion]

key-files:
  created: []
  modified:
    - "spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentAnswerController.java"

key-decisions:
  - "Use deleteAllById instead of deleteByUserStudent query for targeted deletion"
  - "Collect existing IDs via stream().map().collect() before any write operations"

patterns-established:
  - "Save-before-delete: always persist new data before removing old data in transactional endpoints"
  - "ID-specific deletion: use deleteAllById with pre-collected IDs instead of broad query-based deletes"

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 11 Plan 01: Safe Submission Pattern Summary

**Save-before-delete ordering in all 4 answer submission endpoints with ID-specific deletion via deleteAllById**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T13:26:40Z
- **Completed:** 2026-03-07T13:29:49Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Reversed delete-then-save to save-before-delete in submitAssessmentAnswers (single student)
- Applied same pattern to all 3 bulk-submit endpoints (bulk-submit, bulk-submit-with-students, bulk-submit-by-rollnumber)
- Replaced broad deleteByUserStudent query with targeted deleteAllById using pre-collected IDs
- Transaction rollback now preserves old data if save fails partway through

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor submitAssessmentAnswers to save-before-delete** - `7e55e92` (feat)
2. **Task 2: Apply save-before-delete to all 3 bulk-submit endpoints** - `5415861` (feat)

## Files Created/Modified
- `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentAnswerController.java` - All 4 submit endpoints refactored to save-before-delete with ID-specific deletion

## Decisions Made
- Used `deleteAllById` (inherited from JpaRepository) instead of adding new repository methods -- no repository changes needed
- Collected existing IDs via Java streams before any writes, ensuring snapshot of old data is captured cleanly
- Added `import java.util.stream.Collectors` for the stream collection pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 submission endpoints now safe against partial transaction failure
- Ready for 11-02 (if applicable) or Phase 12 frontend resilience work
- The `recalculateScores` endpoint still uses delete-then-save but is an admin batch operation, not student-facing submission

## Self-Check: PASSED

- [x] AssessmentAnswerController.java exists
- [x] Commit 7e55e92 exists (Task 1)
- [x] Commit 5415861 exists (Task 2)

---
*Phase: 11-safe-submission-pattern*
*Completed: 2026-03-07*
