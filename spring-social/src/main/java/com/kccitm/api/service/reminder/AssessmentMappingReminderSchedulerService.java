package com.kccitm.api.service.reminder;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.reminder.ReminderConfig;
import com.kccitm.api.model.reminder.ReminderServiceType;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.UserRepository;

/**
 * Third reminder system: nudges students who have an assigned assessment
 * (via institute mapping) but haven't started it after lead_time_minutes from
 * mapping creation. Caps and templates come from {@link ReminderConfigService}.
 *
 * Runs hourly at minute 15 (offset from the existing two schedulers to avoid
 * clustering). The cron expression is fixed at startup; runtime enable/disable
 * is honored via config so toggling 'enabled = false' makes this a no-op tick.
 */
@Service
public class AssessmentMappingReminderSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(AssessmentMappingReminderSchedulerService.class);

    @Autowired private StudentAssessmentMappingRepository mappingRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private ReminderConfigService configService;
    @Autowired private ReminderSender sender;

    // Disabled: the "not started" assessment-mapping reminder no longer runs
    // automatically. Re-enable by uncommenting the @Scheduled annotation below.
    // @Scheduled(cron = "0 15 * * * *")
    public void runScheduledNudges() {
        ReminderConfig cfg = configService.get(ReminderServiceType.ASSESSMENT_MAPPING);
        if (cfg == null || !Boolean.TRUE.equals(cfg.getEnabled())) {
            return;
        }

        Integer leadMinutes = cfg.getLeadTimeMinutes();
        long leadMs = leadMinutes == null ? 0L : leadMinutes.longValue() * 60_000L;
        Date now = new Date();

        int sent = 0, skipped = 0;
        for (StudentAssessmentMapping m : mappingRepository.findAll()) {
            if (m == null) continue;
            if (!"notstarted".equalsIgnoreCase(m.getStatus())) { skipped++; continue; }

            // Best-effort age gate: if the model exposes a created/assigned timestamp via reflection, honour it.
            Date assignedAt = readDate(m, "getCreatedAt");
            if (assignedAt == null) assignedAt = readDate(m, "getCreatedDate");
            if (assignedAt != null && (now.getTime() - assignedAt.getTime()) < leadMs) {
                skipped++;
                continue;
            }

            UserStudent us = m.getUserStudent();
            if (us == null) { skipped++; continue; }
            User u = us.getUserId() == null ? null : userRepository.findById(us.getUserId()).orElse(null);
            if (u == null || u.getEmail() == null || u.getEmail().isEmpty()) { skipped++; continue; }

            InstituteDetail inst = us.getInstitute();

            ReminderSender.Context c = new ReminderSender.Context();
            c.serviceType = ReminderServiceType.ASSESSMENT_MAPPING;
            c.recipient = u.getEmail();
            c.userStudentId = us.getUserStudentId();
            c.instituteCode = inst == null ? null : inst.getInstituteCode();
            c.assessmentMappingId = m.getStudentAssessmentId();
            Map<String, Object> vars = new HashMap<>();
            vars.put("studentName", displayName(u));
            vars.put("studentEmail", u.getEmail());
            vars.put("assessmentName", "Assessment #" + m.getAssessmentId());
            vars.put("instituteName", inst == null ? "" : inst.getInstituteName());
            vars.put("link", "");
            c.variables = vars;
            sender.send(c);
            sent++;
        }
        log.info("ASSESSMENT_MAPPING reminders tick: sent={} skipped={}", sent, skipped);
    }

    private Date readDate(Object target, String method) {
        try {
            Object v = target.getClass().getMethod(method).invoke(target);
            return (v instanceof Date) ? (Date) v : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private String displayName(User u) {
        try {
            Object v = u.getClass().getMethod("getName").invoke(u);
            if (v != null && !v.toString().isEmpty()) return v.toString();
        } catch (Exception ignored) {}
        return u.getEmail() == null ? "Student" : u.getEmail();
    }
}
