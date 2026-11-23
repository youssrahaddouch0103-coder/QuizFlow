package ma.ensam.quizflow.session;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ma.ensam.quizflow.activity.Activity;
import ma.ensam.quizflow.activity.ActivityEnums.ActivityType;
import ma.ensam.quizflow.activity.ActivityEnums.QuestionKind;
import ma.ensam.quizflow.activity.ActivityRepository;
import ma.ensam.quizflow.activity.ActivityService;
import ma.ensam.quizflow.common.ApiException;
import ma.ensam.quizflow.realtime.EventPublisher;
import ma.ensam.quizflow.realtime.LiveEvent;
import ma.ensam.quizflow.realtime.LiveEvent.EventType;
import ma.ensam.quizflow.session.LiveSessionRegistry.ActivitySnapshot;
import ma.ensam.quizflow.session.SessionDtos.*;
import ma.ensam.quizflow.session.SessionDtos.ChoiceResult;
import ma.ensam.quizflow.session.SessionDtos.ClosedInfo;
import ma.ensam.quizflow.session.SessionDtos.LeaderboardEntry;
import ma.ensam.quizflow.session.SessionDtos.LiveStats;
import ma.ensam.quizflow.session.SessionDtos.QuestionLive;
import ma.ensam.quizflow.session.SessionDtos.QuestionResult;
import ma.ensam.quizflow.session.SessionDtos.ResultsView;
import ma.ensam.quizflow.session.SessionDtos.SessionSummary;
import ma.ensam.quizflow.session.SessionDtos.TeacherSessionView;

/**
 * Cycle de vie d'une session (P1 W3, P2 §5) piloté par l'enseignant.
 * Chaque transition verrouille la ligne de la session (FOR UPDATE) et refuse toute action
 * incompatible avec l'état courant (409 INVALID_STATE).
 */
@Service
public class SessionService {

    private static final int CODE_ATTEMPTS = 20;

    private final SessionRepository sessions;
    private final ParticipantRepository participants;
    private final AnswerRepository answers;
    private final ParticipantResultRepository results;
    private final QuestionStatRepository questionStats;
    private final ActivityService activityService;
    private final ActivityRepository activityRepository;
    private final LiveSessionRegistry registry;
    private final ScoringService scoring;
    private final EventPublisher events;
    private final ContributionRepository contributions;

    public SessionService(SessionRepository sessions, ParticipantRepository participants, AnswerRepository answers,
                          ParticipantResultRepository results, QuestionStatRepository questionStats,
                          ActivityService activityService, ActivityRepository activityRepository,
                          LiveSessionRegistry registry, ScoringService scoring, EventPublisher events,
                          ContributionRepository contributions) {
        this.contributions = contributions;
        this.sessions = sessions;
        this.participants = participants;
        this.answers = answers;
        this.results = results;
        this.questionStats = questionStats;
        this.activityService = activityService;
        this.activityRepository = activityRepository;
        this.registry = registry;
        this.scoring = scoring;
        this.events = events;
    }

    // ------------------------------------------------------------------ lecture

    @Transactional(readOnly = true)
    public List<SessionSummary> list(Long teacherId, String scope) {
        return sessions.findByTeacherIdOrderByCreatedAtDesc(teacherId).stream()
                .filter(s -> scope == null
                        || ("active".equals(scope) && s.getState().isActive())
                        || ("finished".equals(scope) && !s.getState().isActive()))
                .map(this::summary)
                .toList();
    }

    @Transactional(readOnly = true)
    public TeacherSessionView get(Long teacherId, UUID sessionId) {
        return teacherView(findOwned(teacherId, sessionId));
    }

    // ------------------------------------------------------------------ transitions

    @Transactional
    public TeacherSessionView launch(Long teacherId, String activityId) {
        Activity activity = activityService.getReadyForLaunch(teacherId, activityId);
        String code = uniqueCode();
        Session session = sessions.save(new Session(code, teacherId, activity.getId(), activity.getTitle(),
                activity.getType(), activity.getQuestions().size()));
        registry.register(session.getId(), activity);
        return teacherView(session);
    }

