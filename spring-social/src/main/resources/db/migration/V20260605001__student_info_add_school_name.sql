-- ---------------------------------------------------------------------------
-- V20260605001__student_info_add_school_name.sql
--
-- Student-portal "complete your profile" step (lead → student flow).
--
-- The student-info form now collects the student's own school name (free text,
-- distinct from the assigned InstituteDetail). student_info had no column for it
-- — the career-9.com form's schoolName previously survived only on the lead.
-- Add a dedicated, nullable column so it can be saved + pre-filled.
--
-- NULLABLE: existing rows and non-lead students simply leave it NULL.
-- ---------------------------------------------------------------------------

ALTER TABLE student_info
  ADD COLUMN school_name VARCHAR(255) NULL;
