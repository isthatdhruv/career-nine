package com.kccitm.api.controller.career9.counselling;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.service.counselling.CounsellingLifecycleService;

/**
 * Manual triggers for the counselling lifecycle sweeps (Counselling Phase 2/3a).
 *
 * <p>The sweeps normally run on cron timers (every 5 min / every 1 min). These endpoints
 * let an admin run them on demand — primarily for testing/QA and ops, so you don't have to
 * wait for the next tick to verify a no-show close or an expired-hold release.
 */
@RestController
@RequestMapping("/api/counselling-lifecycle")
public class CounsellingLifecycleController {

    @Autowired
    private CounsellingLifecycleService lifecycleService;

    @PreAuthorize("@auth.allows('counsellor.update')")
    @PostMapping("/run-session-sweep")
    public ResponseEntity<?> runSessionSweep() {
        lifecycleService.closeEndedSessions();
        return ResponseEntity.ok(Map.of(
                "ran", "closeEndedSessions",
                "note", "Check logs ('Counselling lifecycle sweep') and appointment statuses."));
    }

    @PreAuthorize("@auth.allows('counsellor.update')")
    @PostMapping("/run-hold-sweep")
    public ResponseEntity<?> runHoldSweep() {
        lifecycleService.releaseExpiredHolds();
        return ResponseEntity.ok(Map.of(
                "ran", "releaseExpiredHolds",
                "note", "Check logs ('Counselling hold sweep') and slot statuses."));
    }
}