    @Transactional
    public TeacherSessionView start(Long teacherId, UUID sessionId, Integer durationSeconds) {
        Session session = lockOwned(teacherId, sessionId);
        if (session.getState() != SessionState.EN_ATTENTE) {
            throw ApiException.invalidState("La session a déjà démarré");
        }
        return openQuestion(session, 0, durationSeconds);
    }

    @Transactional
    public TeacherSessionView next(Long teacherId, UUID sessionId, Integer durationSeconds) {
        Session session = lockOwned(teacherId, sessionId);
        if (session.getState() != SessionState.QUESTION_FERMEE) {
            throw ApiException.invalidState("Fermez la question en cours avant de passer à la suivante");
        }
        int nextIndex = session.getCurrentQuestionIndex() + 1;
        if (nextIndex >= session.getQuestionCount()) {
            throw ApiException.conflict("NO_MORE_QUESTIONS", "C'était la dernière question : terminez la session");
        }
        return openQuestion(session, nextIndex, durationSeconds);
    }

    @Transactional
    public TeacherSessionView closeQuestion(Long teacherId, UUID sessionId) {
        Session session = lockOwned(teacherId, sessionId);
        if (session.getState() != SessionState.QUESTION_OUVERTE) {
            throw ApiException.invalidState("Aucune question ouverte");
        }
        return doCloseQuestion(session);
    }

    /**
     * Minuteur écoulé : fermeture automatique (appelée par QuestionTimerJob). Ne fait rien si
     * l'enseignant a déjà fermé la question ou si l'échéance n'est pas atteinte.
     */
    @Transactional
    public boolean closeExpiredQuestion(UUID sessionId, Instant now) {
        Session session = sessions.findByIdForUpdate(sessionId).orElse(null);
        if (session == null || session.getState() != SessionState.QUESTION_OUVERTE
                || session.getQuestionDeadline() == null || session.getQuestionDeadline().isAfter(now)) {
            return false;
        }
        doCloseQuestion(session);
        return true;
    }

    private TeacherSessionView doCloseQuestion(Session session) {
        session.closeQuestion();
        ActivitySnapshot snapshot = registry.get(session);
        Activity.Question question = snapshot.questionAt(session.getCurrentQuestionIndex());
        events.publish(session.getCode(), LiveEvent.of(EventType.QUESTION_CLOSED, closedInfo(session, question)));
        return teacherView(session);
    }

    @Transactional
    public ResultsView end(Long teacherId, UUID sessionId) {
        findOwned(teacherId, sessionId);
        return endInternal(sessionId);
    }

    /**
     * Clôture (W6) en une seule transaction : état TERMINEE, scores et classement (quiz),
     * statistiques par question. Appelée aussi par la fin automatique (R7).
     */
    @Transactional
    public ResultsView endInternal(UUID sessionId) {
        Session session = sessions.findByIdForUpdate(sessionId)
                .orElseThrow(() -> ApiException.notFound("SESSION_NOT_FOUND", "Session introuvable"));
        if (session.getState() != SessionState.QUESTION_OUVERTE && session.getState() != SessionState.QUESTION_FERMEE) {
            throw ApiException.invalidState("Seule une session en cours peut être terminée");
        }
        ActivitySnapshot snapshot = registry.get(session);
        List<Participant> players = participants.findBySessionIdOrderByJoinedAtAsc(sessionId);
        List<Answer> all = answers.findBySessionId(sessionId);
        boolean quiz = session.getActivityType() == ActivityType.QUIZ;

        session.end();
        if (quiz) {
            List<ParticipantResult> rows = scoring.computeScores(players.stream().map(Participant::getId).toList(), all)
                    .stream()
                    .map(s -> new ParticipantResult(s.participantId(), s.score(), s.rank()))
                    .toList();
            results.saveAll(rows);
        }
        List<QuestionStat> stats = scoring.computeStats(snapshot.questions(), all,
                        contributions.findBySessionId(sessionId), quiz).stream()
                .map(s -> new QuestionStat(sessionId, s.questionId(), s.position(), s.answerCount(), s.successRate(),
                        s.distribution(), s.details()))
                .toList();
        questionStats.saveAll(stats);
        registry.release(sessionId);

        ResultsView view = buildResults(session);
        events.publish(session.getCode(), LiveEvent.of(EventType.SESSION_ENDED, Map.of("code", session.getCode())));
        events.publishToTeacher(session.getCode(), LiveEvent.of(EventType.SESSION_RESULTS, view));
        return view;
    }

