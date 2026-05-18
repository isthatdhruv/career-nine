-- V20260511007: Create user_role_scope — scope attached to each role-assignment.
--
-- Replaces user_scope (dropped in V20260511006). Per project decision 2026-05-11,
-- the 4 ABAC attributes (institute, session, class, section) are attached to a
-- specific (user, role) pair, NOT to the user globally. This lets one user be a
-- Teacher at School A and a Counsellor at School B with different scopes per role.
--
-- The FK to user_role_group_mapping is the load-bearing change: a scope grant
-- doesn't exist without an underlying role grant. ON DELETE CASCADE because if an
-- admin removes a role assignment, all its scope grants go with it.
--
-- Wildcard semantics (unchanged from user_scope): NULL at a level means "all of
-- them" within the parent. So (institute=5, session=NULL, course_code=NULL,
-- section_id=NULL) means "all sessions/classes/sections of institute 5".
--
-- Containment constraint: cannot have a section without a class, cannot have a
-- class without (session OR institute), cannot have a session without institute.
-- Enforced on MySQL 8+; parsed-but-not-enforced on MySQL 5.7 (service-layer guard
-- in Phase 15 covers 5.7).

CREATE TABLE user_role_scope (
  id                            BIGINT      PRIMARY KEY AUTO_INCREMENT,

  -- The role-assignment this scope grant is attached to.
  user_role_group_mapping_id    INT         NOT NULL,

  -- The four ABAC attributes; NULL = wildcard at that level.
  institute_id                  INT         NULL,
  session_id                    INT         NULL,
  course_code                   INT         NULL,
  section_id                    INT         NULL,

  created_at                    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by                    BIGINT      NULL,

  INDEX idx_urs_assignment (user_role_group_mapping_id),
  INDEX idx_urs_scope      (institute_id, session_id, course_code, section_id),

  CONSTRAINT fk_urs_assignment FOREIGN KEY (user_role_group_mapping_id)
    REFERENCES user_role_group_mapping(id) ON DELETE CASCADE,
  CONSTRAINT fk_urs_institute  FOREIGN KEY (institute_id) REFERENCES institute_detail_new(institute_code),
  CONSTRAINT fk_urs_session    FOREIGN KEY (session_id)   REFERENCES institute_session(session_id),
  CONSTRAINT fk_urs_course     FOREIGN KEY (course_code)  REFERENCES institute_courses(course_code),
  CONSTRAINT fk_urs_section    FOREIGN KEY (section_id)   REFERENCES section(id),

  CONSTRAINT chk_urs_containment CHECK (
       (section_id IS NULL OR course_code IS NOT NULL)
    AND (course_code IS NULL OR session_id IS NOT NULL OR institute_id IS NOT NULL)
    AND (session_id IS NULL OR institute_id IS NOT NULL)
  )
);
