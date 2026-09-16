package com.kccitm.api.controller.dashboard;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.kccitm.api.security.access.AccessScope;
import com.kccitm.api.security.access.AccessScopeService;
import com.kccitm.api.service.dashboard.admin.AdminOverviewCard;
import com.kccitm.api.service.dashboard.admin.AdminOverviewDetail;
import com.kccitm.api.service.dashboard.admin.AdminOverviewDetailService;
import com.kccitm.api.service.dashboard.admin.AdminOverviewFilter;
import com.kccitm.api.service.dashboard.admin.AdminOverviewService;

/**
 * Admin overview dashboard — the card strip under the date-range / view filters on
 * {@code /dashboard}. One endpoint per card, so the browser fires them all at once
 * and paints each card the moment its own number lands.
 *
 * <p>Every handler returns a {@link CompletableFuture}: Spring MVC switches the
 * request to async mode, the servlet thread goes back to the pool, and the count
 * runs on the {@code dashboardExecutor} thread that the {@link AdminOverviewService}
 * method was dispatched to. The response is written when that future completes.
 *
 * <p>Common query parameters (all optional):
 * <ul>
 *   <li>{@code from}, {@code to} — ISO dates (inclusive). Omit both for "all time".</li>
 *   <li>{@code instituteCode} — comma-separated institute codes; rows at any of them.</li>
 *   <li>{@code assessmentIds} — comma-separated assessment ids.</li>
 * </ul>
 * The caller's ABAC scope is resolved <em>here</em>, on the request thread, and
 * handed to the service inside the filter — the security context does not travel
 * to the executor threads.
 */
@RestController
@RequestMapping("/dashboard/admin/overview")
public class AdminOverviewController {

    @Autowired
    private AdminOverviewService service;

    @Autowired
    private AccessScopeService accessScopeService;

    @Autowired
    private AdminOverviewDetailService detailService;

    // ─── Registrations ───────────────────────────────────────────────────

    @PreAuthorize("@auth.allows('dashboard.admin.read')")
    @GetMapping("/signups")
    public CompletableFuture<AdminOverviewCard> signups(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String instituteCode,
            @RequestParam(required = false) String assessmentIds) {
        return service.signups(filter(from, to, instituteCode, assessmentIds));
    }

    // ─── Assessments ─────────────────────────────────────────────────────

    @PreAuthorize("@auth.allows('dashboard.admin.read')")
    @GetMapping("/active-assessments")
    public CompletableFuture<AdminOverviewCard> activeAssessments(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String instituteCode,
            @RequestParam(required = false) String assessmentIds) {
        return service.activeAssessments(filter(from, to, instituteCode, assessmentIds));
    }

    @PreAuthorize("@auth.allows('dashboard.admin.read')")
    @GetMapping("/assessments-completed")
    public CompletableFuture<AdminOverviewCard> assessmentsCompleted(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String instituteCode,
            @RequestParam(required = false) String assessmentIds) {
        return service.assessmentsCompleted(filter(from, to, instituteCode, assessmentIds));
    }

    @PreAuthorize("@auth.allows('dashboard.admin.read')")
    @GetMapping("/assessments-in-progress")
    public CompletableFuture<AdminOverviewCard> assessmentsInProgress(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String instituteCode,
            @RequestParam(required = false) String assessmentIds) {
        return service.assessmentsInProgress(filter(from, to, instituteCode, assessmentIds));
    }

    @PreAuthorize("@auth.allows('dashboard.admin.read')")
    @GetMapping("/assessments-not-started")
    public CompletableFuture<AdminOverviewCard> assessmentsNotStarted(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String instituteCode,
            @RequestParam(required = false) String assessmentIds) {
        return service.assessmentsNotStarted(filter(from, to, instituteCode, assessmentIds));
    }

    // ─── Reports ─────────────────────────────────────────────────────────

    @PreAuthorize("@auth.allows('dashboard.admin.read')")
    @GetMapping("/reports-generated")
    public CompletableFuture<AdminOverviewCard> reportsGenerated(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String instituteCode,
            @RequestParam(required = false) String assessmentIds) {
        return service.reportsGenerated(filter(from, to, instituteCode, assessmentIds));
    }

    // ─── Counselling ─────────────────────────────────────────────────────

    @PreAuthorize("@auth.allows('dashboard.admin.read')")
    @GetMapping("/counselling-booked")
    public CompletableFuture<AdminOverviewCard> counsellingBooked(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String instituteCode,
            @RequestParam(required = false) String assessmentIds) {
        return service.counsellingBooked(filter(from, to, instituteCode, assessmentIds));
    }

    @PreAuthorize("@auth.allows('dashboard.admin.read')")
    @GetMapping("/counselling-sessions")
    public CompletableFuture<AdminOverviewCard> counsellingSessions(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String instituteCode,
            @RequestParam(required = false) String assessmentIds) {
        return service.counsellingSessions(filter(from, to, instituteCode, assessmentIds));
    }

    @PreAuthorize("@auth.allows('dashboard.admin.read')")
    @GetMapping("/counselling-completed")
    public CompletableFuture<AdminOverviewCard> counsellingCompleted(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String instituteCode,
            @RequestParam(required = false) String assessmentIds) {
        return service.counsellingCompleted(filter(from, to, instituteCode, assessmentIds));
    }

    @PreAuthorize("@auth.allows('dashboard.admin.read')")
    @GetMapping("/students-absent")
    public CompletableFuture<AdminOverviewCard> studentsAbsent(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String instituteCode,
            @RequestParam(required = false) String assessmentIds) {
        return service.studentsAbsent(filter(from, to, instituteCode, assessmentIds));
    }

