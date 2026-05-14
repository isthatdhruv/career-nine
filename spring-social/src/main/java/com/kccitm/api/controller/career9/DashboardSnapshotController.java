package com.kccitm.api.controller.career9;

import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.security.access.AccessScope;
import com.kccitm.api.security.access.AccessScopeService;
import com.kccitm.api.security.access.DashboardSnapshotFilter;
import com.kccitm.api.service.career9.DashboardSnapshotService;

@RestController
@RequestMapping("/dashboard")
public class DashboardSnapshotController {

    @Autowired
    private DashboardSnapshotService dashboardSnapshotService;

    @Autowired
    private AccessScopeService accessScopeService;

    @Autowired
    private DashboardSnapshotFilter dashboardSnapshotFilter;

    @GetMapping("/admin/snapshot")
    @PreAuthorize("@auth.allows('dashboard_snapshot.read')")
    public ResponseEntity<Map<String, Object>> getAdminSnapshot() {
        Map<String, Object> payload = dashboardSnapshotService.getOrCompute(
                DashboardSnapshotService.ADMIN_DASHBOARD_KEY, false);
        return ResponseEntity.ok(applyAccessScope(payload));
    }

    @PostMapping("/admin/snapshot/refresh")
    @PreAuthorize("@auth.allows('dashboard_snapshot.update')")
    public ResponseEntity<Map<String, Object>> refreshAdminSnapshot() {
        Map<String, Object> payload = dashboardSnapshotService.getOrCompute(
                DashboardSnapshotService.ADMIN_DASHBOARD_KEY, true);
        return ResponseEntity.ok(applyAccessScope(payload));
    }

    /**
     * Trim the (cached, global) snapshot to what the caller's
     * {@link AccessScope} permits. Super-admins (empty Optional) get the raw
     * snapshot — same bypass semantics as {@code AuthorizationService}. Users
     * with no contact-person mappings get an empty scope, which the filter
     * renders as empty institute/student lists (deny-by-default).
     */
    private Map<String, Object> applyAccessScope(Map<String, Object> payload) {
        Optional<AccessScope> scopeOpt = accessScopeService.forCurrentUser();
        if (!scopeOpt.isPresent()) {
            // Super-admin bypass: return the global snapshot unfiltered.
            return payload;
        }
        return dashboardSnapshotFilter.filter(payload, scopeOpt.get());
    }
}
