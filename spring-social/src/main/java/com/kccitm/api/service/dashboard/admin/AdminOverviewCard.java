package com.kccitm.api.service.dashboard.admin;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * One card of the admin overview dashboard — the response body of every
 * {@code GET /dashboard/admin/overview/<card>} endpoint.
 *
 * <p>{@code value} is the headline number. {@code extra} holds any secondary
 * numbers the card shows in its caption (e.g. total completions behind a
 * distinct-assessment count). {@code rangeApplied} tells the UI whether the date
 * window actually narrowed this number — some cards are a snapshot of current
 * state (in-progress / not-started carry no timestamp) and some are pinned to
 * "today" regardless of the selected range.
 *
 * <p>{@code thread} and {@code tookMs} are diagnostics: which pool thread computed
 * the card and how long its queries took.
 */
public class AdminOverviewCard {

    private String key;
    private long value;
    private Map<String, Object> extra = new LinkedHashMap<>();
    private LocalDate from;
    private LocalDate to;
    private boolean rangeApplied;
    private String basis;
    private String computedAt;
    private long tookMs;
    private String thread;

    public AdminOverviewCard() {}

    public static AdminOverviewCard of(String key, long value, AdminOverviewFilter f,
                                       boolean rangeApplied, String basis, long startedNanos) {
        AdminOverviewCard c = new AdminOverviewCard();
        c.key = key;
        c.value = value;
        c.from = f.getFrom();
        c.to = f.getTo();
        c.rangeApplied = rangeApplied;
        c.basis = basis;
        c.computedAt = Instant.now().toString();
        c.tookMs = (System.nanoTime() - startedNanos) / 1_000_000L;
        c.thread = Thread.currentThread().getName();
        return c;
    }

    public AdminOverviewCard with(String k, Object v) {
        extra.put(k, v);
        return this;
    }

    public String getKey() { return key; }
    public long getValue() { return value; }
    public Map<String, Object> getExtra() { return extra; }
    public LocalDate getFrom() { return from; }
    public LocalDate getTo() { return to; }
    public boolean isRangeApplied() { return rangeApplied; }
    /** Human-readable note on what the number is based on. */
    public String getBasis() { return basis; }
    public String getComputedAt() { return computedAt; }
    public long getTookMs() { return tookMs; }
    public String getThread() { return thread; }

    public void setKey(String key) { this.key = key; }
    public void setValue(long value) { this.value = value; }
    public void setExtra(Map<String, Object> extra) { this.extra = extra; }
    public void setFrom(LocalDate from) { this.from = from; }
    public void setTo(LocalDate to) { this.to = to; }
    public void setRangeApplied(boolean rangeApplied) { this.rangeApplied = rangeApplied; }
    public void setBasis(String basis) { this.basis = basis; }
    public void setComputedAt(String computedAt) { this.computedAt = computedAt; }
    public void setTookMs(long tookMs) { this.tookMs = tookMs; }
    public void setThread(String thread) { this.thread = thread; }
}
