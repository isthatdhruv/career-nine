-- ---------------------------------------------------------------------------
-- V20260603001__generated_report_pdf_and_render_jobs.sql
--
-- Server-rendered report PDFs. Adds the stored-PDF columns to generated_report
-- and a durable render-job queue drained by an in-process scheduled poller.
--   generated_report.pdf_url     — Spaces URL of the rendered PDF (NULL until ready)
--   generated_report.pdf_status  — notRequested | pending | rendering | ready | failed
--                                  existing rows backfill to 'notRequested' (they have
--                                  HTML but no PDF/job, so must NOT appear as "rendering")
-- pdf_render_job is the queue + tracking source of truth (one active row per report).
-- ---------------------------------------------------------------------------

ALTER TABLE generated_report
  ADD COLUMN pdf_url    VARCHAR(4096) NULL,
  ADD COLUMN pdf_status VARCHAR(50)   NOT NULL DEFAULT 'notRequested';

CREATE TABLE pdf_render_job (
  pdf_render_job_id    BIGINT        NOT NULL AUTO_INCREMENT,
  generated_report_id  BIGINT        NOT NULL,
  report_url           VARCHAR(4096) NOT NULL,
  status               VARCHAR(50)   NOT NULL DEFAULT 'pending',
  attempts             INT           NOT NULL DEFAULT 0,
  max_attempts         INT           NOT NULL DEFAULT 3,
  last_error           TEXT          NULL,
  lease_until          DATETIME      NULL,
  created_at           DATETIME      NOT NULL,
  updated_at           DATETIME      NOT NULL,
  PRIMARY KEY (pdf_render_job_id),
  UNIQUE KEY uk_prj_generated_report (generated_report_id),
  KEY idx_prj_status_lease (status, lease_until),
  CONSTRAINT fk_prj_generated_report FOREIGN KEY (generated_report_id)
    REFERENCES generated_report(generated_report_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
