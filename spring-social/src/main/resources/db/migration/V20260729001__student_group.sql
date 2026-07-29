-- ---------------------------------------------------------------------------
-- V20260729001__student_group.sql
--
-- Named, institute-owned groups of hand-picked students, administered by one or
-- more contact persons. Deliberately independent of session / class / section:
-- there is no FK to school_session, school_classes or school_sections, and
-- membership is never derived from them. A group may freely mix Class 6 and
-- Class 12 students.
--
-- Three tables:
--   student_group          — the group itself, owned by an institute
--   student_group_member   — students in the group      (many-to-many)
--   student_group_contact  — contact persons who admin it (many-to-many)
--
-- The two join tables are deliberate mirror images: same shape, same
-- (group, target) unique key, so bulk add is idempotent on both sides. That
-- unique key is the thing student_contact_assignment lacks today, where
-- re-assigning the same student silently duplicates rows.
--
-- Idempotent: every statement is guarded with an information_schema check.
-- MySQL has no `CREATE INDEX IF NOT EXISTS`, and `spring.jpa.hibernate.
-- ddl-auto: update` is enabled in EVERY profile (dev, sandbox, production) —
-- so Hibernate may already have created these tables from the @Entity classes
-- before Flyway runs. An unguarded CREATE/ALTER would then fail the migration
-- and block startup.
--
-- Column types are chosen to match what Hibernate generates for the mapped
-- entities (BIGINT for Long ids, INT for the Integer institute_code) so the
-- two cannot drift across environments.
-- ---------------------------------------------------------------------------

-- ── student_group ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_group (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  institute_code  INT          NOT NULL,
  name            VARCHAR(150) NOT NULL,
  description     VARCHAR(500) NULL,
  active          BIT(1)       NOT NULL DEFAULT b'1',
  created_at      DATETIME     NOT NULL,
  created_by      BIGINT       NULL,
  updated_at      DATETIME     NULL,
  updated_by      BIGINT       NULL,
  PRIMARY KEY (id),
  -- A school cannot have two groups of the same name. The service compares
  -- case-insensitively before insert so callers get a 409 with a message
  -- rather than a driver exception.
  UNIQUE KEY uk_student_group_institute_name (institute_code, name),
  CONSTRAINT fk_student_group_institute
    FOREIGN KEY (institute_code) REFERENCES institute_detail (institute_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── student_group_member ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_group_member (
  id               BIGINT   NOT NULL AUTO_INCREMENT,
  student_group_id BIGINT   NOT NULL,
  user_student_id  BIGINT   NOT NULL,
  added_at         DATETIME NOT NULL,
  added_by         BIGINT   NULL,
  PRIMARY KEY (id),
  -- Makes bulk add idempotent.
  UNIQUE KEY uk_student_group_member (student_group_id, user_student_id),
  -- Reverse lookup (student -> groups) and the ABAC row filter both drive
  -- off this index.
  KEY idx_student_group_member_student (user_student_id),
  CONSTRAINT fk_student_group_member_group
    FOREIGN KEY (student_group_id) REFERENCES student_group (id) ON DELETE CASCADE,
  CONSTRAINT fk_student_group_member_student
    FOREIGN KEY (user_student_id) REFERENCES user_student (user_student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── student_group_contact ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_group_contact (
  id                BIGINT   NOT NULL AUTO_INCREMENT,
  student_group_id  BIGINT   NOT NULL,
  contact_person_id BIGINT   NOT NULL,
  assigned_at       DATETIME NOT NULL,
  assigned_by       BIGINT   NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_student_group_contact (student_group_id, contact_person_id),
  -- "Groups I administer" is a first-class query, not an afterthought.
  KEY idx_student_group_contact_person (contact_person_id),
  CONSTRAINT fk_student_group_contact_group
    FOREIGN KEY (student_group_id) REFERENCES student_group (id) ON DELETE CASCADE,
  CONSTRAINT fk_student_group_contact_person
    FOREIGN KEY (contact_person_id) REFERENCES contact_person (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