    @Transactional
    public TeacherSessionView cancel(Long teacherId, UUID sessionId) {
        findOwned(teacherId, sessionId);
        return cancelInternal(sessionId);
    }

    @Transactional
    public TeacherSessionView cancelInternal(UUID sessionId) {
        Session session = sessions.findByIdForUpdate(sessionId)
                .orElseThrow(() -> ApiException.notFound("SESSION_NOT_FOUND", "Session introuvable"));
        if (session.getState() != SessionState.EN_ATTENTE) {
            throw ApiException.invalidState("Seule une session en attente peut être annulée");
        }
        session.cancel();
        registry.release(sessionId);
        events.publish(session.getCode(), LiveEvent.of(EventType.SESSION_CANCELLED, Map.of("code", session.getCode())));
        return teacherView(session);
    }

    @Transactional(readOnly = true)
    public ResultsView results(Long teacherId, UUID sessionId) {
        Session session = findOwned(teacherId, sessionId);
        if (session.getState() != SessionState.TERMINEE) {
            throw ApiException.conflict("RESULTS_NOT_READY", "Les résultats sont disponibles une fois la session terminée");
        }
        return buildResults(session);
    }

    // ------------------------------------------------------------------ calculs partagés

    /** Répartition en direct des choix d'une question (tous les choix présents, même à 0). */
    public Map<String, Long> liveDistribution(UUID sessionId, Activity.Question question) {
        Map<String, Long> distribution = new LinkedHashMap<>();
        question.getChoices().forEach(c -> distribution.put(c.getId(), 0L));
        for (Object[] row : answers.countChoices(sessionId, question.getId())) {
            distribution.put((String) row[0], ((Number) row[1]).longValue());
        }
        return distribution;
    }
    /** Relit les statistiques de la question en cours (données validées) et les envoie à l'enseignant. */
    @Transactional(readOnly = true)
    public void publishLiveStats(UUID sessionId) {
        sessions.findById(sessionId)
                .filter(s -> s.getState() == SessionState.QUESTION_OUVERTE || s.getState() == SessionState.QUESTION_FERMEE)
                .ifPresent(session -> {
                    Activity.Question question = registry.get(session).questionAt(session.getCurrentQuestionIndex());
                    LiveStats stats = liveStats(session, question);
                    events.publishToTeacher(session.getCode(), LiveEvent.of(EventType.ANSWER_STATS, stats));
                    if (question.getKind().isContribution()) {
                        // Les téléphones reçoivent la liste (sans les contributions masquées) pour pouvoir voter.
                        events.publish(session.getCode(), LiveEvent.of(EventType.CONTRIBUTIONS,
                                new ContributionsUpdate(question.getId(), publicContributions(session.getId(), question))));
                    }
                });
    }

    /** Statistiques de la question en cours, selon son type. */
    public LiveStats liveStats(Session session, Activity.Question question) {
        UUID sessionId = session.getId();
        long participantCount = participants.countBySessionId(sessionId);
        QuestionKind kind = question.getKind();
        if (kind == QuestionKind.CHOIX) {
            return new LiveStats(question.getId(), kind,
                    answers.countBySessionIdAndQuestionId(sessionId, question.getId()), participantCount,
                    liveDistribution(sessionId, question), null, null, null, null, null);
        }
        if (kind.isContribution()) {
            List<ContributionView> list = QuestionAggregates.contributions(
                    contributions.findBySessionIdAndQuestionId(sessionId, question.getId()), true);
            long visible = list.stream().filter(c -> !c.hidden()).count();
            return new LiveStats(question.getId(), kind, visible, participantCount, Map.of(),
                    null, null, null, null, list);
        }
        List<Answer> list = answers.findBySessionIdAndQuestionId(sessionId, question.getId());
        return new LiveStats(question.getId(), kind, list.size(), participantCount, Map.of(),
                kind == QuestionKind.NUAGE ? QuestionAggregates.words(list) : null,
                kind == QuestionKind.TEXTE ? QuestionAggregates.texts(list) : null,
                kind == QuestionKind.NOTE ? QuestionAggregates.rating(list) : null,
                kind == QuestionKind.CLASSEMENT ? QuestionAggregates.ranking(question, list) : null,
                null);
    }

