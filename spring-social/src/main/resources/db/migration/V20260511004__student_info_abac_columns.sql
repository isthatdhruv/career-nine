-- ---------------------------------------------------------------------------
-- V20260511004__student_info_abac_columns.sql
--
-- Phase 14 (ABAC Data Foundation) — Plan 14-03.
--
-- Adds the two missing ABAC scope columns to student_info so 4-dimension
-- scope checks (institute, session, class, section) can be enforced in
-- Phase 15.
--
-- Today student_info has:
--   institute_id        INT NULL  (already present)
--   school_section_id   INT NULL  (already present)
--   studentClass        INT NULL  (free integer — kept untouched, not a FK)
-- Missing:
--   session_id          -> FK to institute_session.session_id
--   course_code         -> FK to institute_courses.course_code  ("class")
--
-- Both new columns are NULLABLE — backfill in V20260511005 resolves what
-- it can; unresolvable rows stay NULL and Phase 15 fails closed on them.
-- ---------------------------------------------------------------------------

ALTER TABLE student_info
  ADD COLUMN session_id  INT NULL AFTER institute_id,
  ADD COLUMN course_code INT NULL AFTER session_id;

-- Composite index for the scope filter (matches the WHERE-clause shape
-- the Phase 15 Hibernate @Filter will produce: institute -> session -> class -> section).
CREATE INDEX idx_student_info_scope
  ON student_info (institute_id, session_id, course_code, school_section_id);

-- Foreign keys
ALTER TABLE student_info
  ADD CONSTRAINT fk_si_session FOREIGN KEY (session_id)  REFERENCES institute_session(session_id),
  ADD CONSTRAINT fk_si_course  FOREIGN KEY (course_code) REFERENCES institute_courses(course_code);
