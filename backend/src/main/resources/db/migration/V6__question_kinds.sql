-- Nouveaux types de questions : nuage de mots, texte libre, note, classement, questions du public, idées.

-- Réponse en texte (nuage de mots, texte libre, ordre d'un classement) ou en nombre (note de 1 à 5).
ALTER TABLE answers ADD COLUMN text_value VARCHAR(500);
ALTER TABLE answers ADD COLUMN number_value INTEGER;

-- Résultats figés propres à chaque type (mots, textes, note moyenne, classement, contributions).
ALTER TABLE question_stats ADD COLUMN details JSONB;

-- Questions du public et idées : chaque étudiant peut publier plusieurs contributions.
CREATE TABLE contributions (
    id             UUID PRIMARY KEY,
    session_id     UUID         NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
    question_id    VARCHAR(64)  NOT NULL,
    participant_id UUID         NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
    text           VARCHAR(300) NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    done           BOOLEAN      NOT NULL DEFAULT FALSE,  -- marquée « traitée » par l'enseignant
    hidden         BOOLEAN      NOT NULL DEFAULT FALSE   -- masquée par l'enseignant
);
CREATE INDEX ix_contributions_session_question ON contributions (session_id, question_id);

-- Un vote par étudiant et par contribution.
CREATE TABLE contribution_votes (
    contribution_id UUID NOT NULL REFERENCES contributions (id) ON DELETE CASCADE,
    participant_id  UUID NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
    PRIMARY KEY (contribution_id, participant_id)
);
