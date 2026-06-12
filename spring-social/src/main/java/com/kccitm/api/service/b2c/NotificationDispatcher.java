package com.kccitm.api.service.b2c;

import java.util.Date;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.b2c.ServiceDeliveryLog;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.repository.Career9.b2c.ServiceDeliveryLogRepository;
import com.kccitm.api.service.OdooEmailService;

/**
 * Wraps the existing Odoo email service and writes a ServiceDeliveryLog row
 * for every send. All B2C transactional emails route through here.
 */
@Service
public class NotificationDispatcher {

    private static final Logger logger = LoggerFactory.getLogger(NotificationDispatcher.class);

    @Autowired private OdooEmailService odooEmailService;
    @Autowired private ServiceDeliveryLogRepository serviceDeliveryLogRepository;

    public ServiceDeliveryLog sendEmail(StudentEntitlement entitlement,
                                        String recipient,
                                        String serviceType,
                                        String subject,
                                        String htmlBody,
                                        String linkUrl) {
        ServiceDeliveryLog log = new ServiceDeliveryLog();
        log.setEntitlementId(entitlement != null ? entitlement.getEntitlementId() : null);
        log.setUserStudentId(entitlement != null ? entitlement.getUserStudentId() : null);
        log.setServiceType(serviceType);
        log.setChannel("email");
        log.setRecipient(recipient);
        log.setSubject(subject);
        // Store a redacted copy of the link: the deep links embed the entitlement
        // access token as a `t=` query param, and this row is surfaced verbatim by
        // the admin Tracker (allotment detail + /entitlement/{id}/communications).
        // Persisting the raw token would let any tracker reader (or DB/log access)
        // lift a working bearer credential. The real, working link still goes out
        // in the email body (htmlBody) — only the stored audit copy is masked.
        log.setLinkUrl(redactToken(linkUrl));
        log.setTemplateKey(serviceType);

        if (recipient == null || recipient.trim().isEmpty()) {
            log.setDeliveryStatus("failed");
            log.setFailureReason("No recipient email");
            return serviceDeliveryLogRepository.save(log);
        }

        try {
            odooEmailService.sendHtmlEmail(recipient, subject, htmlBody);
            log.setDeliveryStatus("sent");
            log.setSentAt(new Date());
        } catch (Exception e) {
            logger.error("Email send failed for serviceType={} to={}", serviceType, recipient, e);
            log.setDeliveryStatus("failed");
            log.setFailureReason(e.getMessage());
        }
        return serviceDeliveryLogRepository.save(log);
    }

    public long countSent(Long entitlementId, String serviceType) {
        return serviceDeliveryLogRepository.countByEntitlementIdAndServiceType(entitlementId, serviceType);
    }

    /**
     * Masks the access-token query param ({@code t=...}) in a deep link so the
     * stored audit copy never carries a usable bearer credential. Leaves the
     * rest of the URL intact for human readability in the Tracker.
     */
    static String redactToken(String linkUrl) {
        if (linkUrl == null) return null;
        return linkUrl.replaceAll("([?&]t=)[^&]*", "$1REDACTED");
    }
}
