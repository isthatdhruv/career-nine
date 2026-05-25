-- ---------------------------------------------------------------------------
-- V20260525001__reminder_tables.sql
--
-- Reminder Management feature — schema.
--
-- Three new tables for managing scheduled reminder emails (B2C assessment
-- invite nudges, counselling 24h/1h reminders, and the new generic
-- assessment-mapping reminder), plus their delivery log and per-student
-- suppressions. ServiceDeliveryLog (B2C-only) remains intact for historical
-- reads; new sends after this migration write to reminder_delivery_log.
-- ---------------------------------------------------------------------------

-- 1. Per-service configuration (one row per service_type).
CREATE TABLE IF NOT EXISTS reminder_config (
  id                       BIGINT       NOT NULL AUTO_INCREMENT,
  service_type             VARCHAR(40)  NOT NULL,
  enabled                  TINYINT(1)   NOT NULL DEFAULT 1,
  cron_expression          VARCHAR(64)  NOT NULL,
  lead_time_minutes        INT          NULL,
  max_sends_per_recipient  INT          NULL,
  subject_template         VARCHAR(500) NOT NULL,
  body_template            MEDIUMTEXT   NOT NULL,
  updated_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by               BIGINT       NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_reminder_config_service_type (service_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Per-student opt-outs (suppress a specific service_type for a specific student).
CREATE TABLE IF NOT EXISTS reminder_suppression (
  id              BIGINT      NOT NULL AUTO_INCREMENT,
  user_student_id BIGINT      NOT NULL,
  service_type    VARCHAR(40) NOT NULL,
  reason          VARCHAR(500) NULL,
  suppressed_by   BIGINT      NULL,
  suppressed_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_reminder_suppression_student_service (user_student_id, service_type),
  KEY ix_reminder_suppression_service (service_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Delivery log. One row per send attempt (scheduled or manual).
CREATE TABLE IF NOT EXISTS reminder_delivery_log (
  id                        BIGINT       NOT NULL AUTO_INCREMENT,
  service_type              VARCHAR(40)  NOT NULL,
  recipient                 VARCHAR(200) NULL,
  user_student_id           BIGINT       NULL,
  institute_code            INT          NULL,
  subject                   VARCHAR(300) NULL,
  body_snapshot             MEDIUMTEXT   NULL,
  link_url                  VARCHAR(1000) NULL,
  delivery_status           VARCHAR(20)  NOT NULL DEFAULT 'sent',
  failure_reason            VARCHAR(500) NULL,
  triggered_by              VARCHAR(20)  NOT NULL DEFAULT 'SCHEDULED',
  triggered_by_user_id      BIGINT       NULL,
  entitlement_id            BIGINT       NULL,
  appointment_id            BIGINT       NULL,
  assessment_mapping_id     BIGINT       NULL,
  sent_at                   DATETIME     NULL,
  created_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_reminder_log_service_status (service_type, delivery_status),
  KEY ix_reminder_log_recipient (recipient),
  KEY ix_reminder_log_sent_at (sent_at),
  KEY ix_reminder_log_institute (institute_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Seed default config rows so the system has working defaults from day 1.
INSERT INTO reminder_config
  (service_type, enabled, cron_expression, lead_time_minutes, max_sends_per_recipient, subject_template, body_template)
VALUES
  ('ASSESSMENT_INVITE_B2C', 1, '0 23 * * * *', NULL, 2,
   'Reminder: complete your career assessment',
   '<p>Hi {{studentName}},</p><p>You have not yet started your career assessment <b>{{assessmentName}}</b>. Click the link below to begin:</p><p><a href="{{link}}">{{link}}</a></p>'),
  ('COUNSELLING_24H', 1, '0 0 * * * *', 1440, NULL,
   'Reminder: your counselling session is tomorrow',
   '<p>Hi {{studentName}},</p><p>Your counselling session with <b>{{counsellorName}}</b> is scheduled for <b>{{appointmentTime}}</b>.</p><p>Join here: <a href="{{meetingUrl}}">{{meetingUrl}}</a></p>'),
  ('COUNSELLING_1H', 1, '0 0 * * * *', 60, NULL,
   'Your counselling session starts in an hour',
   '<p>Hi {{studentName}},</p><p>Your counselling session starts at <b>{{appointmentTime}}</b>. Join here: <a href="{{meetingUrl}}">{{meetingUrl}}</a></p>'),
  ('ASSESSMENT_MAPPING', 1, '0 15 * * * *', 4320, 3,
   'Reminder: complete your assigned assessment',
   '<p>Hi {{studentName}},</p><p>You have an assigned assessment <b>{{assessmentName}}</b> from {{instituteName}} that you have not yet started. Please complete it at your earliest convenience.</p><p><a href="{{link}}">{{link}}</a></p>')
ON DUPLICATE KEY UPDATE service_type = service_type;
