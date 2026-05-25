package com.kccitm.api.service.reminder;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.reminder.ReminderDeliveryLog;
import com.kccitm.api.model.reminder.ReminderServiceType;
import com.kccitm.api.model.reminder.ReminderTriggerSource;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.UserRepository;

/**
 * Orchestrates manual (admin-triggered) reminder sends and recipient previews.
 *
 * For the new ASSESSMENT_MAPPING service type, recipients are resolved by
 * querying StudentAssessmentMapping. Other service types accept a pre-resolved
 * list of recipients supplied by the caller.
 */
@Service
public class ManualReminderService {

    @Autowired private StudentAssessmentMappingRepository mappingRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private ReminderSender sender;
    @Autowired private ReminderScopeFilter scope;

    public static class Recipient {
        public Long userStudentId;
        public String email;
        public String name;
        public Integer instituteCode;
        public String instituteName;
        public Long mappingId;
        public Long assessmentId;
        public Map<String, Object> variables = new HashMap<>();
    }

    public static class PreviewFilter {
        public Long assessmentId;            // optional
        public Integer instituteCode;        // optional
        public String mappingStatus;         // e.g. "notstarted"
    }

    public List<Recipient> previewAssessmentMapping(PreviewFilter filter) {
        List<Recipient> out = new ArrayList<>();
        Iterable<StudentAssessmentMapping> rows;

        if (filter != null && filter.assessmentId != null) {
            rows = mappingRepository.findAllByAssessmentId(filter.assessmentId);
        } else {
            rows = mappingRepository.findAll();
        }

        String wantStatus = (filter != null && filter.mappingStatus != null) ? filter.mappingStatus : "notstarted";
        List<Integer> allowedInstitutes = scope.allowedInstituteCodes();

        for (StudentAssessmentMapping m : rows) {
            if (m == null) continue;
            if (!wantStatus.equalsIgnoreCase(m.getStatus())) continue;

            UserStudent us = m.getUserStudent();
            if (us == null) continue;
            InstituteDetail inst = us.getInstitute();
            Integer code = inst == null ? null : inst.getInstituteCode();
            if (filter != null && filter.instituteCode != null && !filter.instituteCode.equals(code)) continue;
            if (allowedInstitutes != null && code != null && !allowedInstitutes.contains(code)) continue;

            User u = us.getUserId() == null ? null : userRepository.findById(us.getUserId()).orElse(null);
            if (u == null || u.getEmail() == null || u.getEmail().isEmpty()) continue;

            Recipient r = new Recipient();
            r.userStudentId = us.getUserStudentId();
            r.email = u.getEmail();
            r.name = displayName(u);
            r.instituteCode = code;
            r.instituteName = inst == null ? null : inst.getInstituteName();
            r.mappingId = m.getStudentAssessmentId();
            r.assessmentId = m.getAssessmentId();
            r.variables.put("studentName", r.name);
            r.variables.put("studentEmail", r.email);
            r.variables.put("assessmentName", "Assessment #" + m.getAssessmentId());
            r.variables.put("instituteName", r.instituteName == null ? "" : r.instituteName);
            r.variables.put("link", "");
            out.add(r);
        }
        return out;
    }

    public List<ReminderDeliveryLog> sendAssessmentMapping(PreviewFilter filter,
                                                           String subjectOverride,
                                                           String bodyOverride) {
        List<ReminderDeliveryLog> logs = new ArrayList<>();
        Long actor = scope.currentUserId();
        for (Recipient r : previewAssessmentMapping(filter)) {
            ReminderSender.Context c = new ReminderSender.Context();
            c.serviceType = ReminderServiceType.ASSESSMENT_MAPPING;
            c.recipient = r.email;
            c.userStudentId = r.userStudentId;
            c.instituteCode = r.instituteCode;
            c.assessmentMappingId = r.mappingId;
            c.variables = r.variables;
            c.triggeredBy = ReminderTriggerSource.MANUAL;
            c.triggeredByUserId = actor;
            c.subjectOverride = subjectOverride;
            c.bodyOverride = bodyOverride;
            logs.add(sender.send(c));
        }
        return logs;
    }

    /**
     * Generic manual send for any service type. Caller supplies a pre-resolved
     * recipient list (e.g., from a UI multi-select).
     */
    public List<ReminderDeliveryLog> sendGeneric(ReminderServiceType type,
                                                 List<Recipient> recipients,
                                                 String subjectOverride,
                                                 String bodyOverride) {
        List<ReminderDeliveryLog> logs = new ArrayList<>();
        if (recipients == null) return logs;
        Long actor = scope.currentUserId();
        for (Recipient r : recipients) {
            ReminderSender.Context c = new ReminderSender.Context();
            c.serviceType = type;
            c.recipient = r.email;
            c.userStudentId = r.userStudentId;
            c.instituteCode = r.instituteCode;
            c.variables = r.variables;
            c.triggeredBy = ReminderTriggerSource.MANUAL;
            c.triggeredByUserId = actor;
            c.subjectOverride = subjectOverride;
            c.bodyOverride = bodyOverride;
            logs.add(sender.send(c));
        }
        return logs;
    }

    private String displayName(User u) {
        if (u == null) return "Student";
        // Best-effort — the User model uses different naming across the codebase.
        try {
            java.lang.reflect.Method m = u.getClass().getMethod("getName");
            Object v = m.invoke(u);
            if (v != null && !v.toString().isEmpty()) return v.toString();
        } catch (Exception ignored) {}
        return u.getEmail() == null ? "Student" : u.getEmail();
    }
}
