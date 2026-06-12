-- ---------------------------------------------------------------------------
-- V20260606007__institute_add_whitelabel.sql
--
-- Per-school whitelabel of the student-facing assessment ("Career-9 x School").
--
-- Two columns on institute_detail_new:
--   * logo_url     — public DigitalOcean Spaces CDN URL of the school logo,
--                    uploaded at institute create/edit time (PNG/JPG only, for
--                    email-client compatibility). Supersedes the legacy
--                    school_logo LONGBLOB, which is left untouched. NULLABLE.
--   * is_whitelabel — opt-in toggle. When 1, students linked to this institute see
--                     school co-branding on the registration page / assessment
--                     legend / thank-you page (logo replaces the Career-9 mark,
--                     grey "Powered by Career-9" subline retained) and receive
--                     co-branded credential/completion emails. Defaults to 0 so
--                     existing institutes keep the standard Career-9 experience.
--                     NULL is treated as FALSE by application code.
-- ---------------------------------------------------------------------------

ALTER TABLE institute_detail_new
  ADD COLUMN logo_url VARCHAR(500) NULL,
  ADD COLUMN is_whitelabel TINYINT(1) NULL DEFAULT 0;
