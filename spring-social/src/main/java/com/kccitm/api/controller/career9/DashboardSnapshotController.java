package com.kccitm.api.controller.career9;

import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.security.CurrentScopes;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.career9.DashboardSnapshotService;

@RestController
@RequestMapping("/dashboard")
public class DashboardSnapshotController {

    @Autowired
    private DashboardSnapshotService dashboardSnapshotService;

    // Phase 0 (Task 0.2) / audit CRIT-D: both methods previously had NO @PreAuthorize and were
    // not in the coverage-test EXCLUSIONS, so the org-wide admin analytics blob was reachable by
    // ANY authenticated principal and the build-time coverage gate was red. Gated on
    // dashboard.admin.read (read) and dashboard.admin.refresh (the heavier recompute). NOTE:
    // these gates are advisory until auth.enforce-mode flips to `enforce` (Phase 6); scope-aware
    // narrowing of the payload itself is Phase 4.
    @PreAuthorize("@auth.allows('dashboard.admin.read')")
    @GetMapping(value = "/admin/snapshot", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> getAdminSnapshot() {
        byte[] bytes = dashboardSnapshotService.getOrComputeJsonBytes(resolveDashboardKey(), false);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(bytes);
    }

    @PreAuthorize("@auth.allows('dashboard.admin.refresh')")
    @PostMapping(value = "/admin/snapshot/refresh", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> refreshAdminSnapshot() {
        byte[] bytes = dashboardSnapshotService.getOrComputeJsonBytes(resolveDashboardKey(), true);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(bytes);
    }

    /**
     * Phase 4 (Task 4.2): the snapshot is computed in THIS request thread while the per-request
     * Hibernate scopeFilter (ScopeFilterInterceptor, open-session-in-view) is active, so the
     * students/institutes sections already narrow to the caller's scope. The only reason every
     * caller previously saw identical data was the single shared cache key — so we now key the
     * cache by the caller's scope:
     * <ul>
     *   <li>super-admins and full-wildcard callers (whom the interceptor exempts from the filter)
     *       share the org-wide {@code ADMIN_DASHBOARD} blob — unchanged behaviour;</li>
     *   <li>every distinct scope-set gets its own cached, scope-narrowed payload.</li>
     * </ul>
     * <p>LIMITATION (deferred 3.3/3.4): sections backed by entities that are not row-filtered yet
     * (reports, counsellors, appointments, ratingSummary) remain org-wide within a scoped payload.
     */
    private String resolveDashboardKey() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal) {
            UserPrincipal up = (UserPrincipal) auth.getPrincipal();
            if (up.isSuperAdmin() || isFullWildcard(up)) {
                return DashboardSnapshotService.ADMIN_DASHBOARD_KEY;
            }
            return DashboardSnapshotService.ADMIN_DASHBOARD_KEY + ":" + scopeSignature(up);
        }
        return DashboardSnapshotService.ADMIN_DASHBOARD_KEY;
    }

    /** Mirrors ScopeFilterInterceptor: a caller with a wildcard in EVERY dimension sees all rows. */
    private static boolean isFullWildcard(UserPrincipal up) {
        boolean wi = false, ws = false, wc = false, wx = false;
        if (up.getScopes() != null) {
            for (CurrentScopes.ScopeRow r : up.getScopes()) {
                if (r.i == null) wi = true;
                if (r.s == null) ws = true;
                if (r.c == null) wc = true;
                if (r.x == null) wx = true;
            }
        }
        return wi && ws && wc && wx;
    }

    /** Stable, bounded (16-hex) signature of the caller's scope set for use as a cache-key suffix. */
    private static String scopeSignature(UserPrincipal up) {
        List<String> rows = new ArrayList<>();
        if (up.getScopes() != null) {
            for (CurrentScopes.ScopeRow r : up.getScopes()) {
                rows.add((r.i == null ? "*" : r.i) + "_" + (r.s == null ? "*" : r.s)
                        + "_" + (r.c == null ? "*" : r.c) + "_" + (r.x == null ? "*" : r.x));
            }
        }
        Collections.sort(rows);
        String joined = rows.isEmpty() ? "none" : String.join(",", rows);
        String hex = sha256Hex(joined);
        return hex != null ? hex.substring(0, 16) : "none";
    }

    private static String sha256Hex(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(s.getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }
}
