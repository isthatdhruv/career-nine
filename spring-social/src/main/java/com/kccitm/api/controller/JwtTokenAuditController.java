package com.kccitm.api.controller;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.JwtTokenAudit;
import com.kccitm.api.model.JwtTokenAudit.TokenType;
import com.kccitm.api.repository.JwtTokenAuditRepository;
import com.kccitm.api.security.JwtTokenAuditService;
import com.kccitm.api.security.UserPrincipal;

/**
 * Super-admin JWT audit console.
 *
 * <p>Every endpoint here is restricted to super-admins via
 * {@code @PreAuthorize("principal.superAdmin")} — there is no permission-code
 * path. This is deliberate: a regular admin role with a granted permission
 * could otherwise be social-engineered into revoking sessions of arbitrary
 * users. The audit log lists every token in the system; that visibility is a
 * super-admin-only capability.
 *
 * <p>API surface:
 * <ul>
 *   <li>{@code GET /admin/jwt-tokens} — paginated list with filters</li>
 *   <li>{@code GET /admin/jwt-tokens/{jti}} — single token detail</li>
 *   <li>{@code POST /admin/jwt-tokens/{jti}/revoke} — force-revoke one token</li>
 *   <li>{@code POST /admin/jwt-tokens/users/{userId}/revoke-all} — revoke all
 *       live tokens for a user (force-logout)</li>
 *   <li>{@code GET /admin/jwt-tokens/stats} — counts by status / type</li>
 * </ul>
 */
@RestController
@RequestMapping("/admin/jwt-tokens")
public class JwtTokenAuditController {

    @Autowired
    private JwtTokenAuditRepository repo;

    @Autowired
    private JwtTokenAuditService auditService;

    /**
     * Paginated, filtered listing. Filters are mutually combinable. Status
     * filters ({@code live}, {@code revoked}, {@code expired}) are mutually
     * exclusive — the first one set wins.
     *
     * <p>Default page size 25, max 200 (defensive cap so a misconfigured client
     * cannot ask for the entire table).
     */
    @GetMapping
    @PreAuthorize("principal.superAdmin")
    public ResponseEntity<?> list(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String tokenType,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {

        TokenType type = parseTokenType(tokenType);
        boolean onlyLive = "live".equalsIgnoreCase(status);
        boolean onlyRevoked = "revoked".equalsIgnoreCase(status);
        boolean onlyExpired = "expired".equalsIgnoreCase(status);

        int safeSize = Math.min(Math.max(size, 1), 200);
        int safePage = Math.max(page, 0);
        Pageable pageable = PageRequest.of(safePage, safeSize);

        Page<JwtTokenAudit> result = repo.search(userId, type, email,
                onlyLive, onlyRevoked, onlyExpired, LocalDateTime.now(), pageable);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("content", result.getContent());
        body.put("page", result.getNumber());
        body.put("size", result.getSize());
        body.put("totalElements", result.getTotalElements());
        body.put("totalPages", result.getTotalPages());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/{jti}")
    @PreAuthorize("principal.superAdmin")
    public ResponseEntity<?> get(@PathVariable String jti) {
        return repo.findByJti(jti)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Revoke a single token. Body shape: {@code {"reason": "..."}} — reason is
     * required so the audit row carries an explanation. Returns 404 if the jti
     * is unknown, 409 if already revoked.
     */
    @PostMapping("/{jti}/revoke")
    @PreAuthorize("principal.superAdmin")
    public ResponseEntity<?> revoke(@PathVariable String jti,
                                    @RequestBody(required = false) RevokeRequest body,
                                    @AuthenticationPrincipal UserPrincipal admin) {
        JwtTokenAudit row = repo.findByJti(jti).orElse(null);
        if (row == null) {
            return ResponseEntity.notFound().build();
        }
        if (row.getRevokedAt() != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "Token already revoked",
                                 "revokedAt", row.getRevokedAt().toString()));
        }
        String reason = (body != null && body.reason != null && !body.reason.isEmpty())
                ? body.reason : "Force-revoked by admin";
        Long adminId = admin == null ? null : admin.getId();
        auditService.revoke(jti, adminId, reason);
        return ResponseEntity.ok(Map.of("jti", jti, "revoked", true, "reason", reason));
    }

    /**
     * Revoke every live token for a user — the "force logout from all devices"
     * action. Returns the number of audit rows revoked.
     */
    @PostMapping("/users/{userId}/revoke-all")
    @PreAuthorize("principal.superAdmin")
    public ResponseEntity<?> revokeAllForUser(@PathVariable Long userId,
                                              @RequestBody(required = false) RevokeRequest body,
                                              @AuthenticationPrincipal UserPrincipal admin) {
        String reason = (body != null && body.reason != null && !body.reason.isEmpty())
                ? body.reason : "Admin force-logout-all";
        Long adminId = admin == null ? null : admin.getId();
        int revoked = auditService.revokeAllForUser(userId, adminId, reason);
        return ResponseEntity.ok(Map.of("userId", userId, "revokedCount", revoked, "reason", reason));
    }

    /**
     * Aggregated counts for the console summary cards: total / live / revoked /
     * expired, plus per-type breakdown.
     */
    @GetMapping("/stats")
    @PreAuthorize("principal.superAdmin")
    public ResponseEntity<?> stats() {
        LocalDateTime now = LocalDateTime.now();
        long total = repo.count();
        long live = repo.countByRevokedAtIsNullAndExpiresAtAfter(now);
        long revoked = repo.countByRevokedAtIsNotNull();
        long expired = Math.max(total - live - revoked, 0);

        Map<String, Object> byType = new LinkedHashMap<>();
        for (TokenType t : TokenType.values()) {
            byType.put(t.name(), repo.countByTokenType(t));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", total);
        out.put("live", live);
        out.put("revoked", revoked);
        out.put("expired", expired);
        out.put("byType", byType);
        return ResponseEntity.ok(out);
    }

    private static TokenType parseTokenType(String raw) {
        if (raw == null || raw.isEmpty()) return null;
        try {
            return TokenType.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    public static class RevokeRequest {
        public String reason;
    }
}
