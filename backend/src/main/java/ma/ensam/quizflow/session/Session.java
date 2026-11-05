package ma.ensam.quizflow.session;

import jakarta.persistence.*;
import ma.ensam.quizflow.activity.ActivityEnums.ActivityType;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sessions")
public class Session {

    @Id
    private UUID id;

    @Column(nullable = false, length = 6)
    private String code;

    @Column(name = "teacher_id", nullable = false)
    private Long teacherId;

    @Column(name = "activity_id", nullable = false)
    private String activityId;

    @Column(name = "activity_title", nullable = false)
    private String activityTitle;

    @Enumerated(EnumType.STRING)
    @Column(name = "activity_type", nullable = false)
    private ActivityType activityType;

    @Column(name = "question_count", nullable = false)
    private int questionCount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SessionState state;

    @Column(name = "current_question_index")
    private Integer currentQuestionIndex;

    @Column(name = "current_question_id")
    private String currentQuestionId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(name = "last_action_at", nullable = false)
    private Instant lastActionAt;

    protected Session() {
    }

    public Session(String code, Long teacherId, String activityId, String activityTitle, ActivityType activityType,
                   int questionCount) {
        this.id = UUID.randomUUID();
        this.code = code;
        this.teacherId = teacherId;
        this.activityId = activityId;
        this.activityTitle = activityTitle;
        this.activityType = activityType;
        this.questionCount = questionCount;
        this.state = SessionState.EN_ATTENTE;
        this.createdAt = Instant.now();
        this.lastActionAt = this.createdAt;
    }

    /** Ouvre la question d'indice donné (0 = première). */
    public void openQuestion(int index, String questionId) {
        if (startedAt == null) {
            startedAt = Instant.now();
        }
        this.currentQuestionIndex = index;
        this.currentQuestionId = questionId;
        this.state = SessionState.QUESTION_OUVERTE;
        touch();
    }

    public void closeQuestion() {
        this.state = SessionState.QUESTION_FERMEE;
        touch();
    }

    public void end() {
        this.state = SessionState.TERMINEE;
        this.endedAt = Instant.now();
        touch();
    }

    public void cancel() {
        this.state = SessionState.ANNULEE;
        this.endedAt = Instant.now();
        touch();
    }

    public void touch() {
        this.lastActionAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getCode() { return code; }
    public Long getTeacherId() { return teacherId; }
    public String getActivityId() { return activityId; }
    public String getActivityTitle() { return activityTitle; }
    public ActivityType getActivityType() { return activityType; }
    public int getQuestionCount() { return questionCount; }
    public SessionState getState() { return state; }
    public Integer getCurrentQuestionIndex() { return currentQuestionIndex; }
    public String getCurrentQuestionId() { return currentQuestionId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getEndedAt() { return endedAt; }
    public Instant getLastActionAt() { return lastActionAt; }
}
