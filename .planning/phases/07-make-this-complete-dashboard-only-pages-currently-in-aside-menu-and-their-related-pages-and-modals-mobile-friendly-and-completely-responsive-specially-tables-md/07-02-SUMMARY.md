---
phase: 07-dashboard-responsive
plan: 02
subsystem: ui
tags: [scss, responsive, mobile, mdb, bootstrap, metronic, flex-wrap]

# Dependency graph
requires:
  - phase: 07-dashboard-responsive
    plan: 01
    provides: "SCSS entry point (index.scss) pre-populated with @import 'institute', stub _institute.scss created"
provides:
  - "_institute.scss populated with all Institute + Student page responsive CSS rules"
  - "CollegeTable action button wrapping fix (5+ buttons in last <td> now flex-wrap on mobile)"
  - "Container padding reduction for .min-vh-100 pages (GroupStudentPage, StudentsList, UploadExcelFile)"
  - "Modal body padding reduction on xs screens"
  - "StudentsList assessment select min-width override on very small screens"
  - "MUI DataTable horizontal scroll fix for FacultyRegistrationDetails"
affects: [07-03, 07-04, 07-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All CSS rules scoped inside @media (max-width: ...) blocks — no unguarded overrides"
    - "Use !important on inline-style overrides when necessary (scoped to .app-content to limit blast radius)"
    - "Target MDB DataTable action cells via .mdb-datatable table td:last-child"
    - "Target pages using min-vh-100 pattern via .app-content .min-vh-100"

key-files:
  created: []
  modified:
    - "react-social/src/app/styles/_institute.scss"

key-decisions:
  - "Used .app-content .min-vh-100 scope for padding overrides to avoid touching Metronic sidebar/header .min-vh-100 elements"
  - "Used flex-wrap on td:last-child children rather than modifying CollegeTable JSX — CSS-only fix"
  - "Grouped UploadExcelFile and StudentsList padding fix with GroupStudentPage under single .min-vh-100 rule since all three use identical container pattern"
  - "MUI DataTable fix included here rather than in _misc.scss since FacultyRegistrationDetails is part of the institute/teacher section"

patterns-established:
  - "Pattern: Inline padding overrides use .app-content parent scope + !important"
  - "Pattern: MDB action cell wrapping targets td:last-child > span and td:last-child > div for JSX direct children"

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 7 Plan 02: Institute + Student Pages Responsive Summary

**Responsive CSS for CollegeTable action-button wrapping, min-vh-100 container padding reduction, and MUI DataTable overflow fix — all in _institute.scss, all @media-guarded**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-19T00:00:00Z
- **Completed:** 2026-02-19T00:05:00Z
- **Tasks:** 2 (Task 1: research/read, Task 2: write CSS)
- **Files modified:** 1

## Accomplishments

- CollegeTable action column: 5+ buttons (edit, delete, dropdown, dashboard, upload) now flex-wrap within their cell on mobile (max-width: 767.98px)
- GroupStudentPage, StudentsList, UploadExcelFile container padding reduced from 2rem to 1rem (mobile) / 0.5rem (xs) via `.app-content .min-vh-100` scope
- StudentsList assessment `<select>` min-width 200px overridden on very small screens so it doesn't force horizontal scroll
- UploadExcelFile header institute/assessment selects become full-width on xs when stacked
- Modal body padding reduced on xs (575.98px) to recover horizontal space in download modals
- MUI DataTable overflow-x: auto added for FacultyRegistrationDetails

## Task Commits

1. **Task 1: Research source files** — Read-only, no commit
2. **Task 2: Write _institute.scss** — `9c0c982` (feat)

**Plan metadata:** see final commit below

## Files Created/Modified

- `react-social/src/app/styles/_institute.scss` — Populated with 9 @media blocks covering all Institute + Student page responsive issues (was a 1-line stub)

## Decisions Made

- **Scope .min-vh-100 to .app-content**: GroupStudentPage, StudentsList, and UploadExcelFile all use `className="min-vh-100"` with `style={{ padding: "2rem" }}`. Rather than adding class names to JSX, used `.app-content .min-vh-100` scope with `!important` to override inline styles without touching Metronic layout elements that also use `.min-vh-100`.
- **CSS-only CollegeTable fix**: The CollegeTable actions cell renders `<>` fragments directly — buttons are siblings inside the `<td>`. MDB wraps td content in a `<span>` or renders directly as `<div>`, so targeting `td:last-child > span, td:last-child > div` with `flex-wrap: wrap` handles both cases without modifying JSX.
- **Modal body padding**: Both download modal and bulk download modal in GroupStudentPage already have `table-responsive` wrappers, so modal table overflow is handled. Only reduced modal-body padding on xs to avoid wasting space.
- **MUI DataTable fix grouped here**: FacultyRegistrationDetails is part of the teacher/institute section, so its MUI DataTable overflow fix logically belongs in `_institute.scss`.

## Deviations from Plan

None - plan executed exactly as written. The research phase confirmed that both GroupStudentPage modal tables (lines 2465 and 2831) already have `table-responsive` wrappers, so no additional modal table overflow rules were needed beyond padding reduction.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `_institute.scss` is complete and imported via `index.scss`
- Plan 03 (`_assessment.scss`) can proceed independently
- No blockers

---
*Phase: 07-dashboard-responsive*
*Completed: 2026-02-19*
