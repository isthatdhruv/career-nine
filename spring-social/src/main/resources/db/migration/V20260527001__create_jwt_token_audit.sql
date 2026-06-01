-- ---------------------------------------------------------------------------
-- V20260527001__create_jwt_token_audit.sql
--
-- Super-admin JWT audit table. Records one row per JWT minted by
-- `TokenProvider` (access, refresh, assessment, legacy) so the super-admin
-- console can answer "which token was issued to whom, when, from where, and
-- is it still live".
--
-- Industry-standard fields (subset of RFC 7519 + operational metadata):
--   jti            — RFC 7519 unique token id (also row PK)
--   user_id        — RFC 7519 `sub` (subject) — owning user
--   user_email     — denormalised for fast list display without a join
--   token_type     — ACCESS | REFRESH | ASSESSMENT | LEGACY
--   issued_at      — RFC 7519 `iat`
--   expires_at     — RFC 7519 `exp`
--   not_before     — RFC 7519 `nbf` (currently == issued_at; kept for parity)
--   revoked_at     — when the token was force-revoked (NULL = still live)
--   revoked_by     — admin user_id who triggered the revoke (NULL = system,
--                    e.g. logout/rotation/expiry)
--   revocation_reason — short free text (e.g. "User logout", "Rotated",
--                    "Force-revoked by admin")
--   ip_address     — client IP at issuance (IPv6-safe 45 chars)
--   user_agent     — client User-Agent at issuance (truncated 512)
--   roles_snapshot — comma-joined role codes at the moment of issuance —
--                    important because the user's roles may have changed
--                    since the token was minted
--   super_admin    — whether the holder was super-admin at issuance time
--   issuer         — RFC 7519 `iss` (defaults to "career-nine")
--
-- Audit is BEST-EFFORT — `JwtTokenAuditService.record` swallows exceptions so
-- a DB outage cannot break login. The deny-list (`JtiDenyListService`) remains
-- the source of truth for "is this token revoked" at the auth-filter layer;
-- this table is the *durable* record so super-admin can act after a JVM restart.
-- ---------------------------------------------------------------------------

CREATE TABLE jwt_token_audit (
  jti                CHAR(36)      NOT NULL,
  user_id            BIGINT        NOT NULL,
  user_email         VARCHAR(255)  NULL,
  token_type         VARCHAR(16)   NOT NULL,
  issued_at          DATETIME      NOT NULL,
  expires_at         DATETIME      NOT NULL,
  not_before         DATETIME      NULL,
  revoked_at         DATETIME      NULL,
  revoked_by         BIGINT        NULL,
  revocation_reason  VARCHAR(255)  NULL,
  ip_address         VARCHAR(45)   NULL,
  user_agent         VARCHAR(512)  NULL,
  roles_snapshot     VARCHAR(512)  NULL,
  super_admin        TINYINT(1)    NOT NULL DEFAULT 0,
  issuer             VARCHAR(64)   NULL,
  PRIMARY KEY (jti),
  KEY idx_jta_user        (user_id),
  KEY idx_jta_issued      (issued_at),
  KEY idx_jta_expires     (expires_at),
  KEY idx_jta_revoked     (revoked_at),
  KEY idx_jta_token_type  (token_type),
  CONSTRAINT fk_jta_user FOREIGN KEY (user_id) REFERENCES student_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
