CREATE TABLE teacher_google_accounts (
    google_subject VARCHAR(255) PRIMARY KEY,
    teacher_id BIGINT NOT NULL UNIQUE REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE TABLE google_auth_challenges (
    nonce UUID PRIMARY KEY,
    browser_proof VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX ix_google_auth_challenges_expiry ON google_auth_challenges (expires_at);
