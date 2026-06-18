-- ---------------------------------------------------------------------------
-- V20260616002__counselling_request.sql
--
-- Career counselling "interest" raised by a student when their assessment has
-- counselling in the package but NO counsellor mapped yet. The thank-you page
-- forwards it to the Career-9 team (email + this row); an admin then assigns a
-- counsellor on the Counsellor <-> Assessment page, which closes the request.
--
--   * counselling_request.status — PENDING | ASSIGNED | CLOSED.
--   * one open (PENDING) row per (student, assessment) is enforced in code.
--
-- Idempotent: the table is created only if absent. counselling_request is an
-- entity-mapped table; Flyway runs before Hibernate ddl-auto, so if this is
-- skipped, ddl-auto creates the table from the JPA entity instead.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS counselling_request (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    user_student_id BIGINT       NOT NULL,
    assessment_id   BIGINT       NOT NULL,
    institute_code  INT          NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at      DATETIME     NULL,
    updated_at      DATETIME     NULL,
    PRIMARY KEY (id),
    KEY idx_cr_status (status),
    KEY idx_cr_assessment_status (assessment_id, status),
    KEY idx_cr_student_assessment (user_student_id, assessment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
