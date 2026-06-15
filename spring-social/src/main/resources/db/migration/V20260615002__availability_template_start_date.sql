-- Effective-from date for a counsellor's availability template. Slots are
-- materialized from max(start_date, tomorrow) onward. NULL = start immediately.
ALTER TABLE availability_template
    ADD COLUMN start_date DATE NULL AFTER mode;
