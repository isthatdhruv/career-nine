package com.kccitm.api.controller.career9;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
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

    @GetMapping(value = "/admin/snapshot", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> getAdminSnapshot() {
        byte[] bytes = dashboardSnapshotService.getOrComputeJsonBytes(
                DashboardSnapshotService.ADMIN_DASHBOARD_KEY, false);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(bytes);
    }

    @PostMapping(value = "/admin/snapshot/refresh", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> refreshAdminSnapshot() {
        byte[] bytes = dashboardSnapshotService.getOrComputeJsonBytes(
                DashboardSnapshotService.ADMIN_DASHBOARD_KEY, true);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(bytes);
    }
}
