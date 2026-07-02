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

import com.kccitm.api.model.email.EmailAccountForm;
import com.kccitm.api.model.email.EmailSendResult;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.email.EmailAccountService;

/** Admin CRUD for configurable email accounts (Odoo + Gmail), plus a live test-send. */
@RestController
@RequestMapping("/email-accounts")
public class EmailAccountController {

    @Autowired
    private EmailAccountService accountService;

    @PreAuthorize("@auth.allows('email_account.read')")
    @GetMapping("")
    public ResponseEntity<?> list() {
        return ResponseEntity.ok(accountService.list());
    }

    @PreAuthorize("@auth.allows('email_account.read')")
    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id) {
        Map<String, Object> dto = accountService.get(id);
        if (dto == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(dto);
    }

    @PreAuthorize("@auth.allows('email_account.edit')")
    @PostMapping("")
    public ResponseEntity<?> create(@RequestBody EmailAccountForm form) {
        try {
            return ResponseEntity.ok(accountService.create(form, currentUserId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(error(e.getMessage()));
        }
    }

    @PreAuthorize("@auth.allows('email_account.edit')")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody EmailAccountForm form) {
        try {
            Map<String, Object> dto = accountService.update(id, form, currentUserId());
            if (dto == null) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(error(e.getMessage()));
        }
    }

    @PreAuthorize("@auth.allows('email_account.edit')")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        boolean removed = accountService.delete(id);
        if (!removed) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(success("Deleted"));
    }

    @PreAuthorize("@auth.allows('email_account.test')")
    @PostMapping("/{id}/test")
    public ResponseEntity<?> test(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String to = body.get("to") == null ? null : String.valueOf(body.get("to"));
        EmailSendResult result = accountService.sendTest(id, to);
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

    /** Test credentials BEFORE saving — builds a transient account from the form and sends a test. */
    @PreAuthorize("@auth.allows('email_account.test')")
    @PostMapping("/test-connection")
    public ResponseEntity<?> testConnection(@RequestBody EmailAccountForm form,
                                            @RequestParam(required = false) String to) {
        try {
            EmailSendResult result = accountService.sendTestDraft(form, to);
            Map<String, Object> out = new HashMap<>();
            out.put("success", result.isSuccess());
            out.put("status", result.getStatus() != null ? result.getStatus().name() : null);
            out.put("error", result.getError());
            out.put("logId", result.getLogId());
            return ResponseEntity.ok(out);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(error(e.getMessage()));
        }
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
