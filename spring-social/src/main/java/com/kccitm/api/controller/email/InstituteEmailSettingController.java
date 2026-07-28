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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.email.InstituteEmailSettingService;

/**
 * Per-institute default sending-account mapping (Phase 2). Backs both the Email Accounts
 * "institute defaults" section and the default-email control inside the institute editor.
 * Reuses the {@code email_account} permissions — no new permission code.
 */
@RestController
@RequestMapping("/institute-email-settings")
public class InstituteEmailSettingController {

    @Autowired
    private InstituteEmailSettingService settingService;

    @PreAuthorize("@auth.allows('email_account.read')")
    @GetMapping("")
    public ResponseEntity<?> list() {
        return ResponseEntity.ok(settingService.list());
    }

    @PreAuthorize("@auth.allows('email_account.read')")
    @GetMapping("/{instituteCode}")
    public ResponseEntity<?> get(@PathVariable Integer instituteCode) {
        Map<String, Object> dto = settingService.getByInstitute(instituteCode);
        if (dto == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(dto);
    }

    /** Upsert the default account for an institute. {@code defaultAccountId} null clears it. */
    @PreAuthorize("@auth.allows('email_account.edit')")
    @PutMapping("/{instituteCode}")
    public ResponseEntity<?> setDefault(@PathVariable Integer instituteCode,
                                        @RequestBody Map<String, Object> body) {
        try {
            Long accountId = body.get("defaultAccountId") == null
                    ? null
                    : Long.valueOf(String.valueOf(body.get("defaultAccountId")));
            return ResponseEntity.ok(settingService.setDefault(instituteCode, accountId, currentUserId()));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(error("defaultAccountId must be numeric"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(error(e.getMessage()));
        }
    }

    @PreAuthorize("@auth.allows('email_account.edit')")
    @DeleteMapping("/{instituteCode}")
    public ResponseEntity<?> clear(@PathVariable Integer instituteCode) {
        boolean removed = settingService.clear(instituteCode);
        if (!removed) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(success("Cleared"));
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
