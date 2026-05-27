-- ---------------------------------------------------------------------------
-- V20260526007__backfill_generated_report_subtype.sql
--
-- Backfill generated_report.report_subtype_id from the student's grade,
-- using the same logic the runtime resolver will fall back on for unbackfilled
-- questionnaires:
--
--   type='bet'                                       → subtype='default'
--   type='legacy'/'pager' AND grade BETWEEN  6 AND  8 → subtype='insight'
--   type='legacy'/'pager' AND grade BETWEEN  9 AND 10 → subtype='subject'
--   type='legacy'/'pager' AND grade BETWEEN 11 AND 12 → subtype='career'
--   default fallback (e.g. unknown grade)             → subtype='career'
--
-- type_of_report='navigator' rows were renamed to 'legacy' in V20260526005,
-- so the JOIN against report_type.code matches.
-- ---------------------------------------------------------------------------

-- user_student.id is the FK into student_info.id (composite-style: student_info holds the
-- biographical row, user_student holds the auth/account row; they're 1:1 via .id).
UPDATE generated_report gr
JOIN user_student us       ON us.user_student_id = gr.user_student_id
LEFT JOIN student_info si  ON si.id              = us.id
JOIN report_type rt        ON rt.code            = gr.type_of_report
JOIN report_subtype rs     ON rs.report_type_id  = rt.report_type_id
   AND rs.code = CASE
     WHEN gr.type_of_report = 'bet' THEN 'default'
     WHEN si.student_class BETWEEN  6 AND  8 THEN 'insight'
     WHEN si.student_class BETWEEN  9 AND 10 THEN 'subject'
     WHEN si.student_class BETWEEN 11 AND 12 THEN 'career'
     ELSE 'career'
   END
SET gr.report_subtype_id = rs.report_subtype_id
WHERE gr.report_subtype_id IS NULL;
