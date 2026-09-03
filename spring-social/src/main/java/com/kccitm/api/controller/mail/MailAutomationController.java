package com.kccitm.api.controller.mail;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.mail.MailAutomationForm;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.mail.MailAudienceRegistry;
import com.kccitm.api.service.mail.MailAutomationService;

/** Admin CRUD for mail automations, the event catalogue, and the audiences a schedule can address. */
@RestController
@RequestMapping("/mail-automations")
public class MailAutomationController {

    @Autowired
    private MailAutomationService service;

    @Autowired
    private MailAudienceRegistry audiences;

    @PreAuthorize("@auth.allows('mail_automation.read')")
    @GetMapping("")
    public ResponseEntity<?> list() {
        return ResponseEntity.ok(service.list());
    }

    @PreAuthorize("@auth.allows('mail_automation.read')")
    @GetMapping("/audiences")
    public ResponseEntity<?> audiences() {
        return ResponseEntity.ok(audiences.describe());
    }

    @PreAuthorize("@auth.allows('mail_automation.read')")
    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id) {
        Map<String, Object> dto = service.get(id);
        return dto == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(dto);
    }

    @PreAuthorize("@auth.allows('mail_automation.edit')")
    @PostMapping("")
    public ResponseEntity<?> create(@RequestBody MailAutomationForm form) {
        try {
            return ResponseEntity.ok(service.create(form, currentUserId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(error(e.getMessage()));
        }
    }

    @PreAuthorize("@auth.allows('mail_automation.edit')")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody MailAutomationForm form) {
        try {
            Map<String, Object> dto = service.update(id, form, currentUserId());
            return dto == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(dto);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(error(e.getMessage()));
        }
    }

    @PreAuthorize("@auth.allows('mail_automation.edit')")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        return service.delete(id) ? ResponseEntity.ok(message("Deleted")) : ResponseEntity.notFound().build();
    }

    @PreAuthorize("@auth.allows('mail_automation.edit')")
    @PostMapping("/{id}/enabled")
    public ResponseEntity<?> enabled(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Map<String, Object> dto = service.setEnabled(id, Boolean.TRUE.equals(body.get("enabled")), currentUserId());
        return dto == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(dto);
    }

    @PreAuthorize("@auth.allows('mail_automation.edit')")
    @PostMapping("/{id}/paused")
    public ResponseEntity<?> paused(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Map<String, Object> dto = service.setPaused(id, Boolean.TRUE.equals(body.get("paused")), currentUserId());
        return dto == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(dto);
    }

    static Long currentUserId() {
        try {
            Authentication a = SecurityContextHolder.getContext().getAuthentication();
            if (a != null && a.getPrincipal() instanceof UserPrincipal) {
                return ((UserPrincipal) a.getPrincipal()).getId();
            }
        } catch (Exception ignored) {
            // best effort
        }
        return null;
    }

    static Map<String, Object> error(String message) {
        Map<String, Object> m = new HashMap<>();
        m.put("error", message);
        return m;
    }

    static Map<String, Object> message(String message) {
        Map<String, Object> m = new HashMap<>();
        m.put("message", message);
        return m;
    }
}
