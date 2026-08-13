package com.kccitm.api.controller.email;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
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

import com.kccitm.api.model.career9.LeadType;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.email.EmailNotificationRecipientService;

/**
 * Admin CRUD for the standing recipient lists that drive automatic notifications —
 * "when a lead arrives, mail these people".
 */
@RestController
@RequestMapping("/email-recipients")
public class EmailNotificationRecipientController {

    @Autowired
    private EmailNotificationRecipientService recipientService;

    @PreAuthorize("@auth.allows('email_recipient.read')")
    @GetMapping("")
    public ResponseEntity<?> list(@RequestParam(required = false) String emailType) {
        return ResponseEntity.ok(recipientService.list(emailType));
    }

    /**
     * The filter vocabulary the editor offers. Served rather than hard-coded in the UI so
     * adding a lead type on the server does not need a matching frontend change.
     */
    @PreAuthorize("@auth.allows('email_recipient.read')")
    @GetMapping("/options")
    public ResponseEntity<?> options() {
        List<Map<String, String>> leadTypes = new ArrayList<>();
        for (LeadType type : LeadType.values()) {
            Map<String, String> m = new LinkedHashMap<>();
            m.put("value", type.name());
            m.put("label", type.name().charAt(0) + type.name().substring(1).toLowerCase());
            leadTypes.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("leadTypes", leadTypes);
        out.put("recipientKinds", List.of("TO", "CC", "BCC"));
        return ResponseEntity.ok(out);
    }

    @PreAuthorize("@auth.allows('email_recipient.edit')")
    @PostMapping("")
    public ResponseEntity<?> create(@RequestBody Map<String, Object> form) {
        try {
            return ResponseEntity.ok(recipientService.create(form, currentUserId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(error(e.getMessage()));
        }
    }

    @PreAuthorize("@auth.allows('email_recipient.edit')")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Map<String, Object> form) {
        try {
            Map<String, Object> dto = recipientService.update(id, form, currentUserId());
            if (dto == null) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(error(e.getMessage()));
        }
    }

    @PreAuthorize("@auth.allows('email_recipient.edit')")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!recipientService.delete(id)) {
            return ResponseEntity.notFound().build();
        }
        Map<String, Object> m = new HashMap<>();
        m.put("message", "Deleted");
        return ResponseEntity.ok(m);
    }

    private Long currentUserId() {
        try {
            Authentication a = SecurityContextHolder.getContext().getAuthentication();
            if (a != null && a.getPrincipal() instanceof UserPrincipal) {
                return ((UserPrincipal) a.getPrincipal()).getId();
            }
        } catch (Exception ignored) {
            // best effort — the column is informational
        }
        return null;
    }

    private Map<String, Object> error(String message) {
        Map<String, Object> m = new HashMap<>();
        m.put("error", message);
        return m;
    }
}
