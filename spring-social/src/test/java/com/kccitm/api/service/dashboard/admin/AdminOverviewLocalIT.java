package com.kccitm.api.service.dashboard.admin;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.kccitm.api.security.access.AccessScope;

/**
 * Manual integration check against the local dev database: runs every admin
 * overview card through the real async service (so the JPQL, the scope
 * predicate and the executor wiring are all exercised) and prints the numbers,
 * then opens every card's drill-down and checks the row count agrees with the
 * card. Run explicitly with:
 *
 * <pre>mvnw test -Dtest=AdminOverviewLocalIT -Dadminoverview.it=true</pre>
 */
@SpringBootTest
@ActiveProfiles("dev")
@EnabledIfSystemProperty(named = "adminoverview.it", matches = "true")
class AdminOverviewLocalIT {

    @Autowired
    private AdminOverviewService service;

    @Autowired
    private AdminOverviewDetailService detailService;

    private Map<String, Function<AdminOverviewFilter, CompletableFuture<AdminOverviewCard>>> cards() {
        Map<String, Function<AdminOverviewFilter, CompletableFuture<AdminOverviewCard>>> m = new LinkedHashMap<>();
        m.put(AdminOverviewService.SIGNUPS, service::signups);
        m.put(AdminOverviewService.ASSESSMENTS_CONDUCTED, service::assessmentsConducted);
        m.put(AdminOverviewService.ASSESSMENTS_COMPLETED, service::assessmentsCompleted);
        m.put(AdminOverviewService.ASSESSMENTS_IN_PROGRESS, service::assessmentsInProgress);
        m.put(AdminOverviewService.ASSESSMENTS_NOT_STARTED, service::assessmentsNotStarted);
        m.put(AdminOverviewService.REPORTS_GENERATED, service::reportsGenerated);
        m.put(AdminOverviewService.COUNSELLING_BOOKED, service::counsellingBooked);
        m.put(AdminOverviewService.COUNSELLING_SESSIONS, service::counsellingSessions);
        m.put(AdminOverviewService.COUNSELLING_COMPLETED, service::counsellingCompleted);
        m.put(AdminOverviewService.STUDENTS_ABSENT, service::studentsAbsent);
        m.put(AdminOverviewService.COUNSELLORS_ABSENT, service::counsellorsAbsent);
        m.put(AdminOverviewService.PAYMENTS_COMPLETED, service::paymentsCompleted);
        m.put(AdminOverviewService.WEBSITE_REGISTRATIONS, service::websiteRegistrations);
        return m;
    }

    private List<AdminOverviewCard> runAll(String label, AdminOverviewFilter f) {
        long t0 = System.nanoTime();
        List<CompletableFuture<AdminOverviewCard>> futures = new ArrayList<>();
        for (Function<AdminOverviewFilter, CompletableFuture<AdminOverviewCard>> fn : cards().values()) {
            futures.add(fn.apply(f));
        }
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        List<AdminOverviewCard> out = new ArrayList<>();
        System.out.println("=== " + label + " (wall " + (System.nanoTime() - t0) / 1_000_000 + " ms) ===");
        for (CompletableFuture<AdminOverviewCard> cf : futures) {
            AdminOverviewCard c = cf.join();
            assertNotNull(c.getKey());
            assertTrue(c.getThread().startsWith("dashboard-"), "expected dashboard pool thread, got " + c.getThread());
            System.out.printf("  %-28s %8d  %-14s %4d ms  extra=%s  [%s]%n",
                    c.getKey(), c.getValue(), c.getThread(), c.getTookMs(), c.getExtra(), c.getBasis());
            out.add(c);
        }
        assertEquals(13, out.size());
        return out;
    }

