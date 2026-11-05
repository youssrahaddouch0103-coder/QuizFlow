-- Schéma PostgreSQL initial (MLD P2).
-- Les activités, questions et choix sont dans MongoDB : *_id de type VARCHAR, sans clé étrangère.

CREATE TABLE teachers (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(100) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_teachers_email ON teachers (lower(email));

CREATE TABLE sessions (
    id                     UUID PRIMARY KEY,
    code                   VARCHAR(6)   NOT NULL,
    teacher_id             BIGINT       NOT NULL REFERENCES teachers (id),
    activity_id            VARCHAR(64)  NOT NULL,
    activity_title         VARCHAR(200) NOT NULL,
    activity_type          VARCHAR(20)  NOT NULL,
    question_count         INTEGER      NOT NULL,
    state                  VARCHAR(30)  NOT NULL,
    current_question_index INTEGER,
    current_question_id    VARCHAR(64),
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    started_at             TIMESTAMPTZ,
    ended_at               TIMESTAMPTZ,
    last_action_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_sessions_state CHECK (state IN
        ('EN_ATTENTE', 'QUESTION_OUVERTE', 'QUESTION_FERMEE', 'TERMINEE', 'ANNULEE'))
);
-- Un code est unique parmi les sessions actives (il peut être réutilisé ensuite).
CREATE UNIQUE INDEX ux_sessions_code_active ON sessions (code)
    WHERE state NOT IN ('TERMINEE', 'ANNULEE');
CREATE INDEX ix_sessions_teacher ON sessions (teacher_id, created_at DESC);
CREATE INDEX ix_sessions_activity ON sessions (activity_id);

CREATE TABLE participants (
    id         UUID PRIMARY KEY,
    session_id UUID        NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
    pseudo     VARCHAR(30) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- R3 : pseudo unique dans une session, sans tenir compte de la casse.
CREATE UNIQUE INDEX ux_participants_pseudo ON participants (session_id, lower(pseudo));
CREATE UNIQUE INDEX ux_participants_token ON participants (token_hash);

CREATE TABLE answers (
    id             UUID PRIMARY KEY,
    participant_id UUID        NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
    session_id     UUID        NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
    question_id    VARCHAR(64) NOT NULL,
    is_correct     BOOLEAN,               -- NULL pour un sondage
    answered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- R4 : une seule réponse par participant et par question.
    CONSTRAINT ux_answers_participant_question UNIQUE (participant_id, question_id)
);
CREATE INDEX ix_answers_session_question ON answers (session_id, question_id);

CREATE TABLE answer_choices (
    answer_id UUID        NOT NULL REFERENCES answers (id) ON DELETE CASCADE,
    choice_id VARCHAR(64) NOT NULL,
    PRIMARY KEY (answer_id, choice_id)
);

CREATE TABLE participant_results (
    participant_id UUID PRIMARY KEY REFERENCES participants (id) ON DELETE CASCADE,
    score          INTEGER NOT NULL,
    rank           INTEGER NOT NULL
);

CREATE TABLE question_stats (
    session_id   UUID             NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
    question_id  VARCHAR(64)      NOT NULL,
    position     INTEGER          NOT NULL,
    answer_count INTEGER          NOT NULL,
    success_rate DOUBLE PRECISION,      -- NULL pour un sondage
    distribution JSONB            NOT NULL,
    PRIMARY KEY (session_id, question_id)
);
