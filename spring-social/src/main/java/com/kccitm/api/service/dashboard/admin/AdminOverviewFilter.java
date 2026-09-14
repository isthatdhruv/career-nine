package com.kccitm.api.service.dashboard.admin;

import java.time.LocalDate;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;

import com.kccitm.api.security.access.AccessScope;

/**
 * Immutable filter for one admin-overview card request.
 *
 * <p>Built on the HTTP request thread (see {@code AdminOverviewController}) because
 * it carries the caller's {@link AccessScope}, which is resolved from the Spring
 * {@code SecurityContext} — and that context does <em>not</em> follow the work onto
 * the {@code dashboardExecutor} threads. Everything the async service needs is
 * therefore captured here up front.
 *
 * <ul>
 *   <li>{@code from}/{@code to} — inclusive calendar dates in the app timezone; both
 *       null means "all time".</li>
 *   <li>{@code instituteCode} — optional super-admin view filter.</li>
 *   <li>{@code assessmentIds} — optional super-admin view filter; ignored by the
 *       counselling cards (appointments are not tied to an assessment).</li>
 *   <li>{@code scope} — {@code Optional.empty()} for super-admins (no narrowing);
 *       a present scope narrows every card to the caller's institutes/sessions/
 *       classes/sections; a present-but-empty scope yields zero everywhere.</li>
 * </ul>
 */
public final class AdminOverviewFilter {

    private final LocalDate from;
    private final LocalDate to;
    private final Integer instituteCode;
    private final Set<Long> assessmentIds;
    private final Optional<AccessScope> scope;

    public AdminOverviewFilter(LocalDate from, LocalDate to, Integer instituteCode,
                               Set<Long> assessmentIds, Optional<AccessScope> scope) {
        this.from = from;
        this.to = to;
        this.instituteCode = instituteCode;
        this.assessmentIds = assessmentIds == null || assessmentIds.isEmpty()
                ? Collections.<Long>emptySet()
                : Collections.unmodifiableSet(new LinkedHashSet<>(assessmentIds));
        this.scope = scope == null ? Optional.<AccessScope>empty() : scope;
    }

    public LocalDate getFrom() { return from; }
    public LocalDate getTo() { return to; }
    public Integer getInstituteCode() { return instituteCode; }
    public Set<Long> getAssessmentIds() { return assessmentIds; }
    public Optional<AccessScope> getScope() { return scope; }

    /** True when the caller asked for a bounded window (not "all time"). */
    public boolean hasRange() { return from != null && to != null; }

    public boolean hasInstitute() { return instituteCode != null; }

    public boolean hasAssessments() { return !assessmentIds.isEmpty(); }

    /** Present-but-empty scope: the caller is mapped to nothing — deny by default. */
    public boolean isDenied() { return scope.isPresent() && scope.get().isEmpty(); }

    /** Same institute/assessment/scope filters, but the window pinned to a single day. */
    public AdminOverviewFilter onDay(LocalDate day) {
        return new AdminOverviewFilter(day, day, instituteCode, assessmentIds, scope);
    }
}
