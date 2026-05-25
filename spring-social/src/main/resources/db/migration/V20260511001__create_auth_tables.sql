-- ---------------------------------------------------------------------------
-- V20260511001__create_auth_tables.sql
--
-- Phase 14 (ABAC Data Foundation) - Plan 14-01.
--
-- Creates the five tables that back the hybrid RBAC + ABAC model defined in
-- docs/AUTH_REDESIGN_PLAN.md sections 3-4:
--   - permission         (the verb catalog - seeded by Plan 14-02)
--   - role_permission    (RBAC join - seeded by Plan 14-02)
--   - user_scope         (ABAC scope grants - backfill by Plan 14-03/04)
--   - refresh_token      (Phase 18 will start writing rows)
--   - auth_audit         (Phase 15 will start writing rows)
--
-- Flyway versioning convention:
--   V<YYYYMMDDNNN>__<lowercase_snake_case_description>.sql
--   NNN is a 3-digit per-day sequence number; double-underscore separator.
--
-- FK targets confirmed against the live entity mappings:
--   student_user(id)                      BIGINT  (User.id  Long)
--   institute_detail_new(institute_code)  INT     (InstituteDetail.instituteCode Integer)
--   institute_session(session_id)         INT     (InstituteSession.sessionId int)
--   institute_courses(course_code)        INT     (InstituteCourse.courseCode int)
--   section(id)                           INT     (Section.id int)
--   role(id)                              INT     (Role.id int)
--
-- MySQL 5.7 vs 8.x note: the CHECK constraint on user_scope is parsed but
-- only ENFORCED on 8.x. On 5.7 it is a documentation-only hint; the JPA
-- layer (in a later plan) will enforce containment in service code as a
-- defense-in-depth measure. The constraint is named so it can be referenced
-- later if MySQL is upgraded.
-- ---------------------------------------------------------------------------

CREATE TABLE permission (
  id           BIGINT       NOT NULL AUTO_INCREMENT,
  code         VARCHAR(64)  NOT NULL,
  description  VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_permission_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_permission (
  role_id        INT    NOT NULL,
  permission_id  BIGINT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_rp_permission (permission_id),
  CONSTRAINT fk_rp_role       FOREIGN KEY (role_id)       REFERENCES role(id)       ON DELETE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permission(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_scope (
  id            BIGINT     NOT NULL AUTO_INCREMENT,
  user_id       BIGINT     NOT NULL,
  institute_id  INT        NULL,
  session_id    INT        NULL,
  course_code   INT        NULL,
  section_id    INT        NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    BIGINT     NULL,
  PRIMARY KEY (id),
  KEY idx_us_user (user_id),
  KEY idx_us_scope (institute_id, session_id, course_code, section_id),
  CONSTRAINT fk_us_user      FOREIGN KEY (user_id)      REFERENCES student_user(id)             ON DELETE CASCADE,
  CONSTRAINT fk_us_institute FOREIGN KEY (institute_id) REFERENCES institute_detail_new(institute_code),
  CONSTRAINT fk_us_session   FOREIGN KEY (session_id)   REFERENCES institute_session(session_id),
  CONSTRAINT fk_us_course    FOREIGN KEY (course_code)  REFERENCES institute_courses(course_code),
  CONSTRAINT fk_us_section   FOREIGN KEY (section_id)   REFERENCES section(id),
  CONSTRAINT chk_scope_containment CHECK (
        (section_id IS NULL OR course_code IS NOT NULL)
    AND (course_code IS NULL OR session_id IS NOT NULL OR institute_id IS NOT NULL)
    AND (session_id  IS NULL OR institute_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_token (
  jti          CHAR(36)     NOT NULL,
  user_id      BIGINT       NOT NULL,
  issued_at    DATETIME     NOT NULL,
  expires_at   DATETIME     NOT NULL,
  revoked_at   DATETIME     NULL,
  replaced_by  CHAR(36)     NULL,
  user_agent   VARCHAR(255) NULL,
  ip           VARCHAR(45)  NULL,
  PRIMARY KEY (jti),
  KEY idx_rt_user (user_id),
  KEY idx_rt_exp  (expires_at),
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES student_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auth_audit (
  id           BIGINT               NOT NULL AUTO_INCREMENT,
  ts           DATETIME(3)          NOT NULL,
  user_id      BIGINT               NULL,
  permission   VARCHAR(64)          NULL,
  scope        VARCHAR(128)         NULL,
  resource_id  VARCHAR(64)          NULL,
  decision     ENUM('ALLOW','DENY') NOT NULL,
  reason       VARCHAR(255)         NULL,
  request_id   CHAR(36)             NULL,
  PRIMARY KEY (id),
  KEY idx_aa_user_ts (user_id, ts),
  KEY idx_aa_deny    (decision, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
