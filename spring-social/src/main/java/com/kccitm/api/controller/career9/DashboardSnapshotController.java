package com.kccitm.api.controller.career9;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.service.career9.DashboardSnapshotService;

@RestController
@RequestMapping("/dashboard")
public class DashboardSnapshotController {

    @Autowired
    private DashboardSnapshotService dashboardSnapshotService;

    @GetMapping("/admin/snapshot")
    public ResponseEntity<Map<String, Object>> getAdminSnapshot() {
        Map<String, Object> payload = dashboardSnapshotService.getOrCompute(
                DashboardSnapshotService.ADMIN_DASHBOARD_KEY, false);
        return ResponseEntity.ok(payload);
    }

    @PostMapping("/admin/snapshot/refresh")
    public ResponseEntity<Map<String, Object>> refreshAdminSnapshot() {
        Map<String, Object> payload = dashboardSnapshotService.getOrCompute(
                DashboardSnapshotService.ADMIN_DASHBOARD_KEY, true);
        return ResponseEntity.ok(payload);
    }
}
