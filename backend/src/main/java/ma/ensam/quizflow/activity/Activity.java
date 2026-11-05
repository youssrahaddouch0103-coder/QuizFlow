package ma.ensam.quizflow.activity;

import ma.ensam.quizflow.activity.ActivityEnums.ActivityStatus;
import ma.ensam.quizflow.activity.ActivityEnums.ActivityType;
import ma.ensam.quizflow.activity.ActivityEnums.ChoiceMode;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Document MongoDB "activities" : une activité avec ses questions et ses choix imbriqués.
 */
@Document("activities")
@CompoundIndex(name = "teacher_status_updated", def = "{'teacherId': 1, 'status': 1, 'updatedAt': -1}")
public class Activity {

    @Id
    private String id;
    private Long teacherId;
    private ActivityType type;
    private String title;
    private String description;
    private ActivityStatus status = ActivityStatus.BROUILLON;
    private List<Question> questions = new ArrayList<>();
    private Instant createdAt;
    private Instant updatedAt;

    public static class Question {
        private String id;
        private int position;
        private String text;
        private ChoiceMode choiceMode = ChoiceMode.UNIQUE;
        private List<Choice> choices = new ArrayList<>();

        public Question() {
        }

        public Question(String id, int position, String text, ChoiceMode choiceMode, List<Choice> choices) {
            this.id = id;
            this.position = position;
            this.text = text;
            this.choiceMode = choiceMode;
            this.choices = choices;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public int getPosition() { return position; }
        public void setPosition(int position) { this.position = position; }
        public String getText() { return text; }
        public void setText(String text) { this.text = text; }
        public ChoiceMode getChoiceMode() { return choiceMode; }
        public void setChoiceMode(ChoiceMode choiceMode) { this.choiceMode = choiceMode; }
        public List<Choice> getChoices() { return choices; }
        public void setChoices(List<Choice> choices) { this.choices = choices; }
    }

    public static class Choice {
        private String id;
        private int position;
        private String label;
        private boolean correct;

        public Choice() {
        }

        public Choice(String id, int position, String label, boolean correct) {
            this.id = id;
            this.position = position;
            this.label = label;
            this.correct = correct;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public int getPosition() { return position; }
        public void setPosition(int position) { this.position = position; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public boolean isCorrect() { return correct; }
        public void setCorrect(boolean correct) { this.correct = correct; }
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Long getTeacherId() { return teacherId; }
    public void setTeacherId(Long teacherId) { this.teacherId = teacherId; }
    public ActivityType getType() { return type; }
    public void setType(ActivityType type) { this.type = type; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public ActivityStatus getStatus() { return status; }
    public void setStatus(ActivityStatus status) { this.status = status; }
    public List<Question> getQuestions() { return questions; }
    public void setQuestions(List<Question> questions) { this.questions = questions; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
