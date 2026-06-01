package com.kccitm.api.controller.reminder;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.reminder.ReminderDeliveryLog;
import com.kccitm.api.model.reminder.ReminderDeliveryStatus;
import com.kccitm.api.model.reminder.ReminderServiceType;
import com.kccitm.api.service.reminder.ReminderDeliveryLogService;
import com.kccitm.api.service.reminder.ReminderScopeFilter;

@RestController
@RequestMapping("/reminders/logs")
public class ReminderLogController {

    @Autowired private ReminderDeliveryLogService logService;
    @Autowired private ReminderScopeFilter scope;

    @PreAuthorize("@auth.allows('reminders.logs.view')")
    @GetMapping("")
    public ResponseEntity<?> list(@RequestParam(required = false) String serviceType,
                                  @RequestParam(required = false) String status,
                                  @RequestParam(required = false) String recipient,
                                  @RequestParam(required = false) String from,
                                  @RequestParam(required = false) String to,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "25") int size) {
        ReminderServiceType svc = ReminderServiceType.from(serviceType);
        ReminderDeliveryStatus st = parseStatus(status);
        Date fromDate = parseDate(from);
        Date toDate = parseDate(to);

        Page<ReminderDeliveryLog> p = logService.search(svc, st, recipient, fromDate, toDate, page, size);

        List<Integer> allowedInstitutes = scope.allowedInstituteCodes();
        List<Map<String, Object>> rows = new java.util.ArrayList<>();
        for (ReminderDeliveryLog l : p.getContent()) {
            if (allowedInstitutes != null && l.getInstituteCode() != null
                    && !allowedInstitutes.contains(l.getInstituteCode())) {
                continue; // ABAC filter
            }
            rows.add(toRowDto(l));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("rows", rows);
        out.put("page", p.getNumber());
        out.put("size", p.getSize());
        out.put("totalElements", p.getTotalElements());
        out.put("totalPages", p.getTotalPages());
        return ResponseEntity.ok(out);
    }

    @PreAuthorize("@auth.allows('reminders.logs.view')")
    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id) {
        ReminderDeliveryLog l = logService.findById(id);
        if (l == null) return ResponseEntity.notFound().build();
        if (!scope.canAccessInstitute(l.getInstituteCode())) {
            return ResponseEntity.status(403).body("Out of scope");
        }
        return ResponseEntity.ok(toFullDto(l));
    }

    @PreAuthorize("@auth.allows('reminders.logs.view')")
    @GetMapping("/stats")
    public ResponseEntity<?> stats(@RequestParam(required = false) String from,
                                   @RequestParam(required = false) String to) {
        Map<String, Map<String, Long>> stats = logService.stats(parseDate(from), parseDate(to));
        return ResponseEntity.ok(stats);
    }

    private Map<String, Object> toRowDto(ReminderDeliveryLog l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.getId());
        m.put("serviceType", l.getServiceType().name());
        m.put("recipient", l.getRecipient());
        m.put("userStudentId", l.getUserStudentId());
        m.put("instituteCode", l.getInstituteCode());
        m.put("subject", l.getSubject());
        m.put("deliveryStatus", l.getDeliveryStatus().name());
        m.put("failureReason", l.getFailureReason());
        m.put("triggeredBy", l.getTriggeredBy().name());
        m.put("sentAt", l.getSentAt());
        m.put("createdAt", l.getCreatedAt());
        return m;
    }

    private Map<String, Object> toFullDto(ReminderDeliveryLog l) {
        Map<String, Object> m = toRowDto(l);
        m.put("body", l.getBodySnapshot());
        m.put("linkUrl", l.getLinkUrl());
        m.put("entitlementId", l.getEntitlementId());
        m.put("appointmentId", l.getAppointmentId());
        m.put("assessmentMappingId", l.getAssessmentMappingId());
        return m;
    }

    private ReminderDeliveryStatus parseStatus(String s) {
        if (s == null || s.isEmpty()) return null;
        try { return ReminderDeliveryStatus.valueOf(s); }
        catch (IllegalArgumentException e) { return null; }
    }

    private Date parseDate(String s) {
        if (s == null || s.isEmpty()) return null;
        try { return new SimpleDateFormat("yyyy-MM-dd").parse(s); }
        catch (Exception e) { return null; }
    }
}
