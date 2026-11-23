package ma.ensam.quizflow.activity;

/** Énumérations du modèle (P2 §2). */
public final class ActivityEnums {

    private ActivityEnums() {
    }

    public enum ActivityType { QUIZ, SONDAGE }

    public enum ActivityStatus { BROUILLON, PRETE, ARCHIVEE }

    public enum ChoiceMode { UNIQUE, MULTIPLE }

    /**
     * Type d'une question. CHOIX : choix unique ou multiple (seul type noté dans un quiz).
     * NUAGE : un mot ou une courte expression, affichés en nuage de mots. TEXTE : réponse libre.
     * NOTE : note de 1 à 5. CLASSEMENT : les éléments sont classés par ordre de préférence.
     * QR : les étudiants posent des questions et votent pour celles des autres. IDEES : même principe pour des idées.
     */
    public enum QuestionKind {
        CHOIX, NUAGE, TEXTE, NOTE, CLASSEMENT, QR, IDEES;

        /** Le type utilise la liste des choix (réponses proposées ou éléments à classer). */
        public boolean usesChoices() {
            return this == CHOIX || this == CLASSEMENT;
        }

        /** Les étudiants publient des contributions et votent (pas de réponse unique). */
        public boolean isContribution() {
            return this == QR || this == IDEES;
        }
    }
}
