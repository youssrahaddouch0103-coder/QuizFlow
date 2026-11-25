package ma.ensam.quizflow.session;

import java.util.HashSet;
import java.util.UUID;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ma.ensam.quizflow.activity.Activity;
import ma.ensam.quizflow.activity.ActivityValidator;
import ma.ensam.quizflow.activity.ActivityEnums.ActivityType;
import ma.ensam.quizflow.activity.ActivityEnums.ChoiceMode;
import ma.ensam.quizflow.activity.ActivityEnums.QuestionKind;
import ma.ensam.quizflow.common.ApiException;
import ma.ensam.quizflow.realtime.EventPublisher;
import ma.ensam.quizflow.realtime.LiveEvent;
import ma.ensam.quizflow.realtime.LiveEvent.EventType;
import ma.ensam.quizflow.session.SessionDtos.*;
import ma.ensam.quizflow.session.SessionDtos.AnswerRequest;
import ma.ensam.quizflow.session.SessionDtos.ClosedInfo;
import ma.ensam.quizflow.session.SessionDtos.JoinResponse;
import ma.ensam.quizflow.session.SessionDtos.MyResult;
import ma.ensam.quizflow.session.SessionDtos.ParticipantJoined;
import ma.ensam.quizflow.session.SessionDtos.PlayerState;
import ma.ensam.quizflow.session.SessionDtos.PublicSessionInfo;
import ma.ensam.quizflow.session.SessionDtos.QuestionLive;

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
    private final LiveStatsBroadcaster statsBroadcaster;
    private final ContributionRepository contributions;
    private final QuestionStatRepository questionStats;

    /** Longueur maximale d'un mot du nuage. */
    static final int MAX_WORD = 40;
    /** Contributions maximales par étudiant et par question (questions du public, idées). */
    static final int MAX_CONTRIBUTIONS = 10;

    public PlayerService(SessionRepository sessions, ParticipantRepository participants, AnswerRepository answers,
                         ParticipantResultRepository results, LiveSessionRegistry registry, ScoringService scoring,
                         SessionService sessionService, EventPublisher events,
                         LiveStatsBroadcaster statsBroadcaster, ContributionRepository contributions,
                         QuestionStatRepository questionStats) {
        this.contributions = contributions;
        this.questionStats = questionStats;
        this.sessions = sessions;
        this.participants = participants;
        this.answers = answers;
        this.results = results;
        this.registry = registry;
        this.scoring = scoring;
        this.sessionService = sessionService;
        this.events = events;
        this.statsBroadcaster = statsBroadcaster;
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
        String myText = null;
        Integer myValue = null;
        List<ContributionView> publicList = null;
        List<String> myVotes = List.of();
        List<String> myContributions = List.of();

        SessionState state = session.getState();
        if (state == SessionState.QUESTION_OUVERTE || state == SessionState.QUESTION_FERMEE) {
            Activity.Question q = registry.get(session).questionAt(session.getCurrentQuestionIndex());
            question = QuestionLive.of(q, session.getCurrentQuestionIndex(), session.getQuestionCount(), session);
            Optional<Answer> mine = answers.findByParticipantIdAndQuestionId(me.getId(), q.getId());
            answered = mine.isPresent();
            myChoices = mine.map(a -> q.getKind() == QuestionKind.CLASSEMENT ? a.getRanking() : List.copyOf(a.getChoiceIds()))
                    .orElse(List.of());
            myText = mine.filter(a -> q.getKind() != QuestionKind.CLASSEMENT).map(Answer::getTextValue).orElse(null);
            myValue = mine.map(Answer::getNumberValue).orElse(null);
            if (q.getKind().isContribution()) {
                List<Contribution> all = contributions.findBySessionIdAndQuestionId(session.getId(), q.getId());
                publicList = QuestionAggregates.contributions(all, false);
                myVotes = all.stream().filter(c -> c.getVoters().contains(me.getId())).map(c -> c.getId().toString()).toList();
                myContributions = all.stream().filter(c -> c.getParticipantId().equals(me.getId()))
                        .map(c -> c.getId().toString()).toList();
            }
            if (state == SessionState.QUESTION_FERMEE) {
                closed = sessionService.closedInfo(session, q);
                myCorrect = mine.map(Answer::getCorrect).orElse(null);
            }
        } else if (state == SessionState.TERMINEE && session.getActivityType() == ActivityType.QUIZ) {
            // Score sur le nombre de questions notées (seules les questions à choix rapportent des points).
            int graded = (int) questionStats.findBySessionIdOrderByPositionAsc(session.getId()).stream()
                    .filter(s -> s.getSuccessRate() != null).count();
            result = results.findById(me.getId())
                    .map(r -> new MyResult(r.getScore(), r.getRank(), participants.countBySessionId(session.getId()), graded))
                    .orElse(null);
        }
        return new PlayerState(session.getCode(), session.getActivityTitle(), session.getActivityType(), state,
                me.getPseudo(), question, answered, myChoices, closed, myCorrect, result,
                myText, myValue, publicList, myVotes, myContributions);
    }

    /**
     * W5 : une réponse par participant et par question, seulement tant que la question est ouverte.
     * Le verrou partagé sur la session (FOR SHARE) empêche une réponse de passer après la fermeture.
     */
    @Transactional
    public void submit(String code, String token, AnswerRequest req) {
        Participant me = authenticate(token);
        Session session = lockOpenSession(me, code, req.questionId());
        Activity.Question question = currentQuestion(session, req.questionId());
        if (question.getKind().isContribution()) {
            throw ApiException.badRequest("INVALID_ANSWER", "Pour cette question, publiez une contribution");
        }
        Answer answer = switch (question.getKind()) {
            case CHOIX -> {
                Set<String> chosen = new HashSet<>(req.choiceIds() == null ? List.of() : req.choiceIds());
                Set<String> valid = question.getChoices().stream().map(Activity.Choice::getId).collect(Collectors.toSet());
                if (chosen.isEmpty() || !valid.containsAll(chosen)
                        || (question.getChoiceMode() == ChoiceMode.UNIQUE && chosen.size() != 1)) {
                    throw ApiException.badRequest("INVALID_CHOICE", "Choix invalide pour cette question");
                }
                // Seules les questions avec une bonne réponse sont notées.
                Boolean correct = session.getActivityType() == ActivityType.QUIZ && ActivityValidator.isGraded(question)
                        ? scoring.isCorrect(question, chosen) : null;
                yield new Answer(me.getId(), session.getId(), question.getId(), correct, chosen);
            }
            case CLASSEMENT -> {
                List<String> order = req.choiceIds() == null ? List.of() : req.choiceIds();
                Set<String> valid = question.getChoices().stream().map(Activity.Choice::getId).collect(Collectors.toSet());
                // Un classement complet : chaque élément exactement une fois.
                if (order.size() != valid.size() || !new HashSet<>(order).equals(valid)) {
                    throw ApiException.badRequest("INVALID_RANKING", "Classez tous les éléments");
                }
                yield Answer.ranking(me.getId(), session.getId(), question.getId(), order);
            }
            case NUAGE, TEXTE -> {
                String text = QuestionAggregates.clean(req.text());
                int max = question.getKind() == QuestionKind.NUAGE ? MAX_WORD : 500;
                if (text.isEmpty() || text.length() > max) {
                    throw ApiException.badRequest("INVALID_TEXT", "Votre réponse doit contenir entre 1 et " + max + " caractères");
                }
                yield Answer.text(me.getId(), session.getId(), question.getId(), text);
            }
            case NOTE -> {
                Integer v = req.value();
                if (v == null || v < 1 || v > QuestionAggregates.RATING_MAX) {
                    throw ApiException.badRequest("INVALID_VALUE", "Choisissez une note de 1 à " + QuestionAggregates.RATING_MAX);
                }
                yield Answer.number(me.getId(), session.getId(), question.getId(), v);
            }
            default -> throw ApiException.badRequest("INVALID_ANSWER", "Réponse invalide");
        };
        if (answers.existsByParticipantIdAndQuestionId(me.getId(), question.getId())) {
            throw ApiException.conflict("ALREADY_ANSWERED", "Vous avez déjà répondu à cette question");
        }
        try {
            answers.saveAndFlush(answer);
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict("ALREADY_ANSWERED", "Vous avez déjà répondu à cette question");
        }
        statsBroadcaster.requestAfterCommit(session.getId());
    }

    /** Questions du public et idées : publier une contribution (10 au maximum par étudiant et par question). */
    @Transactional
    public ContributionView contribute(String code, String token, ContributionRequest req) {
        Participant me = authenticate(token);
        Session session = lockOpenSession(me, code, req.questionId());
        Activity.Question question = currentQuestion(session, req.questionId());
        if (!question.getKind().isContribution()) {
            throw ApiException.badRequest("INVALID_ANSWER", "Cette question n'accepte pas de contributions");
        }
        String text = QuestionAggregates.clean(req.text());
        if (text.isEmpty() || text.length() > 300) {
            throw ApiException.badRequest("INVALID_TEXT", "Votre texte doit contenir entre 1 et 300 caractères");
        }
        if (contributions.countBySessionIdAndQuestionIdAndParticipantId(session.getId(), question.getId(), me.getId())
                >= MAX_CONTRIBUTIONS) {
            throw ApiException.conflict("TOO_MANY_CONTRIBUTIONS", "Vous avez atteint " + MAX_CONTRIBUTIONS + " contributions");
        }
        Contribution c = contributions.saveAndFlush(new Contribution(session.getId(), question.getId(), me.getId(), text));
        statsBroadcaster.requestAfterCommit(session.getId());
        return new ContributionView(c.getId().toString(), c.getText(), 0, false, false);
    }

    /** Vote (ou retrait du vote) pour la contribution d'un autre étudiant. */
    @Transactional
    public boolean vote(String code, String token, UUID contributionId) {
        Participant me = authenticate(token);
        Contribution c = contributions.findById(contributionId)
                .filter(x -> x.getSessionId().equals(me.getSessionId()) && !x.isHidden())
                .orElseThrow(() -> ApiException.notFound("CONTRIBUTION_NOT_FOUND", "Contribution introuvable"));
        lockOpenSession(me, code, c.getQuestionId());
        if (c.getParticipantId().equals(me.getId())) {
            throw ApiException.badRequest("OWN_CONTRIBUTION", "Vous ne pouvez pas voter pour votre propre contribution");
        }
        boolean voted = c.toggleVote(me.getId());
        contributions.saveAndFlush(c);
        statsBroadcaster.requestAfterCommit(me.getSessionId());
        return voted;
    }

    /**
     * Verrou partagé sur la session (FOR SHARE) : aucune réponse ne passe après la fermeture de la question.
     * Vérifie aussi que la question visée est bien celle en cours et que le minuteur n'est pas écoulé.
     */
    private Session lockOpenSession(Participant me, String code, String questionId) {
        Session session = sessions.findByIdForShare(me.getSessionId())
                .filter(s -> s.getCode().equals(code))
                .orElseThrow(() -> ApiException.unauthorized("INVALID_TOKEN", "Jeton invalide pour cette session"));
        if (session.getState() != SessionState.QUESTION_OUVERTE || !questionId.equals(session.getCurrentQuestionId())) {
            throw ApiException.conflict("QUESTION_CLOSED", "Cette question n'accepte plus de réponses");
        }
        // Minuteur écoulé (1 s de tolérance pour le réseau) : la fermeture automatique est imminente.
        if (session.getQuestionDeadline() != null
                && java.time.Instant.now().isAfter(session.getQuestionDeadline().plusSeconds(1))) {
            throw ApiException.conflict("QUESTION_CLOSED", "Temps écoulé : cette question n'accepte plus de réponses");
        }
        return session;
    }

    private Activity.Question currentQuestion(Session session, String questionId) {
        return registry.get(session).question(questionId)
                .orElseThrow(() -> ApiException.badRequest("INVALID_QUESTION", "Question inconnue"));
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
