-- Admin overview dashboard: the "new sign-ups / registrations" card needs a
-- registration timestamp, and none of student_user / user_student / student_info
-- carried one. user_student is the row every registration path creates (bulk
-- B2B upload, B2C self sign-up, per-student invite), so it gets the stamp.
--
-- Added WITHOUT a default first so existing rows are not all stamped "now";
-- they are back-filled from the earliest evidence we have of the account, and
-- accounts with no evidence at all stay NULL (they never count as "new" inside
-- a date window, but still count under "All time").
ALTER TABLE user_student ADD COLUMN created_at DATETIME NULL;

-- 1. earliest login
UPDATE user_student us
  JOIN (SELECT user_id, MIN(login_time) AS t FROM user_activity_log GROUP BY user_id) l
    ON l.user_id = us.user_id
   SET us.created_at = l.t
 WHERE us.created_at IS NULL AND l.t IS NOT NULL;

-- 2. earliest generated report
UPDATE user_student us
  JOIN (SELECT user_student_id, MIN(created_at) AS t FROM generated_report GROUP BY user_student_id) r
    ON r.user_student_id = us.user_student_id
   SET us.created_at = r.t
 WHERE us.created_at IS NULL AND r.t IS NOT NULL;

-- 3. earliest assessment completion
UPDATE user_student us
  JOIN (SELECT user_student_id, MIN(completed_at) AS t FROM student_assessment_mapping GROUP BY user_student_id) m
    ON m.user_student_id = us.user_student_id
   SET us.created_at = m.t
 WHERE us.created_at IS NULL AND m.t IS NOT NULL;

-- 4. earliest counselling booking
UPDATE user_student us
  JOIN (SELECT student_id, MIN(created_at) AS t FROM counselling_appointment GROUP BY student_id) a
    ON a.student_id = us.user_student_id
   SET us.created_at = a.t
 WHERE us.created_at IS NULL AND a.t IS NOT NULL;

-- 5. DPDP consent stamp on the profile row
UPDATE user_student us
  JOIN student_info si ON si.id = us.id
   SET us.created_at = si.dpdp_consent_at
 WHERE us.created_at IS NULL AND si.dpdp_consent_at IS NOT NULL;

-- From here on every new registration is stamped by the database itself.
ALTER TABLE user_student MODIFY COLUMN created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX idx_user_student_created_at ON user_student (created_at);
