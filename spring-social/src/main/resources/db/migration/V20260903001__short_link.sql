-- Short links for the tokenized URLs we email and WhatsApp to students.
--
-- The links themselves were never the problem; the tokens are. A counselling
-- booking link carries an HS512 JWT — ~260 characters, of which the signature
-- alone is 86 — so what arrives in a student's inbox wraps over seven lines of
-- purple text. This table maps a 7-character code to that full URL, and
-- /s/{code} redirects to it.
--
-- No expiry is set. The target URL carries its own token with its own validity,
-- and that token is what actually gates access; a short link that expired ahead
-- of its target would break a link the student was still entitled to use. The
-- column exists for a future cleanup job, not for security.

CREATE TABLE IF NOT EXISTS short_link (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    code           VARCHAR(16)  NOT NULL,
    target_url     TEXT         NOT NULL,
    -- SHA-256 of target_url. MySQL cannot index a TEXT column usefully, and this
    -- is what lets a re-send of the same link reuse its existing code instead of
    -- adding a row every time an admin presses the button.
    target_hash    CHAR(64)     NOT NULL,
    -- Free-text tag ("counselling_booking", "final_report", …) for support: given
    -- a code from a student's mail, say what kind of link it was.
    purpose        VARCHAR(64)  NULL,
    expires_at     DATETIME     NULL,
    -- Whether the student ever opened it, which is the question support actually
    -- asks. Updated best-effort on redirect; never blocks the redirect.
    hit_count      INT          NOT NULL DEFAULT 0,
    last_hit_at    DATETIME     NULL,
    created_at     DATETIME     NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_short_link_code (code),
    KEY idx_short_link_target_hash (target_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
