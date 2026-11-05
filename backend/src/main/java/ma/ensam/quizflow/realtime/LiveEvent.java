package ma.ensam.quizflow.realtime;

import java.time.Instant;

/**
 * Message temps réel envoyé sur un canal STOMP.
 * Exemple : { "type": "QUESTION_OPENED", "payload": { ... }, "at": "2026-11-05T10:00:00Z" }
 */
public record LiveEvent(EventType type, Object payload, Instant at) {

    public enum EventType {
        // Canal public /topic/sessions/{code}
        QUESTION_OPENED,
        QUESTION_CLOSED,
        SESSION_ENDED,
        SESSION_CANCELLED,
        // Canal enseignant /topic/sessions/{code}/teacher
        PARTICIPANT_JOINED,
        ANSWER_STATS,
        SESSION_RESULTS
    }

    public static LiveEvent of(EventType type, Object payload) {
        return new LiveEvent(type, payload, Instant.now());
    }
}