    /** Contributions visibles par les étudiants (sans celles masquées par l'enseignant). */
    public List<ContributionView> publicContributions(UUID sessionId, Activity.Question question) {
        return QuestionAggregates.contributions(contributions.findBySessionIdAndQuestionId(sessionId, question.getId()), false);
    }

    /**
     * Modération d'une question du public ou d'une idée : marquer comme traitée, ou masquer.
     * Possible pendant la question en cours (ouverte ou fermée).
     */
    @Transactional
    public LiveStats moderate(Long teacherId, UUID sessionId, UUID contributionId, Boolean done, Boolean hidden) {
        Session session = findOwned(teacherId, sessionId);
        if (session.getState() != SessionState.QUESTION_OUVERTE && session.getState() != SessionState.QUESTION_FERMEE) {
            throw ApiException.invalidState("Aucune question en cours");
        }
        Contribution c = contributions.findById(contributionId)
                .filter(x -> x.getSessionId().equals(sessionId) && x.getQuestionId().equals(session.getCurrentQuestionId()))
                .orElseThrow(() -> ApiException.notFound("CONTRIBUTION_NOT_FOUND", "Contribution introuvable"));
        if (done != null) {
            c.setDone(done);
        }
        if (hidden != null) {
            c.setHidden(hidden);
        }
        contributions.saveAndFlush(c);
        Activity.Question question = registry.get(session).questionAt(session.getCurrentQuestionIndex());
        events.publish(session.getCode(), LiveEvent.of(EventType.CONTRIBUTIONS,
                new ContributionsUpdate(question.getId(), publicContributions(sessionId, question))));
        return liveStats(session, question);
    }

    public ClosedInfo closedInfo(Session session, Activity.Question question) {
        List<String> correct = session.getActivityType() == ActivityType.QUIZ
                ? question.getChoices().stream().filter(Activity.Choice::isCorrect).map(Activity.Choice::getId).toList()
                : List.of();
        return new ClosedInfo(question.getId(), correct, liveDistribution(session.getId(), question),
                answers.countBySessionIdAndQuestionId(session.getId(), question.getId()));
    }

    // ------------------------------------------------------------------ privé

    private TeacherSessionView openQuestion(Session session, int index, Integer durationSeconds) {
        ActivitySnapshot snapshot = registry.get(session);
        Activity.Question question = snapshot.questionAt(index);
        session.openQuestion(index, question.getId(), durationSeconds);
        events.publish(session.getCode(), LiveEvent.of(EventType.QUESTION_OPENED,
                QuestionLive.of(question, index, session.getQuestionCount(), session)));
        return teacherView(session);
    }

    private TeacherSessionView teacherView(Session session) {
        List<Participant> players = participants.findBySessionIdOrderByJoinedAtAsc(session.getId());
        QuestionLive current = null;
        LiveStats stats = null;
        ClosedInfo closed = null;
        boolean inQuestion = session.getState() == SessionState.QUESTION_OUVERTE
                || session.getState() == SessionState.QUESTION_FERMEE;
        if (inQuestion) {
            Activity.Question question = registry.get(session).questionAt(session.getCurrentQuestionIndex());
            current = QuestionLive.of(question, session.getCurrentQuestionIndex(), session.getQuestionCount(), session);
            stats = liveStats(session, question);
            if (session.getState() == SessionState.QUESTION_FERMEE) {
                closed = closedInfo(session, question);
            }
        }
        return new TeacherSessionView(session.getId(), session.getCode(), session.getState(), session.getActivityId(),
                session.getActivityTitle(), session.getActivityType(), session.getQuestionCount(),
                session.getCurrentQuestionIndex(), current, closed, stats, players.size(),
                players.stream().map(Participant::getPseudo).toList(),
                session.getCreatedAt(), session.getStartedAt(), session.getEndedAt());
    }

