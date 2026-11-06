package ma.ensam.quizflow.mail;

public interface EmailService {
    void sendVerification(String recipient, String code, long validityMinutes);
}
