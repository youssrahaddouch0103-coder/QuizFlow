package ma.ensam.quizflow.activity;

/** Énumérations du modèle (P2 §2). */
public final class ActivityEnums {

    private ActivityEnums() {
    }

    public enum ActivityType { QUIZ, SONDAGE }

    public enum ActivityStatus { BROUILLON, PRETE, ARCHIVEE }

    public enum ChoiceMode { UNIQUE, MULTIPLE }
}
