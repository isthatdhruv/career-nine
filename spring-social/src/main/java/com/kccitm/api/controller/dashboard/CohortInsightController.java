package com.kccitm.api.controller.dashboard;

import java.util.Collections;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.service.dashboard.cohort.CohortInsightGenerationService;
import com.kccitm.api.service.dashboard.cohort.CohortInsightView;

@RestController
@RequestMapping("/dashboard/cohort-insights")
public class CohortInsightController {

    private final CohortInsightGenerationService service;

    public CohortInsightController(CohortInsightGenerationService service) {
        this.service = service;
    }

    /**
     * Superadmin-only. Enqueues async generation; returns 202 immediately.
     * instituteCode is Integer here to bind the @auth scope; converted to Long for the service.
     */
    @PostMapping("/{instituteCode}/{assessmentId}/generate")
    @PreAuthorize("@auth.allows('dashboard.school.insights.generate')")
    public ResponseEntity<?> generate(@PathVariable Integer instituteCode,
                                      @PathVariable Long assessmentId) {
        Long inst = instituteCode.longValue();
        Long currentUserId = currentUserIdOrNull();
        boolean enqueued = service.markPending(inst, assessmentId, currentUserId);
        if (enqueued) {
            service.runGenerationAsync(inst, assessmentId);
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(Collections.singletonMap("enqueued", enqueued));
    }

    /** School-admin read, scoped to their institute via @auth. */
    @GetMapping("/{instituteCode}/{assessmentId}")
    @PreAuthorize("@auth.allows('dashboard.school.insights.read', #instituteCode)")
    public ResponseEntity<CohortInsightView> get(@PathVariable Integer instituteCode,
                                                 @PathVariable Long assessmentId) {
        return ResponseEntity.ok(service.getView(instituteCode.longValue(), assessmentId));
    }

    private Long currentUserIdOrNull() {
        // Generation does not depend on the actor id (it is recorded for audit only).
        // null is acceptable for the audit stamp; wire the authenticated principal id here
        // if audit attribution is desired later.
        return null;
    }
}
