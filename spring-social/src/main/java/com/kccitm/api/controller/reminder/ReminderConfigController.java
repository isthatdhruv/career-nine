package com.kccitm.api.controller.reminder;

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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.reminder.ReminderConfig;
import com.kccitm.api.model.reminder.ReminderDeliveryLog;
import com.kccitm.api.model.reminder.ReminderServiceType;
import com.kccitm.api.model.reminder.ReminderTriggerSource;
import com.kccitm.api.service.reminder.ReminderConfigService;
import com.kccitm.api.service.reminder.ReminderDeliveryLogService;
import com.kccitm.api.service.reminder.ReminderScopeFilter;
import com.kccitm.api.service.reminder.ReminderSender;
import com.kccitm.api.service.reminder.ReminderTemplateRenderer;

@RestController
@RequestMapping("/reminders/config")
public class ReminderConfigController {

    @Autowired private ReminderConfigService configService;
    @Autowired private ReminderTemplateRenderer templateRenderer;
    @Autowired private ReminderDeliveryLogService logService;
    @Autowired private ReminderScopeFilter scope;
    @Autowired private ReminderSender sender;

    @PreAuthorize("@auth.allows('reminders.config.read')")
    @GetMapping("")
    public ResponseEntity<?> listAll() {
        List<ReminderConfig> all = configService.getAll();
        List<Map<String, Object>> out = new java.util.ArrayList<>();
        for (ReminderConfig c : all) {
            out.add(toDto(c));
        }
        return ResponseEntity.ok(out);
    }

    @PreAuthorize("@auth.allows('reminders.config.read')")
    @GetMapping("/{serviceType}")
    public ResponseEntity<?> getOne(@PathVariable String serviceType) {
        ReminderServiceType type = ReminderServiceType.from(serviceType);
        if (type == null) return ResponseEntity.badRequest().body("Unknown service type");
        ReminderConfig c = configService.get(type);
        if (c == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(toDto(c));
    }

    @PreAuthorize("@auth.allows('reminders.config.edit')")
    @PutMapping("/{serviceType}")
    public ResponseEntity<?> updateConfig(@PathVariable String serviceType,
                                          @RequestBody Map<String, Object> body) {
        ReminderServiceType type = ReminderServiceType.from(serviceType);
        if (type == null) return ResponseEntity.badRequest().body("Unknown service type");
        Boolean enabled = (Boolean) body.get("enabled");
        String cron = (String) body.get("cronExpression");
        Integer lead = body.get("leadTimeMinutes") == null ? null : ((Number) body.get("leadTimeMinutes")).intValue();
        Integer cap  = body.get("maxSendsPerRecipient") == null ? null : ((Number) body.get("maxSendsPerRecipient")).intValue();
        ReminderConfig saved = configService.updateConfig(type, enabled, cron, lead, cap, scope.currentUserId());
        return ResponseEntity.ok(toDto(saved));
    }

    @PreAuthorize("@auth.allows('reminders.template.edit')")
    @PutMapping("/{serviceType}/template")
    public ResponseEntity<?> updateTemplate(@PathVariable String serviceType,
                                            @RequestBody Map<String, Object> body) {
        ReminderServiceType type = ReminderServiceType.from(serviceType);
        if (type == null) return ResponseEntity.badRequest().body("Unknown service type");
        String subject = (String) body.get("subject");
        String tplBody = (String) body.get("body");
        ReminderConfig saved = configService.updateTemplate(type, subject, tplBody, scope.currentUserId());
        return ResponseEntity.ok(toDto(saved));
    }

    @PreAuthorize("@auth.allows('reminders.send.test')")
    @PostMapping("/{serviceType}/test")
    public ResponseEntity<?> sendTest(@PathVariable String serviceType,
                                      @RequestBody Map<String, Object> body) {
        ReminderServiceType type = ReminderServiceType.from(serviceType);
        if (type == null) return ResponseEntity.badRequest().body("Unknown service type");
        String to = (String) body.get("to");
        String subjectOverride = (String) body.get("subject");
        String bodyOverride = (String) body.get("body");

        ReminderSender.Context ctx = new ReminderSender.Context();
        ctx.serviceType = type;
        ctx.recipient = to;
        ctx.variables = new HashMap<>(templateRenderer.sampleContext(type));
        ctx.subjectOverride = subjectOverride;
        ctx.bodyOverride = bodyOverride;
        ctx.triggeredBy = ReminderTriggerSource.TEST;
        ctx.triggeredByUserId = scope.currentUserId();

        ReminderDeliveryLog log = sender.send(ctx);
        Map<String, Object> out = new HashMap<>();
        out.put("status", log.getDeliveryStatus().name());
        out.put("subject", log.getSubject());
        out.put("body", log.getBodySnapshot());
        out.put("failureReason", log.getFailureReason());
        out.put("note", "Test sends do not call the email provider — preview only.");
        return ResponseEntity.ok(out);
    }

    @PreAuthorize("@auth.allows('reminders.config.read')")
    @GetMapping("/{serviceType}/tokens")
    public ResponseEntity<?> tokens(@PathVariable String serviceType) {
        ReminderServiceType type = ReminderServiceType.from(serviceType);
        if (type == null) return ResponseEntity.badRequest().body("Unknown service type");
        Map<String, Object> out = new HashMap<>();
        out.put("tokens", templateRenderer.tokensFor(type));
        out.put("sample", templateRenderer.sampleContext(type));
        return ResponseEntity.ok(out);
    }

    private Map<String, Object> toDto(ReminderConfig c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("serviceType", c.getServiceType().name());
        m.put("enabled", c.getEnabled());
        m.put("cronExpression", c.getCronExpression());
        m.put("leadTimeMinutes", c.getLeadTimeMinutes());
        m.put("maxSendsPerRecipient", c.getMaxSendsPerRecipient());
        m.put("subjectTemplate", c.getSubjectTemplate());
        m.put("bodyTemplate", c.getBodyTemplate());
        m.put("updatedAt", c.getUpdatedAt());
        m.put("lastSentAt", logService.lastSentAt(c.getServiceType()));
        java.util.Date dayAgo = new java.util.Date(System.currentTimeMillis() - 24L * 3600_000L);
        m.put("sentLast24h", logService.countSentSince(c.getServiceType(), dayAgo));
        return m;
    }
}
