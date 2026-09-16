-- Photos of handwritten session notes, uploaded by the counsellor from the
-- "Add Notes" form after a counselling session.
--
-- The files themselves live in the same DigitalOcean Spaces bucket as the
-- rendered student reports (storage-c9, under report-renders/session-notes/
-- appointment-<id>/). This table only records the object URL so the portal
-- can list, show and remove them.
--
-- Keyed by appointment, not by session_notes.id: the counsellor may upload a
-- photo before pressing "Save Notes", when no session_notes row exists yet.

CREATE TABLE IF NOT EXISTS session_notes_photo (
    id                  BIGINT        NOT NULL AUTO_INCREMENT,
    appointment_id      BIGINT        NOT NULL,
    file_url            VARCHAR(1024) NOT NULL,
    object_key          VARCHAR(512)  NOT NULL,
    content_type        VARCHAR(100)  NULL,
    file_size           BIGINT        NULL,
    original_file_name  VARCHAR(255)  NULL,
    uploaded_by_user_id BIGINT        NULL,
    created_at          DATETIME      NULL,
    PRIMARY KEY (id),
    KEY idx_session_notes_photo_appointment (appointment_id),
    CONSTRAINT fk_session_notes_photo_appointment
        FOREIGN KEY (appointment_id) REFERENCES counselling_appointment (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
