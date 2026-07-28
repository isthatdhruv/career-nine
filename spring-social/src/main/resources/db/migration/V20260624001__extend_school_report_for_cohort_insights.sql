-- Cohort-insights generation lifecycle fields layered onto the existing school_report table.
-- generation_status is SEPARATE from the existing `status` column ("generated"/"stale") so the
-- BET school-report flow that writes `status` is left untouched.
ALTER TABLE school_report
  ADD COLUMN generation_status VARCHAR(20)  NULL,
  ADD COLUMN logic_version     VARCHAR(64)  NULL,
  ADD COLUMN generated_by      BIGINT       NULL,
  ADD COLUMN completed_count   INT          NULL;
