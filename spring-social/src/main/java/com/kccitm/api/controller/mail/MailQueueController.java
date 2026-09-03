package com.kccitm.api.controller.mail;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.email.EmailSendStatus;
import com.kccitm.api.model.email.EmailTemplate;
import com.kccitm.api.model.mail.MailJob;
import com.kccitm.api.model.mail.MailJobStatus;
import com.kccitm.api.repository.email.EmailSendLogRepository;
import com.kccitm.api.repository.email.EmailTemplateRepository;
import com.kccitm.api.service.mail.MailJobSender;
import com.kccitm.api.service.mail.MailSettingsService;
import com.kccitm.api.service.mail.RedisMailQueue;

/** The Queue tab: what is waiting, what just happened, cancel, retry, pause. */
@RestController
@RequestMapping("/mail-queue")
public class MailQueueController {

    @Autowired private RedisMailQueue queue;
    @Autowired private MailSettingsService settings;
    @Autowired private EmailSendLogRepository logRepository;
    @Autowired private EmailTemplateRepository templateRepository;
    @Autowired private MailJobSender sender;

    @PreAuthorize("@auth.allows('mail_automation.read')")
    @GetMapping("")
    public ResponseEntity<?> list(@RequestParam(required = false) String status,
                                  @RequestParam(required = false) Long automationId,
                                  @RequestParam(required = false) String recipient,
                                  @RequestParam(required = false, defaultValue = "200") int limit) {
        int cap = Math.min(Math.max(limit, 1), 1000);
        List<MailJob> pending = queue.listPending(cap);
        List<MailJob> processing = queue.listProcessing();
        List<MailJob> all = new ArrayList<>(processing);
        all.addAll(pending);
        long retrying = 0;
        for (MailJob j : all) {
            if (MailJobStatus.RETRY.name().equals(j.status)) retrying++;
        }
        Map<Long, String> names = new HashMap<>();
        List<Map<String, Object>> jobs = new ArrayList<>();
        for (MailJob j : all) {
            if (status != null && !status.trim().isEmpty() && !status.trim().equalsIgnoreCase(j.status)) continue;
            if (automationId != null && !automationId.equals(j.automationId)) continue;
            if (recipient != null && !recipient.trim().isEmpty()
                    && (j.primaryRecipient() == null || !j.primaryRecipient().toLowerCase().contains(recipient.trim().toLowerCase()))) continue;
            jobs.add(toDto(j, names));
        }
        List<Map<String, Object>> recent = new ArrayList<>();
        for (MailJob j : queue.recent(100)) {
            recent.add(toDto(j, names));
        }
        Date startOfDay = Date.from(LocalDate.now(settings.zone()).atStartOfDay(settings.zone()).toInstant());
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("engineEnabled", settings.engineEnabled());
        summary.put("paused", queue.isPaused());
        summary.put("pending", queue.pendingCount());
        summary.put("processing", queue.processingCount());
        summary.put("retrying", retrying);
        summary.put("sentToday", logRepository.countByStatusAndCreatedAtAfter(EmailSendStatus.SENT, startOfDay));
        summary.put("failedToday", logRepository.countByStatusAndCreatedAtAfter(EmailSendStatus.FAILED, startOfDay));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("summary", summary);
        out.put("jobs", jobs);
        out.put("recent", recent);
        return ResponseEntity.ok(out);
    }

    @PreAuthorize("@auth.allows('mail_automation.edit')")
    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancel(@PathVariable String id) {
        MailJob job = queue.load(id);
        if (job == null) return ResponseEntity.notFound().build();
        if (!queue.cancel(id, "cancelled by admin")) {
            return ResponseEntity.badRequest().body(MailAutomationController.error("Job is already finished"));
        }
        sender.logSkipped(job, "cancelled by admin");
        return ResponseEntity.ok(MailAutomationController.message("Cancelled"));
    }

    @PreAuthorize("@auth.allows('mail_automation.edit')")
    @PostMapping("/{id}/retry")
    public ResponseEntity<?> retry(@PathVariable String id) {
        if (!queue.fireNow(id)) {
            return ResponseEntity.badRequest().body(MailAutomationController.error("Job is not pending"));
        }
        return ResponseEntity.ok(MailAutomationController.message("Scheduled to send now"));
    }

    @PreAuthorize("@auth.allows('mail_automation.edit')")
    @PostMapping("/paused")
    public ResponseEntity<?> paused(@RequestBody Map<String, Object> body) {
        boolean paused = Boolean.TRUE.equals(body.get("paused"));
        queue.setPaused(paused);
        Map<String, Object> out = new HashMap<>();
        out.put("paused", paused);
        return ResponseEntity.ok(out);
    }

    private Map<String, Object> toDto(MailJob j, Map<Long, String> templateNames) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", j.id);
        m.put("automationId", j.automationId);
        m.put("automationName", j.automationName);
        m.put("eventKey", j.eventKey);
        m.put("recipient", String.join(", ", j.to));
        m.put("role", j.role);
        m.put("subjectKey", j.subjectKey);
        m.put("fireAt", new Date(j.fireAt));
        m.put("createdAt", new Date(j.createdAt));
        m.put("attempts", j.attempts);
        m.put("seq", j.seq);
        m.put("status", j.status);
        m.put("lastError", j.lastError);
        m.put("skipReason", j.skipReason);
        String name = null;
        if (j.templateId != null) {
            name = templateNames.computeIfAbsent(j.templateId, id -> {
                EmailTemplate t = templateRepository.findById(id).orElse(null);
                return t == null ? "(missing)" : t.getName();
            });
        }
        m.put("templateName", name);
        return m;
    }
}