    /**
     * Opens every card's drill-down (first page) in parallel and checks that the
     * list total matches the card's headline number, except where the card is a
     * DISTINCT count over rows (conducted = distinct assessments, reports =
     * distinct students) — there the list is the underlying rows, so it may be larger.
     */
    private void drillAll(String label, AdminOverviewFilter f, List<AdminOverviewCard> cards) {
        long t0 = System.nanoTime();
        Map<String, CompletableFuture<AdminOverviewDetail>> futures = new LinkedHashMap<>();
        for (AdminOverviewCard c : cards) {
            futures.put(c.getKey(), detailService.students(c.getKey(), f, null, 0, 20));
        }
        CompletableFuture.allOf(futures.values().toArray(new CompletableFuture[0])).join();
        System.out.println("=== drill-down: " + label + " (wall " + (System.nanoTime() - t0) / 1_000_000 + " ms) ===");
        for (AdminOverviewCard c : cards) {
            AdminOverviewDetail d = futures.get(c.getKey()).join();
            assertEquals(c.getKey(), d.getKey());
            assertTrue(d.getThread().startsWith("dashboard-"), "expected dashboard pool thread, got " + d.getThread());
            assertTrue(d.getRows().size() <= 20);
            assertTrue(d.getRows().size() <= d.getTotal());
            boolean distinctCard = c.getKey().equals(AdminOverviewService.ASSESSMENTS_CONDUCTED)
                    || c.getKey().equals(AdminOverviewService.REPORTS_GENERATED);
            if (!distinctCard) {
                assertEquals(c.getValue(), d.getTotal(), "card vs list total for " + c.getKey());
            } else {
                assertTrue(d.getTotal() >= c.getValue(), "list total should cover the distinct count for " + c.getKey());
            }
            Object sample = d.getRows().isEmpty() ? "-" : d.getRows().get(0);
            System.out.printf("  %-28s total=%-6d rows=%-3d cols=%-2d %4d ms  first=%s%n",
                    d.getKey(), d.getTotal(), d.getRows().size(), d.getColumns().size(), d.getTookMs(), sample);
        }
    }

    @Test
    void superAdminAllTime() {
        AdminOverviewFilter f = new AdminOverviewFilter(null, null, null, Collections.<Long>emptySet(), Optional.<AccessScope>empty());
        drillAll("super-admin / all time", f, runAll("super-admin / all time", f));
    }

    @Test
    void superAdminLast30Days() {
        LocalDate to = LocalDate.now();
        AdminOverviewFilter f = new AdminOverviewFilter(to.minusDays(29), to, null, Collections.<Long>emptySet(), Optional.<AccessScope>empty());
        drillAll("super-admin / last 30 days", f, runAll("super-admin / last 30 days", f));
    }

    @Test
    void superAdminInstituteAndAssessmentFilter() {
        Integer instituteCode = Integer.getInteger("adminoverview.institute", 1);
        Long assessmentId = Long.getLong("adminoverview.assessment", 1L);
        LocalDate to = LocalDate.now();
        AdminOverviewFilter f = new AdminOverviewFilter(to.minusDays(89), to, instituteCode,
                new HashSet<>(Arrays.asList(assessmentId)), Optional.<AccessScope>empty());
        String label = "super-admin / institute " + instituteCode + " / assessment " + assessmentId + " / last 90 days";
        drillAll(label, f, runAll(label, f));
    }

    @Test
    void scopedViewerWithRules() {
        Integer instituteCode = Integer.getInteger("adminoverview.institute", 1);
        AccessScope scope = new AccessScope(
                new HashSet<>(Arrays.asList(instituteCode)),
                Arrays.asList(new AccessScope.Rule(instituteCode, 1, null, null)));
        AdminOverviewFilter f = new AdminOverviewFilter(null, null, null, Collections.<Long>emptySet(), Optional.of(scope));
        String label = "scoped viewer / institute " + instituteCode + " session 1 / all time";
        drillAll(label, f, runAll(label, f));
    }

    @Test
    void deniedViewerIsAllZero() {
        AdminOverviewFilter f = new AdminOverviewFilter(null, null, null, Collections.<Long>emptySet(), Optional.of(AccessScope.empty()));
        List<AdminOverviewCard> cards = runAll("denied viewer", f);
        for (AdminOverviewCard c : cards) {
            assertEquals(0L, c.getValue(), c.getKey());
        }
        drillAll("denied viewer", f, cards);
    }

    @Test
    void searchNarrowsTheList() {
        AdminOverviewFilter f = new AdminOverviewFilter(null, null, null, Collections.<Long>emptySet(), Optional.<AccessScope>empty());
        AdminOverviewDetail all = detailService.students(AdminOverviewService.SIGNUPS, f, null, 0, 5).join();
        AdminOverviewDetail none = detailService.students(AdminOverviewService.SIGNUPS, f, "zzz-no-such-student-zzz", 0, 5).join();
        assertEquals(0L, none.getTotal());
        assertTrue(none.getRows().isEmpty());
        if (!all.getRows().isEmpty() && all.getRows().get(0).get("email") != null) {
            String email = String.valueOf(all.getRows().get(0).get("email"));
            AdminOverviewDetail one = detailService.students(AdminOverviewService.SIGNUPS, f, email, 0, 5).join();
            assertTrue(one.getTotal() >= 1, "search by email should find the student");
            System.out.println("=== search '" + email + "' -> " + one.getTotal() + " row(s) ===");
        }
    }
}
