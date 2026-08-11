-- Per-scope generated dashboards for the School Dashboard page.
--
-- One row per (institute, scope). A "scope" is a point on the filter lattice the
-- principal's filter rail exposes: the institute as a whole, a session, a class, a
-- section, or a group. Releasing a dashboard generates the whole lattice in one
-- batch (~25 rows for a typical school), each row carrying:
--
--   internal_calculation  deterministic aggregates, the same producers the Reports
--                         Hub "Mira Desai" exports use (school dashboard sheet +
--                         psychometric properties sheet)
--   ai_response           the OpenAI JSON for that scope, schema-constrained
--   docx_path             rendered .docx, produced FROM ai_response — deliberately
--                         left null by this migration
--
-- Boundary with school_report: that table remains exclusively the Cohort Insights
-- store (institute + assessment, no scoping). This pipeline never writes it, and
-- CohortInsightGenerationService never writes this table.

CREATE TABLE principal_dashboard_data (
    id                    BIGINT       NOT NULL AUTO_INCREMENT,

    institute_code        BIGINT       NOT NULL,
    assessment_id         BIGINT       NOT NULL,

    -- Canonical scope identity. Produced by exactly one serialiser (ScopeKey) which
    -- both the writer and the reader call, e.g. 'a:12|s:3|c:10|x:null|g:null'.
    --
    -- The unique constraint is on this string rather than on the four dimension
    -- columns because MySQL treats NULLs as distinct inside a unique index: a
    -- composite key over nullable columns would silently permit two "all classes"
    -- rows for the same institute. The dimension columns below are kept as real
    -- columns so the table stays queryable and reportable, not to enforce identity.
    scope_key             VARCHAR(128) NOT NULL,
    scope_level           VARCHAR(16)  NOT NULL,  -- INSTITUTE|SESSION|CLASS|SECTION|GROUP

    session_id            BIGINT       NULL,      -- NULL = unconstrained on this dimension
    class_id              BIGINT       NULL,
    section_id            BIGINT       NULL,
    group_id              BIGINT       NULL,

    internal_calculation  LONGTEXT     NULL,
    ai_response           LONGTEXT     NULL,
    docx_path             VARCHAR(512) NULL,

    -- PENDING | GENERATING | GENERATED | FAILED | SKIPPED_SMALL_COHORT
    -- Status is per scope, not per release: one scope failing its OpenAI call must
    -- not void the other 24, and a retry targets that row alone.
    generation_status     VARCHAR(24)  NOT NULL DEFAULT 'PENDING',
    error_message         TEXT         NULL,

    -- Separate from updated_at on purpose. updated_at moves on any write, including
    -- a staleness flag flip; generated_at answers "when was this content produced",
    -- which is what the dashboard shows the principal.
    generated_at          TIMESTAMP    NULL,
    generated_by          BIGINT       NULL,
    release_id            CHAR(36)     NULL,      -- groups the rows of one Release click

    -- Staleness baseline. Held per scope so a new student in 10-B ages the institute,
    -- session, class-10 and section-10B rows independently instead of flipping the
    -- whole school at once.
    scored_count          INT          NULL,
    scored_at_generation  INT          NULL,

    -- Thresholds in force when this row was generated, stamped so that later config
    -- changes do not retroactively reinterpret rows already produced.
    min_cohort_size       INT          NULL,
    stale_threshold       INT          NULL,

    logic_version         VARCHAR(64)  NULL,
    prompt_version        VARCHAR(32)  NULL,

    created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uk_pdd_scope (institute_code, scope_key),
    KEY idx_pdd_release (release_id),
    KEY idx_pdd_institute_assessment (institute_code, assessment_id),
    KEY idx_pdd_status (generation_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