    @PreAuthorize("@auth.allows('dashboard.admin.read')")
    @GetMapping("/counsellors-absent")
    public CompletableFuture<AdminOverviewCard> counsellorsAbsent(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String instituteCode,
            @RequestParam(required = false) String assessmentIds) {
        return service.counsellorsAbsent(filter(from, to, instituteCode, assessmentIds));
    }

    // ─── Payments ────────────────────────────────────────────────────────

    @PreAuthorize("@auth.allows('dashboard.admin.read')")
    @GetMapping("/payments-completed")
    public CompletableFuture<AdminOverviewCard> paymentsCompleted(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String instituteCode,
            @RequestParam(required = false) String assessmentIds) {
        return service.paymentsCompleted(filter(from, to, instituteCode, assessmentIds));
    }

    // ─── Website ─────────────────────────────────────────────────────────

    @PreAuthorize("@auth.allows('dashboard.admin.read')")
    @GetMapping("/website-registrations")
    public CompletableFuture<AdminOverviewCard> websiteRegistrations(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String instituteCode,
            @RequestParam(required = false) String assessmentIds) {
        return service.websiteRegistrations(filter(from, to, instituteCode, assessmentIds));
    }

    // ─── Drill-down: the students behind a card ──────────────────────────

    /**
     * One page of the students that make up card {@code key}, under the same
     * filters the card was counted with, plus an optional free-text {@code q}
     * (name / email / roll number). {@code page} is zero-based; {@code size}
     * defaults to 50 and is capped at 5000. Unknown keys are 404.
     */
    @PreAuthorize("@auth.allows('dashboard.admin.read')")
    @GetMapping("/{key}/students")
    public CompletableFuture<AdminOverviewDetail> students(
            @PathVariable String key,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String instituteCode,
            @RequestParam(required = false) String assessmentIds,
            @RequestParam(required = false) String q,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "50") int size) {
        try {
            return detailService.students(key, filter(from, to, instituteCode, assessmentIds), q, page, size);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    // ─── Fan-out ─────────────────────────────────────────────────────────

    /**
     * Every card in one round trip. All eleven jobs are submitted to the pool up
     * front and run in parallel; the response is assembled once the last one lands
     * ({@link CompletableFuture#allOf}). Handy for scripts and for clients that
     * would rather not open eleven connections; the dashboard itself calls the
     * per-card endpoints so each tile can paint independently.
     */
    @PreAuthorize("@auth.allows('dashboard.admin.read')")
    @GetMapping("/all")
    public CompletableFuture<Map<String, AdminOverviewCard>> all(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String instituteCode,
            @RequestParam(required = false) String assessmentIds) {
        AdminOverviewFilter f = filter(from, to, instituteCode, assessmentIds);
        final long started = System.nanoTime();

        CompletableFuture<AdminOverviewCard>[] jobs = new CompletableFuture[] {
                service.signups(f),
                service.activeAssessments(f),
                service.assessmentsCompleted(f),
                service.assessmentsInProgress(f),
                service.assessmentsNotStarted(f),
                service.reportsGenerated(f),
                service.counsellingBooked(f),
                service.counsellingSessions(f),
                service.counsellingCompleted(f),
                service.studentsAbsent(f),
                service.counsellorsAbsent(f),
                service.paymentsCompleted(f),
                service.websiteRegistrations(f),
        };

        return CompletableFuture.allOf(jobs).thenApply(v -> {
            Map<String, AdminOverviewCard> out = new LinkedHashMap<>();
            for (CompletableFuture<AdminOverviewCard> job : jobs) {
                AdminOverviewCard card = job.join();
                out.put(card.getKey(), card);
            }
            AdminOverviewCard meta = new AdminOverviewCard();
            meta.setKey("_meta");
            meta.setValue(jobs.length);
            meta.setFrom(f.getFrom());
            meta.setTo(f.getTo());
            meta.setBasis("cards computed in parallel on the dashboard pool");
            meta.setComputedAt(java.time.Instant.now().toString());
            meta.setTookMs((System.nanoTime() - started) / 1_000_000L);
            meta.setThread(Thread.currentThread().getName());
            out.put("_meta", meta);
            return out;
        });
    }

    // ─── Request → filter ────────────────────────────────────────────────

    private AdminOverviewFilter filter(String from, String to, String instituteCode, String assessmentIds) {
        LocalDate f = parseDate(from, "from");
        LocalDate t = parseDate(to, "to");
        if ((f == null) != (t == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from and to must be given together");
        }
        if (f != null && t.isBefore(f)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "to must not be before from");
        }
        Set<Integer> codes = new LinkedHashSet<>();
        if (instituteCode != null) {
            for (String part : instituteCode.split(",")) {
                String s = part.trim();
                if (s.isEmpty()) continue;
                try {
                    codes.add(Integer.parseInt(s));
                } catch (NumberFormatException e) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "instituteCode must be numeric: " + s);
                }
            }
        }
        Set<Long> ids = new LinkedHashSet<>();
        if (assessmentIds != null) {
            for (String part : assessmentIds.split(",")) {
                String s = part.trim();
                if (s.isEmpty()) continue;
                try {
                    ids.add(Long.parseLong(s));
                } catch (NumberFormatException e) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "assessmentIds must be numeric: " + s);
                }
            }
        }
        // Resolved on the request thread on purpose — see class javadoc.
        Optional<AccessScope> scope = accessScopeService.forCurrentUser();
        return new AdminOverviewFilter(f, t, codes, ids, scope);
    }

    private static LocalDate parseDate(String raw, String name) {
        if (raw == null || raw.trim().isEmpty()) return null;
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, name + " must be an ISO date (yyyy-MM-dd)");
        }
    }
}
