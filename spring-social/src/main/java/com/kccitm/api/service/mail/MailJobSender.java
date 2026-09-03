package com.kccitm.api.service.mail;

import java.util.ArrayList;
import java.util.HashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.email.EmailDeliveryMode;
import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.model.email.EmailSendResult;
import com.kccitm.api.model.email.EmailTemplate;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.mail.MailJob;
import com.kccitm.api.repository.email.EmailTemplateRepository;
import com.kccitm.api.service.email.EmailDispatchService;

/**
 * Turns a {@link MailJob} into a dispatcher send. The dispatcher is the only path to a
 * sender, so every automation send lands in the log with its automation, job and event.
 * A job whose template has gone missing is skipped and logged rather than sent empty.
 */
@Service
public class MailJobSender {

    @Autowired
    private EmailDispatchService dispatcher;

    @Autowired
    private EmailTemplateRepository templateRepository;

    public EmailSendResult send(MailJob job) {
        EmailSendRequest req = request(job);
        if (job.templateId == null) {
            return dispatcher.logSkipped(req, "automation has no template");
        }
        EmailTemplate t = templateRepository.findById(job.templateId).orElse(null);
        if (t == null || !Boolean.TRUE.equals(t.getActive())) {
            return dispatcher.logSkipped(req, "template missing or inactive");
        }
        req.setOverrideTemplateId(t.getId());
        req.setAllowContentOnlyTemplate(true);
        req.setSubject(job.automationName); // fallback only; the template's subject wins
        req.setDeliveryModeOverride(EmailDeliveryMode.SYNC);
        return dispatcher.send(req);
    }

    public EmailSendResult logSkipped(MailJob job, String reason) {
        return dispatcher.logSkipped(request(job), reason);
    }

    private static EmailSendRequest request(MailJob job) {
        EmailSendRequest req = new EmailSendRequest();
        EmailType type = EmailType.from(job.emailType);
        req.setEmailType(type != null ? type : EmailType.GENERIC);
        req.setTo(new ArrayList<>(job.to));
        req.setCc(new ArrayList<>(job.cc));
        req.setBcc(new ArrayList<>(job.bcc));
        req.setTemplateContext(new HashMap<>(job.fields));
        req.setInstituteCode(job.instituteCode);
        req.setUserStudentId(job.userStudentId);
        req.setAutomationId(job.automationId);
        req.setJobId(job.id);
        req.setEventKey(job.eventKey);
        return req;
    }
}
