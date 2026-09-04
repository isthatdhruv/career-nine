package com.kccitm.api.service.link;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.ShortLink;
import com.kccitm.api.repository.Career9.ShortLinkRepository;

/**
 * Mints and resolves the short codes behind {@code /s/{code}}.
 *
 * <h3>It never throws</h3>
 * {@link #codeFor} returns {@code null} on any failure — a duplicate code, a database that is
 * momentarily unavailable, anything. Callers fall back to the full URL, so the worst outcome of
 * a fault here is the long link we were sending last week. Shortening a link is a convenience;
 * it must never be the reason a student does not receive their booking mail.
 *
 * <h3>Why REQUIRES_NEW</h3>
 * Callers are already inside transactions, and at least one of them
 * ({@code CounsellingBookingLinkService.bookingUrlIfEligible}) is {@code readOnly = true} —
 * writing there would fail outright. A separate transaction also means the code survives if the
 * caller later rolls back, which is the behaviour we want: a code handed to a student must keep
 * working, and an unused row costs nothing.
 */
@Service
public class ShortLinkService {

    private static final Logger logger = LoggerFactory.getLogger(ShortLinkService.class);

    /**
     * 7 characters from a 56-character alphabet — about 1.7 × 10^12 codes. Read out over the
     * phone to support more often than you would think, so 0/O and 1/l/I are left out.
     */
    private static final String ALPHABET =
            "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    private static final int CODE_LENGTH = 7;
    private static final int MAX_ATTEMPTS = 5;

    private final SecureRandom random = new SecureRandom();

    @Autowired
    private ShortLinkRepository repository;

    /**
     * Master switch. Set {@code app.shortLinks.enabled: false} and every link reverts to its full
     * form on the next send, with no deploy — the escape hatch if a redirect ever misbehaves in
     * front of real students.
     */
    @Value("${app.shortLinks.enabled:true}")
    private boolean enabled;

    /**
     * A short code for {@code targetUrl}, or {@code null} if one could not be made.
     *
     * <p>An identical target that has been shortened before gets its existing code back, so an
     * admin pressing "send invite" three times does not leave three rows behind. Tokenized links
     * that mint a fresh JWT per send will not match, which is correct — they are different URLs.
     *
     * @param purpose free-text tag stored alongside the row, for support lookups
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String codeFor(String targetUrl, String purpose) {
        if (!enabled) return null;
        if (targetUrl == null || targetUrl.isBlank()) return null;

        try {
            String hash = sha256(targetUrl);

            List<ShortLink> existing = repository.findByTargetHashOrderByIdDesc(hash);
            for (ShortLink candidate : existing) {
                // Compare the URL itself, not just the hash: a hash collision is not a real
                // worry, but a truncated or re-encoded target would be, and this costs nothing.
                if (targetUrl.equals(candidate.getTargetUrl()) && !isExpired(candidate)) {
                    return candidate.getCode();
                }
            }

            for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
                String code = randomCode();
                if (repository.existsByCode(code)) continue;
                ShortLink link = new ShortLink();
                link.setCode(code);
                link.setTargetUrl(targetUrl);
                link.setTargetHash(hash);
                link.setPurpose(purpose);
                repository.saveAndFlush(link);
                return code;
            }
            logger.warn("Could not allocate a short code after {} attempts — sending the full link",
                    MAX_ATTEMPTS);
            return null;
        } catch (Exception e) {
            // Deliberately swallowed: see the class comment. The caller sends the long URL.
            logger.warn("Short link could not be created for purpose {} — sending the full link: {}",
                    purpose, e.getMessage());
            return null;
        }
    }

    /** The full URL behind a code, or empty when the code is unknown or expired. */
    @Transactional(readOnly = true)
    public Optional<ShortLink> resolve(String code) {
        if (code == null || code.isBlank()) return Optional.empty();
        return repository.findByCode(code).filter(link -> !isExpired(link));
    }

    /**
     * Counts an open. Isolated in its own transaction and swallowing its own failures, because a
     * student's redirect must not depend on a statistics write succeeding.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordHit(Long id) {
        try {
            repository.recordHit(id);
        } catch (Exception e) {
            logger.debug("Could not record a hit on short link {}: {}", id, e.getMessage());
        }
    }

    private static boolean isExpired(ShortLink link) {
        return link.getExpiresAt() != null && link.getExpiresAt().isBefore(LocalDateTime.now());
    }

    private String randomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    private static String sha256(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] out = digest.digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder(out.length * 2);
        for (byte b : out) sb.append(Character.forDigit((b >> 4) & 0xF, 16))
                             .append(Character.forDigit(b & 0xF, 16));
        return sb.toString();
    }
}
