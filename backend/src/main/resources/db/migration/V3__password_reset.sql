ALTER TABLE teachers ADD COLUMN auth_version BIGINT NOT NULL DEFAULT 0;

CREATE TABLE password_reset_codes (
    teacher_id BIGINT PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
    nonce UUID NOT NULL,
    code_mac VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
