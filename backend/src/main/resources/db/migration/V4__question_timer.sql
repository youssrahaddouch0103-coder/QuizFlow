-- Minuteur par question : durée choisie par l'enseignant et échéance de la question ouverte.
ALTER TABLE sessions ADD COLUMN question_duration_seconds INTEGER;
ALTER TABLE sessions ADD COLUMN question_deadline TIMESTAMPTZ;
-- Le job de fermeture automatique cherche les questions ouvertes dont l'échéance est passée.
CREATE INDEX ix_sessions_question_deadline ON sessions (question_deadline) WHERE state = 'QUESTION_OUVERTE';
