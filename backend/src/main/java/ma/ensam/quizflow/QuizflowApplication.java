package ma.ensam.quizflow;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

import ma.ensam.quizflow.config.AppProperties;

// L'authentification passe par notre JWT : on désactive l'utilisateur par défaut de Spring Security.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableScheduling
@EnableConfigurationProperties(AppProperties.class)
public class QuizflowApplication {

    public static void main(String[] args) {
        SpringApplication.run(QuizflowApplication.class, args);
    }
}