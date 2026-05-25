-- V20260511006: Supersede V20260511001 user_scope + undo V20260511003/005 auto-seeds
--
-- Rationale: per project decision 2026-05-11 (post-Phase-14 review):
--   1. Scope attaches to each role-assignment, not to the user. The user_scope
--      table from V20260511001 is replaced by user_role_scope (created in
--      V20260511007), which FKs to user_role_group_mapping so a single user with
--      multiple roles can carry different scopes per role.
--   2. Role-permission mapping is managed manually via the Phase 15+ admin UI.
--      The default-mapping seed in V20260511003 only matched 1 of 8 roles (the
--      others had mixed-case names that didn't case-fold to seed targets), so
--      the data sitting in role_permission is misleading; truncating is cleaner.
--   3. Student-cohort backfill is managed manually via the Phase 15+ admin UI.
--      V20260511005 resolved 0 of 1588 rows in dev (the multi-join chain through
--      institute_branch_batch_map is sparse). The report table is truncated;
--      student_info.session_id / course_code stay NULL until an admin enrolls
--      students explicitly.

-- 1. Drop user_scope (replaced by user_role_scope in V20260511007).
--    No FKs reference user_scope yet (it was only just created), so a plain DROP is safe.
DROP TABLE IF EXISTS user_scope;

-- 2. Truncate role_permission — partial auto-seed data is misleading; admin re-assigns via UI.
--    Foreign-key children must be cleared first; the join table itself has no children.
TRUNCATE TABLE role_permission;

-- 3. Truncate student_info_backfill_report — this is a one-shot report table; the
--    entire 1588-row population was 'no_session_resolution_path'. Admin re-enrolls
--    students via Phase 15+ UI; the report can be regenerated on demand later.
TRUNCATE TABLE student_info_backfill_report;

-- 4. student_info.session_id / course_code: V20260511005's UPDATE resolved 0 rows
--    in dev (verified by 14-03 SUMMARY), so there is no auto-backfilled data to
--    revert. Production may differ; if any rows were resolved there, a manual
--    review is the safer path than a blanket UPDATE that would clobber legitimate
--    admin assignments. Intentionally NOT issuing `UPDATE student_info SET
--    session_id = NULL` here.
