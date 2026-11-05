package ma.ensam.quizflow.session;

import ma.ensam.quizflow.activity.Activity;
import ma.ensam.quizflow.activity.ActivityEnums.ActivityType;
import ma.ensam.quizflow.activity.ActivityRepository;
import ma.ensam.quizflow.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cache mémoire du contenu des activités en cours de jeu.
 * L'activité est lue UNE fois dans MongoDB au lancement ; ensuite toutes les réponses sont
 * vérifiées depuis la mémoire. Après un redémarrage du serveur, le cache se recharge tout seul.
 */
@Component
public class LiveSessionRegistry {

    /** Copie figée de l'activité pour une session. */
    public record ActivitySnapshot(String activityId, String title, ActivityType type, List<Activity.Question> questions) {

        public Activity.Question questionAt(int index) {
            return questions.get(index);
        }

        public Optional<Activity.Question> question(String questionId) {
            return questions.stream().filter(q -> q.getId().equals(questionId)).findFirst();
        }
    }

    private final Map<UUID, ActivitySnapshot> cache = new ConcurrentHashMap<>();
    private final ActivityRepository activities;

    public LiveSessionRegistry(ActivityRepository activities) {
        this.activities = activities;
    }

    public void register(UUID sessionId, Activity activity) {
        cache.put(sessionId, snapshotOf(activity));
    }

    public ActivitySnapshot get(Session session) {
        return cache.computeIfAbsent(session.getId(), id -> activities.findById(session.getActivityId())
                .map(LiveSessionRegistry::snapshotOf)
                .orElseThrow(() -> new ApiException(HttpStatus.GONE, "ACTIVITY_GONE",
                        "L'activité de cette session n'existe plus")));
    }

    public void release(UUID sessionId) {
        cache.remove(sessionId);
    }

    private static ActivitySnapshot snapshotOf(Activity a) {
        return new ActivitySnapshot(a.getId(), a.getTitle(), a.getType(), List.copyOf(a.getQuestions()));
    }
}
