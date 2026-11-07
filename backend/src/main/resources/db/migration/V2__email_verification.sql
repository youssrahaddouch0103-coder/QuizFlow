CREATE TABLE pending_registrations (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    code_mac BYTEA NOT NULL,
    code_version INTEGER NOT NULL DEFAULT 1 CHECK (code_version >= 1),
    failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    resend_available_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_pending_registrations_email ON pending_registrations (lower(email));
CREATE INDEX ix_pending_registrations_expiry ON pending_registrations (expires_at);

CREATE TABLE verified_account_emails (
    teacher_id BIGINT PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auth_rate_limits (
    bucket_key VARCHAR(128) PRIMARY KEY,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL CHECK (request_count >= 0),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_auth_rate_limits_expiry ON auth_rate_limits (expires_at);
