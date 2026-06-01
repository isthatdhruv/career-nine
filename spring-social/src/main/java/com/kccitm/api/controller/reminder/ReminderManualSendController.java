package com.kccitm.api.controller.reminder;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.reminder.ReminderDeliveryLog;
import com.kccitm.api.model.reminder.ReminderServiceType;
import com.kccitm.api.service.reminder.ManualReminderService;
import com.kccitm.api.service.reminder.ManualReminderService.PreviewFilter;
import com.kccitm.api.service.reminder.ManualReminderService.Recipient;

@RestController
@RequestMapping("/reminders/manual")
public class ReminderManualSendController {

    @Autowired private ManualReminderService manualService;

    @PreAuthorize("@auth.allows('reminders.send.manual')")
    @PostMapping("/preview")
    public ResponseEntity<?> preview(@RequestBody Map<String, Object> body) {
        ReminderServiceType type = ReminderServiceType.from((String) body.get("serviceType"));
        if (type == null) return ResponseEntity.badRequest().body("serviceType required");
        if (type != ReminderServiceType.ASSESSMENT_MAPPING) {
            return ResponseEntity.ok(emptyPreview("Preview is only implemented for ASSESSMENT_MAPPING. For other service types, supply a pre-resolved recipient list to /send."));
        }
        PreviewFilter f = readFilter(body);
        List<Recipient> recipients = manualService.previewAssessmentMapping(f);
        return ResponseEntity.ok(buildPreview(recipients));
    }

    @PreAuthorize("@auth.allows('reminders.send.manual')")
    @PostMapping("/send")
    public ResponseEntity<?> send(@RequestBody Map<String, Object> body) {
        ReminderServiceType type = ReminderServiceType.from((String) body.get("serviceType"));
        if (type == null) return ResponseEntity.badRequest().body("serviceType required");
        String subjectOverride = (String) body.get("subject");
        String bodyOverride = (String) body.get("body");

        List<ReminderDeliveryLog> logs;
        if (type == ReminderServiceType.ASSESSMENT_MAPPING) {
            logs = manualService.sendAssessmentMapping(readFilter(body), subjectOverride, bodyOverride);
        } else {
            // Other service types: caller must pass a recipients[] array.
            List<Recipient> recipients = readRecipients(body);
            if (recipients.isEmpty()) {
                return ResponseEntity.badRequest().body("recipients[] array required for " + type);
            }
            logs = manualService.sendGeneric(type, recipients, subjectOverride, bodyOverride);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", logs.size());
        out.put("sent",  logs.stream().filter(l -> "SENT".equals(l.getDeliveryStatus().name())).count());
        out.put("failed", logs.stream().filter(l -> "FAILED".equals(l.getDeliveryStatus().name())).count());
        out.put("suppressed", logs.stream().filter(l -> "SUPPRESSED".equals(l.getDeliveryStatus().name())).count());
        out.put("capped", logs.stream().filter(l -> "CAPPED".equals(l.getDeliveryStatus().name())).count());
        return ResponseEntity.ok(out);
    }

    private PreviewFilter readFilter(Map<String, Object> body) {
        PreviewFilter f = new PreviewFilter();
        if (body.get("assessmentId")  != null) f.assessmentId  = ((Number) body.get("assessmentId")).longValue();
        if (body.get("instituteCode") != null) f.instituteCode = ((Number) body.get("instituteCode")).intValue();
        if (body.get("status")        != null) f.mappingStatus = (String) body.get("status");
        return f;
    }

    @SuppressWarnings("unchecked")
    private List<Recipient> readRecipients(Map<String, Object> body) {
        List<Recipient> out = new ArrayList<>();
        Object raw = body.get("recipients");
        if (!(raw instanceof List)) return out;
        for (Object o : (List<Object>) raw) {
            if (!(o instanceof Map)) continue;
            Map<String, Object> r = (Map<String, Object>) o;
            Recipient rec = new Recipient();
            if (r.get("userStudentId") != null) rec.userStudentId = ((Number) r.get("userStudentId")).longValue();
            rec.email = (String) r.get("email");
            rec.name = (String) r.get("name");
            if (r.get("instituteCode") != null) rec.instituteCode = ((Number) r.get("instituteCode")).intValue();
            rec.variables = r.get("variables") instanceof Map ? (Map<String, Object>) r.get("variables") : new HashMap<>();
            out.add(rec);
        }
        return out;
    }

    private Map<String, Object> emptyPreview(String note) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("recipients", new ArrayList<>());
        m.put("total", 0);
        m.put("note", note);
        return m;
    }

    private Map<String, Object> buildPreview(List<Recipient> recipients) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Recipient r : recipients) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userStudentId", r.userStudentId);
            m.put("email", r.email);
            m.put("name", r.name);
            m.put("instituteCode", r.instituteCode);
            m.put("instituteName", r.instituteName);
            m.put("mappingId", r.mappingId);
            m.put("assessmentId", r.assessmentId);
            rows.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("recipients", rows);
        out.put("total", rows.size());
        return out;
    }
}
