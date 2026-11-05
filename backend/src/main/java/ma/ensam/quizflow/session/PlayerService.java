package ma.ensam.quizflow.session;

import ma.ensam.quizflow.activity.Activity;
import ma.ensam.quizflow.activity.ActivityEnums.ActivityType;
import ma.ensam.quizflow.activity.ActivityEnums.ChoiceMode;
import ma.ensam.quizflow.common.ApiException;
import ma.ensam.quizflow.realtime.EventPublisher;
import ma.ensam.quizflow.realtime.LiveEvent;
import ma.ensam.quizflow.realtime.LiveEvent.EventType;
import ma.ensam.quizflow.session.SessionDtos.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Côté étudiant (anonyme) : rejoindre une session (W4) et répondre (W5).
 * L'étudiant est identifié par un jeton aléatoire gardé dans son navigateur (en-tête X-Participant-Token).
 */
@Service
public class PlayerService {

    private final SessionRepository sessions;
    private final ParticipantRepository participants;
    private final AnswerRepository answers;
    private final ParticipantResultRepository results;
    private final LiveSessionRegistry registry;
    private final ScoringService scoring;
    private final SessionService sessionService;
    private final EventPublisher events;

    public PlayerService(SessionRepository sessions, ParticipantRepository participants, AnswerRepository answers,
                         ParticipantResultRepository results, LiveSessionRegistry registry, ScoringService scoring,
                         SessionService sessionService, EventPublisher events) {
        this.sessions = sessions;
        this.participants = participants;
        this.answers = answers;
        this.results = results;
        this.registry = registry;
        this.scoring = scoring;
        this.sessionService = sessionService;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public PublicSessionInfo info(String code) {
        Session s = findActive(code);
        return new PublicSessionInfo(s.getCode(), s.getActivityTitle(), s.getActivityType(), s.getState());
    }

    @Transactional
    public JoinResponse join(String code, String rawPseudo) {
        Session session = findActive(code);
        String pseudo = rawPseudo == null ? "" : rawPseudo.trim().replaceAll("\\s+", " ");
        if (pseudo.isEmpty() || pseudo.length() > 30) {
            throw ApiException.badRequest("INVALID_PSEUDO", "Le pseudo doit contenir entre 1 et 30 caractères");
        }
        if (participants.existsPseudo(session.getId(), pseudo)) {
            throw ApiException.conflict("PSEUDO_TAKEN", "Ce pseudo est déjà pris dans cette session");
        }
        String token = Tokens.newParticipantToken();
        Participant participant;
        try {
            participant = participants.saveAndFlush(new Participant(session.getId(), pseudo, Tokens.sha256(token)));
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict("PSEUDO_TAKEN", "Ce pseudo est déjà pris dans cette session");
        }
        events.publishToTeacher(session.getCode(), LiveEvent.of(EventType.PARTICIPANT_JOINED,
                new ParticipantJoined(pseudo, participants.countBySessionId(session.getId()))));
        return new JoinResponse(participant.getId(), pseudo, token);
    }

    /** État complet pour (re)synchroniser l'écran étudiant, y compris après une reconnexion. */
    @Transactional(readOnly = true)
    public PlayerState state(String code, String token) {
        Participant me = authenticate(token);
        Session session = sessions.findById(me.getSessionId())
                .filter(s -> s.getCode().equals(code))
                .orElseThrow(() -> ApiException.unauthorized("INVALID_TOKEN", "Jeton invalide pour cette session"));

        QuestionLive question = null;
        boolean answered = false;
        List<String> myChoices = List.of();
        ClosedInfo closed = null;
        Boolean myCorrect = null;
        MyResult result = null;

        SessionState state = session.getState();
        if (state == SessionState.QUESTION_OUVERTE || state == SessionState.QUESTION_FERMEE) {
            Activity.Question q = registry.get(session).questionAt(session.getCurrentQuestionIndex());
            question = QuestionLive.of(q, session.getCurrentQuestionIndex(), session.getQuestionCount());
            Optional<Answer> mine = answers.findByParticipantIdAndQuestionId(me.getId(), q.getId());
            answered = mine.isPresent();
            myChoices = mine.map(a -> List.copyOf(a.getChoiceIds())).orElse(List.of());
            if (state == SessionState.QUESTION_FERMEE) {
                closed = sessionService.closedInfo(session, q);
                myCorrect = mine.map(Answer::getCorrect).orElse(null);
            }
        } else if (state == SessionState.TERMINEE && session.getActivityType() == ActivityType.QUIZ) {
            result = results.findById(me.getId())
                    .map(r -> new MyResult(r.getScore(), r.getRank(), participants.countBySessionId(session.getId()),
                            session.getQuestionCount()))
                    .orElse(null);
        }
        return new PlayerState(session.getCode(), session.getActivityTitle(), session.getActivityType(), state,
                me.getPseudo(), question, answered, myChoices, closed, myCorrect, result);
    }

    /**
     * W5 : une réponse par participant et par question, seulement tant que la question est ouverte.
     * Le verrou partagé sur la session (FOR SHARE) empêche une réponse de passer après la fermeture.
     */
    @Transactional
    public void submit(String code, String token, AnswerRequest req) {
        Participant me = authenticate(token);
        Session session = sessions.findByIdForShare(me.getSessionId())
                .filter(s -> s.getCode().equals(code))
                .orElseThrow(() -> ApiException.unauthorized("INVALID_TOKEN", "Jeton invalide pour cette session"));
        if (session.getState() != SessionState.QUESTION_OUVERTE
                || !req.questionId().equals(session.getCurrentQuestionId())) {
            throw ApiException.conflict("QUESTION_CLOSED", "Cette question n'accepte plus de réponses");
        }
        Activity.Question question = registry.get(session).question(req.questionId())
                .orElseThrow(() -> ApiException.badRequest("INVALID_QUESTION", "Question inconnue"));

        Set<String> chosen = new HashSet<>(req.choiceIds());
        Set<String> valid = question.getChoices().stream().map(Activity.Choice::getId).collect(Collectors.toSet());
        if (chosen.isEmpty() || !valid.containsAll(chosen)
                || (question.getChoiceMode() == ChoiceMode.UNIQUE && chosen.size() != 1)) {
            throw ApiException.badRequest("INVALID_CHOICE", "Choix invalide pour cette question");
        }
        if (answers.existsByParticipantIdAndQuestionId(me.getId(), question.getId())) {
            throw ApiException.conflict("ALREADY_ANSWERED", "Vous avez déjà répondu à cette question");
        }
        Boolean correct = session.getActivityType() == ActivityType.QUIZ ? scoring.isCorrect(question, chosen) : null;
        try {
            answers.saveAndFlush(new Answer(me.getId(), session.getId(), question.getId(), correct, chosen));
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict("ALREADY_ANSWERED", "Vous avez déjà répondu à cette question");
        }
        events.publishToTeacher(session.getCode(),
                LiveEvent.of(EventType.ANSWER_STATS, sessionService.liveStats(session, question)));
    }

    private Participant authenticate(String token) {
        if (token == null || token.isBlank()) {
            throw ApiException.unauthorized("INVALID_TOKEN", "Jeton du participant manquant");
        }
        return participants.findByTokenHash(Tokens.sha256(token))
                .orElseThrow(() -> ApiException.unauthorized("INVALID_TOKEN", "Jeton du participant invalide"));
    }

    private Session findActive(String code) {
        String normalized = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        return sessions.findByCodeAndStateIn(normalized, SessionState.ACTIVE)
                .orElseThrow(() -> ApiException.notFound("SESSION_NOT_FOUND",
                        "Aucune session en cours avec ce code"));
    }
}
