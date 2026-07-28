package com.kccitm.api.controller.email;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.email.EmailSendResult;
import com.kccitm.api.model.email.EmailTemplateForm;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.email.EmailTemplateService;

/** Admin CRUD for reusable email templates, plus the EmailType catalog, preview and test-send. */
@RestController
@RequestMapping("/email-templates")
public class EmailTemplateController {

    @Autowired
    private EmailTemplateService templateService;

    @PreAuthorize("@auth.allows('email_template.read')")
    @GetMapping("")
    public ResponseEntity<?> list(@RequestParam(required = false) String emailType) {
        return ResponseEntity.ok(templateService.list(emailType));
    }

    /** The EmailType catalog (send-scenarios + placeholder palette) the editor reads. */
    @PreAuthorize("@auth.allows('email_template.read')")
    @GetMapping("/catalog")
    public ResponseEntity<?> catalog() {
        return ResponseEntity.ok(templateService.catalog());
    }

    @PreAuthorize("@auth.allows('email_template.read')")
    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id) {
        Map<String, Object> dto = templateService.get(id);
        if (dto == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(dto);
    }

    @PreAuthorize("@auth.allows('email_template.edit')")
    @PostMapping("")
    public ResponseEntity<?> create(@RequestBody EmailTemplateForm form) {
        try {
            return ResponseEntity.ok(templateService.create(form, currentUserId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(error(e.getMessage()));
        }
    }

    @PreAuthorize("@auth.allows('email_template.edit')")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody EmailTemplateForm form) {
        try {
            Map<String, Object> dto = templateService.update(id, form, currentUserId());
            if (dto == null) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(error(e.getMessage()));
        }
    }

    @PreAuthorize("@auth.allows('email_template.edit')")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        boolean removed = templateService.delete(id);
        if (!removed) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(success("Deleted"));
    }

    /** Render a (possibly unsaved) template with sample values for the live preview. */
    @PreAuthorize("@auth.allows('email_template.read')")
    @PostMapping("/preview")
    public ResponseEntity<?> preview(@RequestBody EmailTemplateForm form) {
        return ResponseEntity.ok(templateService.preview(form));
    }

    @PreAuthorize("@auth.allows('email_template.edit')")
    @PostMapping("/{id}/test")
    public ResponseEntity<?> test(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String to = body.get("to") == null ? null : String.valueOf(body.get("to"));
        EmailSendResult result = templateService.sendTest(id, to);
        if (result == null) {
            return ResponseEntity.notFound().build();
        }
        Map<String, Object> out = new HashMap<>();
        out.put("success", result.isSuccess());
        out.put("status", result.getStatus() != null ? result.getStatus().name() : null);
        out.put("error", result.getError());
        out.put("logId", result.getLogId());
        return ResponseEntity.ok(out);
    }

    private Long currentUserId() {
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

    private Map<String, Object> error(String message) {
        Map<String, Object> m = new HashMap<>();
        m.put("error", message);
        return m;
    }

    private Map<String, Object> success(String message) {
        Map<String, Object> m = new HashMap<>();
        m.put("message", message);
        return m;
    }
}