    private SessionSummary summary(Session s) {
        return new SessionSummary(s.getId(), s.getCode(), s.getState(), s.getActivityId(), s.getActivityTitle(),
                s.getActivityType(), s.getQuestionCount(), participants.countBySessionId(s.getId()),
                s.getCreatedAt(), s.getEndedAt());
    }

    private ResultsView buildResults(Session session) {
        List<Participant> players = participants.findBySessionIdOrderByJoinedAtAsc(session.getId());
        Map<UUID, String> pseudos = players.stream()
                .collect(Collectors.toMap(Participant::getId, Participant::getPseudo));
        List<LeaderboardEntry> leaderboard = results.findByParticipantIdIn(pseudos.keySet()).stream()
                .sorted(Comparator.comparingInt(ParticipantResult::getRank)
                        .thenComparing(r -> pseudos.get(r.getParticipantId()), String.CASE_INSENSITIVE_ORDER))
                .map(r -> new LeaderboardEntry(pseudos.get(r.getParticipantId()), r.getScore(), r.getRank()))
                .toList();

        Map<String, Activity.Question> questionsById = activityRepository.findById(session.getActivityId())
                .map(a -> a.getQuestions().stream()
                        .collect(Collectors.toMap(Activity.Question::getId, Function.identity())))
                .orElse(Map.of());

        List<QuestionResult> questionResults = new ArrayList<>();
        for (QuestionStat stat : questionStats.findBySessionIdOrderByPositionAsc(session.getId())) {
            Activity.Question q = questionsById.get(stat.getQuestionId());
            List<ChoiceResult> choices = new ArrayList<>();
            int total = stat.getAnswerCount();
            if (q != null && q.getKind() == QuestionKind.CHOIX) {
                for (Activity.Choice c : q.getChoices()) {
                    long count = stat.count(c.getId());
                    choices.add(new ChoiceResult(c.getId(), c.getLabel(), c.isCorrect(), count,
                            total == 0 ? 0.0 : 100.0 * count / total));
                }
            }
            QuestionDetails d = stat.getDetails() == null
                    ? new QuestionDetails(null, null, null, null, null) : stat.getDetails();
            questionResults.add(new QuestionResult(stat.getQuestionId(), stat.getPosition(),
                    q == null ? "(question supprimée)" : q.getText(),
                    q == null ? QuestionKind.CHOIX : q.getKind(),
                    q == null ? null : q.getChoiceMode(),
                    total, stat.getSuccessRate(), choices,
                    d.words(), d.texts(), d.rating(), d.ranking(), d.contributions()));
        }
        return new ResultsView(summary(session), leaderboard, questionResults);
    }

    private String uniqueCode() {
        for (int i = 0; i < CODE_ATTEMPTS; i++) {
            String code = Tokens.newSessionCode();
            if (!sessions.existsByCodeAndStateIn(code, SessionState.ACTIVE)) {
                return code;
            }
        }
        throw new IllegalStateException("Impossible de générer un code de session unique");
    }

    private Session findOwned(Long teacherId, UUID sessionId) {
        return sessions.findById(sessionId)
                .filter(s -> s.getTeacherId().equals(teacherId))
                .orElseThrow(() -> ApiException.notFound("SESSION_NOT_FOUND", "Session introuvable"));
    }

    private Session lockOwned(Long teacherId, UUID sessionId) {
        return sessions.findByIdForUpdate(sessionId)
                .filter(s -> s.getTeacherId().equals(teacherId))
                .orElseThrow(() -> ApiException.notFound("SESSION_NOT_FOUND", "Session introuvable"));
    }
}
