# Career-Nine: Full Responsive Overhaul

## What This Is

Career-Nine is a full-stack educational platform for student assessment, career guidance, and academic management. This milestone focuses on making the entire React frontend responsive across all devices (desktop, tablet, mobile) using Bootstrap 5 — without changing any existing looks or functionality.

## Core Value

Every page in the application works and looks correct on any screen size, with special care that data tables remain usable and readable on small screens.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from existing codebase. -->

- ✓ OAuth2 authentication (Google, GitHub, Facebook) + JWT — existing
- ✓ Student registration and management — existing
- ✓ Assessment/questionnaire creation and management — existing
- ✓ Assessment scoring and raw score calculation — existing
- ✓ Multi-language question support — existing
- ✓ Question bulk upload via Excel — existing
- ✓ Career and measured quality management — existing
- ✓ Institute/branch/course/section management — existing
- ✓ Game-based assessments (Rabbit-Path, Hydro-Tube, Jungle-Spot) — existing
- ✓ Principal and class teacher dashboards — existing
- ✓ PDF generation for student ID cards — existing
- ✓ Google Workspace integration — existing
- ✓ Metronic layout system with sidebar navigation — existing

### Active

<!-- Current scope. Making the entire frontend responsive. -->

- [ ] Metronic layout/sidebar responsive behavior (hamburger menu on mobile)
- [ ] All data tables responsive (horizontal scroll for data-heavy, card layout for simple)
- [ ] All form pages responsive (registration, assessment creation, question management)
- [ ] All dashboard pages responsive (student, teacher, principal dashboards)
- [ ] All management/CRUD pages responsive (institute, branch, course, etc.)
- [ ] Game pages responsive (Rabbit-Path, Hydro-Tube, Jungle-Spot, Data-Context)
- [ ] Modal dialogs responsive (create/edit modals, bulk upload modal)
- [ ] Authentication pages responsive (login, register, forgot password)

### Out of Scope

- Backend changes — this is frontend-only work
- Adding Tailwind CSS — using existing Bootstrap 5 only
- Redesigning any page — preserve exact existing look on desktop
- Adding new features or functionality
- Changing the Metronic theme/framework itself
- PDF generation layout changes (server-side)

## Context

- **CSS stack:** Bootstrap 5, Material-UI 5, Metronic UI framework, SCSS
- **40+ page directories** in `react-social/src/app/pages/`
- **Metronic layout** handles the app shell (sidebar, header, content area) — may already have some responsive behavior built in that needs to be verified/extended
- Tables are used extensively across management pages (students, questions, assessments, institutes, etc.)
- Some pages use Material-UI DataGrid/tables, others use plain HTML tables with Bootstrap classes
- Games have custom layouts with grade-specific variants that need individual attention

## Constraints

- **CSS Framework**: Bootstrap 5 only — no new CSS dependencies
- **Visual Parity**: Desktop view must remain pixel-identical after changes
- **Functionality**: No behavior changes — responsive CSS/layout only
- **Breakpoints**: Standard Bootstrap breakpoints (576px, 768px, 992px, 1200px, 1400px)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Bootstrap 5 only, no Tailwind | Already in stack, avoids adding dependencies | — Pending |
| Horizontal scroll for data-heavy tables | Preserves table structure and readability | — Pending |
| Card layout for simple tables on mobile | Better touch experience for simple data | — Pending |
| All pages equally prioritized | User wants complete coverage | — Pending |

---
*Last updated: 2026-02-17 after initialization*
