package com.kccitm.api.service.email.port;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import com.kccitm.api.model.email.EmailTemplate;
import com.kccitm.api.model.email.PortState;
import com.kccitm.api.model.email.ReviewStatus;
import com.kccitm.api.repository.email.EmailTemplateRepository;
import com.kccitm.api.service.email.TemplateContentHash;

/**
 * Seeds every {@link PortedTemplate} from every {@link PortedTemplateSource} bean on boot, so
 * the mail catalogue shows the copy each sender produces today. Idempotent on
 * {@code mail_key}: a key that already has a row is left alone, so admin edits, review
 * notes and deletions survive restarts. Rows are seeded {@link PortState#CONTENT_ONLY} and
 * not default, because the senders still build these mails in Java; the dispatcher will not
 * render them until the sender is migrated and the state flipped.
 *
 * <p>Runs after {@code EmailTemplateSeeder} (order 100) so the flagship live seeds land first.
 */
@Component
@Order(200)
public class CodePortSeeder implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(CodePortSeeder.class);

    @Autowired(required = false)
    private List<PortedTemplateSource> sources;

    @Autowired
    private EmailTemplateRepository templateRepository;

    @Override
    public void run(ApplicationArguments args) {
        if (sources == null || sources.isEmpty()) {
            return;
        }
        Set<String> seen = new HashSet<>();
        int seeded = 0;
        int present = 0;
        for (PortedTemplateSource source : sources) {
            List<PortedTemplate> templates;
            try {
                templates = source.templates();
            } catch (RuntimeException e) {
                logger.warn("Ported template source {} failed: {}", source.getClass().getSimpleName(), e.getMessage());
                continue;
            }
            for (PortedTemplate p : templates) {
                if (!seen.add(p.mailKey)) {
                    logger.warn("Duplicate ported mailKey {} in {}; keeping the first", p.mailKey,
                            source.getClass().getSimpleName());
                    continue;
                }
                try {
                    if (templateRepository.existsByMailKey(p.mailKey)) {
                        present++;
                        continue;
                    }
                    templateRepository.save(toEntity(p));
                    seeded++;
                } catch (Exception e) {
                    logger.warn("Could not seed ported template {}: {}", p.mailKey, e.getMessage());
                }
            }
        }
        if (seeded > 0) {
            logger.info("Mail catalogue: seeded {} ported template(s), {} already present", seeded, present);
        }
    }

    static EmailTemplate toEntity(PortedTemplate p) {
        EmailTemplate t = new EmailTemplate();
        t.setName(p.name);
        t.setEmailType(p.type.name());
        t.setMailKey(p.mailKey);
        t.setSubjectTemplate(p.subject);
        t.setBodyTemplate(p.body);
        t.setTextTemplate(p.text);
        t.setMailClass(p.mailClass);
        t.setSeedOrigin(p.origin);
        t.setSourceRef(p.sourceRef);
        t.setSeededHash(TemplateContentHash.of(p.subject, p.body, p.text));
        t.setPortState(PortState.CONTENT_ONLY);
        t.setVariantFlagList(p.variantFlags);
        t.setReviewStatus(ReviewStatus.NOT_REVIEWED);
        t.setIsDefault(false);
        t.setActive(true);
        t.setDeliveryMode(p.type.defaultDeliveryMode());
        return t;
    }
}
