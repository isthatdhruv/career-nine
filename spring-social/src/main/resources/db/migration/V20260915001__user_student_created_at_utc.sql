-- user_student.created_at (V20260914001) defaulted to CURRENT_TIMESTAMP, which
-- MySQL evaluates in the server's session time zone. The Docker databases run in
-- UTC, so registrations showed up on the dashboard at "02:55 AM" for an 08:25 IST
-- sign-up. Pin the default to UTC explicitly so the column means the same thing
-- on every environment; the application converts UTC -> Asia/Kolkata when it
-- filters and displays the value.
--
-- Rows that already exist keep the wall-clock they were stamped with (UTC on
-- Docker, local time on a native MySQL whose system zone is not UTC).
ALTER TABLE user_student MODIFY COLUMN created_at DATETIME NULL DEFAULT (UTC_TIMESTAMP());
