-- Step-level trace of a dashboard release.
--
-- One row per scope per step. The release itself runs off-thread across many scopes and
-- can take minutes, so an admin watching it — or asking a week later why a scope is
-- missing — needs more than the final status the data row carries. The failure message is
-- the point: without it a failed release is a number with no explanation.
--
-- Kept indefinitely. A release writes roughly six rows per scope, so a 25-scope run adds
-- ~150 rows; that is cheap next to being able to explain any release that ever ran.
CREATE TABLE principal_dashboard_release_log (
    id              BIGINT       NOT NULL AUTO_INCREMENT,

    -- Groups every row written by one press of Release.
    release_id      VARCHAR(64)  NOT NULL,
    institute_code  BIGINT       NOT NULL,
    assessment_id   BIGINT       NULL,

    -- Which cohort. Null scope_key marks a release-level event (started, finished),
    -- which belongs to the run rather than to any one scope.
    scope_key       VARCHAR(255) NULL,
    scope_label     VARCHAR(255) NULL,

    -- PLANNED / SNAPSHOT / METRICS / AI_REQUEST / AI_RESPONSE / SAVED / SKIPPED /
    -- FAILED / RELEASE_STARTED / RELEASE_FINISHED
    step            VARCHAR(32)  NOT NULL,
    -- OK | FAILED | SKIPPED
    outcome         VARCHAR(16)  NOT NULL,

    -- Human-readable detail: the verdict, the token counts, or the exception message.
    message         TEXT         NULL,
    duration_ms     BIGINT       NULL,

    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    -- The log viewer always reads one release, newest step last.
    KEY idx_pdrl_release (release_id, id),
    -- "show me this school's history" without scanning the table.
    KEY idx_pdrl_institute (institute_code, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
