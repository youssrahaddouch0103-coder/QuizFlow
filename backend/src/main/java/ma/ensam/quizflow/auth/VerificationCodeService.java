package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.config.EmailVerificationProperties;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

@Service
public class VerificationCodeService {
    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public VerificationCodeService(EmailVerificationProperties properties) {
        this(properties, "smtp");
    }

    /**
     * En mode développement (app.mail.mode=log) sans clé configurée, une clé aléatoire est créée au démarrage :
     * les codes en attente deviennent invalides après un redémarrage, ce qui est acceptable en développement.
     */
    @Autowired
    public VerificationCodeService(EmailVerificationProperties properties,
                                   @Value("${app.mail.mode:smtp}") String mailMode) {
        if ("log".equals(mailMode) && (properties.hmacKey() == null || properties.hmacKey().isBlank())) {
            byte[] generated = new byte[32];
            new SecureRandom().nextBytes(generated);
            key = new SecretKeySpec(generated, "HmacSHA256");
            LoggerFactory.getLogger(VerificationCodeService.class)
                    .warn("MODE DEV : clé HMAC temporaire générée (définir APP_EMAILVERIFICATION_HMACKEY en production)");
            return;
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(properties.hmacKey() == null ? "" : properties.hmacKey());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Configurer une clé HMAC de vérification en Base64");
        }
        if (bytes.length < 32) throw new IllegalStateException("La clé HMAC doit contenir au moins 32 octets aléatoires");
        key = new SecretKeySpec(bytes, "HmacSHA256");
    }

    public String generate() { return String.format(Locale.ROOT, "%06d", random.nextInt(1_000_000)); }

    public byte[] fingerprint(UUID id, int version, String code) {
        return mac("verification:" + id + ":" + version + ":" + code);
    }

    public boolean matches(PendingRegistration pending, String code) {
        return MessageDigest.isEqual(pending.codeMac(), fingerprint(pending.id(), pending.codeVersion(), code));
    }

    public String bucket(String purpose, String value) {
        return HexFormat.of().formatHex(mac("rate-limit:" + purpose + ":" + value));
    }

    private byte[] mac(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(key);
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC indisponible");
        }
    }
}
