-- ---------------------------------------------------------------------------
-- V20260528001__password_reset_token_table.sql
--
-- Single-use, time-bounded password reset tokens. One row per outstanding
-- reset request — see PasswordResetToken entity + PasswordResetTokenRepository.
--
-- Token is a server-generated UUID stored verbatim (length 36 covers the
-- canonical UUID format; column sized 64 for headroom in case the generator
-- is later swapped for a longer random base64url string).
--
-- Lifecycle invariants enforced in service code (AuthController):
--   - Prior unused tokens for the same user are deleted on each /forgot-password
--     request so only the latest link is live (prevents email-trail replay).
--   - used_at is stamped atomically with the password update so the same link
--     cannot be consumed by a second request.
-- ---------------------------------------------------------------------------

CREATE TABLE password_reset_token (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  user_id     BIGINT       NOT NULL,
  token       VARCHAR(64)  NOT NULL,
  expires_at  DATETIME(6)  NOT NULL,
  created_at  DATETIME(6)  NOT NULL,
  used_at     DATETIME(6)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY idx_prt_token (token),
  KEY idx_prt_user (user_id),
  KEY idx_prt_expires (expires_at),
  CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES student_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
