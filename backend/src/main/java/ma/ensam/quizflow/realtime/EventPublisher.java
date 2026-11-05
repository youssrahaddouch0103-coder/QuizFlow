package ma.ensam.quizflow.realtime;

/** Diffusion des événements d'une session. L'implémentation STOMP est interchangeable (tests, autre broker). */
public interface EventPublisher {

    /** Canal public, écouté par les étudiants et l'enseignant : /topic/sessions/{code}. */
    void publish(String code, LiveEvent event);

    /** Canal réservé à l'enseignant propriétaire : /topic/sessions/{code}/teacher. */
    void publishToTeacher(String code, LiveEvent event);

    static String publicTopic(String code) {
        return "/topic/sessions/" + code;
    }

    static String teacherTopic(String code) {
        return "/topic/sessions/" + code + "/teacher";
    }
}
