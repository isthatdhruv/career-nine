package com.kccitm.api.controller.reminder;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.reminder.ReminderServiceType;
import com.kccitm.api.model.reminder.ReminderSuppression;
import com.kccitm.api.service.reminder.ReminderScopeFilter;
import com.kccitm.api.service.reminder.ReminderSuppressionService;

@RestController
@RequestMapping("/reminders/suppressions")
public class ReminderSuppressionController {

    @Autowired private ReminderSuppressionService service;
    @Autowired private ReminderScopeFilter scope;

    @PreAuthorize("@auth.allows('reminders.suppressions.manage')")
    @GetMapping("")
    public ResponseEntity<?> list(@RequestParam(required = false) String serviceType,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "25") int size) {
        ReminderServiceType type = ReminderServiceType.from(serviceType);
        Page<ReminderSuppression> p = service.list(type, page, size);
        List<Map<String, Object>> rows = new java.util.ArrayList<>();
        for (ReminderSuppression s : p.getContent()) rows.add(toDto(s));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("rows", rows);
        out.put("page", p.getNumber());
        out.put("size", p.getSize());
        out.put("totalElements", p.getTotalElements());
        out.put("totalPages", p.getTotalPages());
        return ResponseEntity.ok(out);
    }

    @PreAuthorize("@auth.allows('reminders.suppressions.manage')")
    @PostMapping("")
    public ResponseEntity<?> add(@RequestBody Map<String, Object> body) {
        Long userStudentId = body.get("userStudentId") == null ? null : ((Number) body.get("userStudentId")).longValue();
        ReminderServiceType type = ReminderServiceType.from((String) body.get("serviceType"));
        String reason = (String) body.get("reason");
        if (userStudentId == null || type == null) return ResponseEntity.badRequest().body("userStudentId and serviceType required");
        ReminderSuppression saved = service.add(userStudentId, type, reason, scope.currentUserId());
        return ResponseEntity.ok(toDto(saved));
    }

    @PreAuthorize("@auth.allows('reminders.suppressions.manage')")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> remove(@PathVariable Long id) {
        service.remove(id);
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> toDto(ReminderSuppression s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("userStudentId", s.getUserStudentId());
        m.put("serviceType", s.getServiceType().name());
        m.put("reason", s.getReason());
        m.put("suppressedBy", s.getSuppressedBy());
        m.put("suppressedAt", s.getSuppressedAt());
        return m;
    }
}
