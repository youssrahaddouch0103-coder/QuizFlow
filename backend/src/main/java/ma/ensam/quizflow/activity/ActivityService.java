package ma.ensam.quizflow.activity;

import ma.ensam.quizflow.activity.ActivityDtos.ActivityRequest;
import ma.ensam.quizflow.activity.ActivityDtos.ActivityView;
import ma.ensam.quizflow.activity.ActivityDtos.ChoiceRequest;
import ma.ensam.quizflow.activity.ActivityDtos.QuestionRequest;
import ma.ensam.quizflow.activity.ActivityEnums.ActivityStatus;
import ma.ensam.quizflow.activity.ActivityEnums.ActivityType;
import ma.ensam.quizflow.activity.ActivityEnums.ChoiceMode;
import ma.ensam.quizflow.common.ApiException;
import ma.ensam.quizflow.session.SessionRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Règles des activités (P2 §5, diagramme d'états BROUILLON / PRETE / ARCHIVEE).
 * R1 : une activité est verrouillée dès qu'une session non annulée la référence ; elle ne peut
 * alors plus être modifiée ni supprimée (on la duplique pour la faire évoluer).
 */
@Service
public class ActivityService {

    private final ActivityRepository activities;
    private final SessionRepository sessions;

    public ActivityService(ActivityRepository activities, SessionRepository sessions) {
        this.activities = activities;
        this.sessions = sessions;
    }

    public List<ActivityView> list(Long teacherId, ActivityStatus status) {
        List<Activity> list = status == null
                ? activities.findByTeacherIdOrderByUpdatedAtDesc(teacherId)
                : activities.findByTeacherIdAndStatusOrderByUpdatedAtDesc(teacherId, status);
        Set<String> locked = Set.copyOf(sessions.findLockedActivityIds(teacherId));
        return list.stream().map(a -> ActivityDtos.view(a, locked.contains(a.getId()))).toList();
    }

    public ActivityView get(Long teacherId, String id) {
        Activity a = findOwned(teacherId, id);
        return ActivityDtos.view(a, isLocked(id));
    }

    public ActivityView create(Long teacherId, ActivityRequest req) {
        Activity a = new Activity();
        a.setTeacherId(teacherId);
        a.setCreatedAt(Instant.now());
        apply(a, req);
        return ActivityDtos.view(activities.save(a), false);
    }

    public ActivityView update(Long teacherId, String id, ActivityRequest req) {
        Activity a = findOwned(teacherId, id);
        if (a.getStatus() == ActivityStatus.ARCHIVEE) {
            throw ApiException.conflict("ACTIVITY_ARCHIVED", "Restaurez l'activité avant de la modifier");
        }
        ensureNotLocked(id);
        apply(a, req);
        return ActivityDtos.view(activities.save(a), false);
    }

    public void delete(Long teacherId, String id) {
        Activity a = findOwned(teacherId, id);
        ensureNotLocked(id);
        activities.delete(a);
    }

    public ActivityView duplicate(Long teacherId, String id) {
        Activity source = findOwned(teacherId, id);
        Activity copy = new Activity();
        copy.setTeacherId(teacherId);
        copy.setType(source.getType());
        copy.setTitle(source.getTitle() == null ? null : source.getTitle() + " (copie)");
        copy.setDescription(source.getDescription());
        List<Activity.Question> questions = new ArrayList<>();
        for (Activity.Question q : source.getQuestions()) {
            List<Activity.Choice> choices = q.getChoices().stream()
                    .map(c -> new Activity.Choice(newId(), c.getPosition(), c.getLabel(), c.isCorrect()))
                    .toList();
            questions.add(new Activity.Question(newId(), q.getPosition(), q.getText(), q.getChoiceMode(),
                    new ArrayList<>(choices)));
        }
        copy.setQuestions(questions);
        copy.setStatus(computeStatus(copy));
        copy.setCreatedAt(Instant.now());
        copy.setUpdatedAt(Instant.now());
        return ActivityDtos.view(activities.save(copy), false);
    }

    public ActivityView archive(Long teacherId, String id) {
        Activity a = findOwned(teacherId, id);
        if (a.getStatus() != ActivityStatus.PRETE) {
            throw ApiException.invalidState("Seule une activité prête peut être archivée");
        }
        a.setStatus(ActivityStatus.ARCHIVEE);
        a.setUpdatedAt(Instant.now());
        return ActivityDtos.view(activities.save(a), isLocked(id));
    }

    public ActivityView restore(Long teacherId, String id) {
        Activity a = findOwned(teacherId, id);
        if (a.getStatus() != ActivityStatus.ARCHIVEE) {
            throw ApiException.invalidState("Cette activité n'est pas archivée");
        }
        a.setStatus(computeStatus(a));
        a.setUpdatedAt(Instant.now());
        return ActivityDtos.view(activities.save(a), isLocked(id));
    }

    /** Utilisé au lancement d'une session : seule une activité PRETE peut être lancée. */
    public Activity getReadyForLaunch(Long teacherId, String id) {
        Activity a = findOwned(teacherId, id);
        if (a.getStatus() != ActivityStatus.PRETE) {
            throw ApiException.conflict("ACTIVITY_NOT_READY", "Seule une activité prête peut être lancée");
        }
        return a;
    }

    public boolean isLocked(String activityId) {
        return sessions.existsActiveOrPlayedForActivity(activityId);
    }

    private void ensureNotLocked(String activityId) {
        if (isLocked(activityId)) {
            throw ApiException.conflict("ACTIVITY_LOCKED",
                    "Cette activité a déjà été utilisée dans une session : dupliquez-la pour la modifier");
        }
    }

    private Activity findOwned(Long teacherId, String id) {
        return activities.findById(id)
                .filter(a -> a.getTeacherId().equals(teacherId))
                .orElseThrow(() -> ApiException.notFound("ACTIVITY_NOT_FOUND", "Activité introuvable"));
    }

    private void apply(Activity a, ActivityRequest req) {
        a.setType(req.type());
        a.setTitle(trim(req.title()));
        a.setDescription(trim(req.description()));
        boolean poll = req.type() == ActivityType.SONDAGE;
        List<Activity.Question> questions = new ArrayList<>();
        List<QuestionRequest> qReqs = req.questions() == null ? List.of() : req.questions();
        for (int i = 0; i < qReqs.size(); i++) {
            QuestionRequest qr = qReqs.get(i);
            List<Activity.Choice> choices = new ArrayList<>();
            List<ChoiceRequest> cReqs = qr.choices() == null ? List.of() : qr.choices();
            for (int j = 0; j < cReqs.size(); j++) {
                ChoiceRequest cr = cReqs.get(j);
                choices.add(new Activity.Choice(idOrNew(cr.id()), j + 1, trim(cr.label()), !poll && cr.correct()));
            }
            ChoiceMode mode = qr.choiceMode() == null ? ChoiceMode.UNIQUE : qr.choiceMode();
            questions.add(new Activity.Question(idOrNew(qr.id()), i + 1, trim(qr.text()), mode, choices));
        }
        a.setQuestions(questions);
        a.setStatus(computeStatus(a));
        a.setUpdatedAt(Instant.now());
    }

    private static ActivityStatus computeStatus(Activity a) {
        return ActivityValidator.validate(a).isEmpty() ? ActivityStatus.PRETE : ActivityStatus.BROUILLON;
    }

    private static String idOrNew(String id) {
        return id == null || id.isBlank() ? newId() : id;
    }

    private static String newId() {
        return UUID.randomUUID().toString();
    }

    private static String trim(String s) {
        return s == null ? null : s.trim();
    }
}
