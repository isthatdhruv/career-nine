package com.kccitm.api.service.dashboard.admin;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * One page of the students behind an admin overview card — the response body of
 * {@code GET /dashboard/admin/overview/<card>/students}.
 *
 * <p>{@code columns} tells the UI which keys of each row to show and in what
 * order, so the modal can render every card generically. {@code total} is the
 * row count under the same filters (plus the free-text search), which is what
 * the pagination is based on.
 */
public class AdminOverviewDetail {

    /** A column the UI should render: the row key and its header label. */
    public static class Column {
        private String key;
        private String label;

        public Column() {}

        public Column(String key, String label) {
            this.key = key;
            this.label = label;
        }

        public String getKey() { return key; }
        public String getLabel() { return label; }
        public void setKey(String key) { this.key = key; }
        public void setLabel(String label) { this.label = label; }
    }

    private String key;
    private String title;
    private long total;
    private int page;
    private int size;
    private String search;
    private List<Column> columns = new ArrayList<>();
    private List<Map<String, Object>> rows = new ArrayList<>();
    private String computedAt = Instant.now().toString();
    private long tookMs;
    private String thread;

    public AdminOverviewDetail() {}

    public static AdminOverviewDetail of(String key, String title, long total, int page, int size,
                                         String search, List<Column> columns,
                                         List<Map<String, Object>> rows, long startedNanos) {
        AdminOverviewDetail d = new AdminOverviewDetail();
        d.key = key;
        d.title = title;
        d.total = total;
        d.page = page;
        d.size = size;
        d.search = search;
        d.columns = columns;
        d.rows = rows;
        d.tookMs = (System.nanoTime() - startedNanos) / 1_000_000L;
        d.thread = Thread.currentThread().getName();
        return d;
    }

    /** Convenience for building a row in insertion order. */
    public static Map<String, Object> row() {
        return new LinkedHashMap<>();
    }

    public String getKey() { return key; }
    public String getTitle() { return title; }
    public long getTotal() { return total; }
    public int getPage() { return page; }
    public int getSize() { return size; }
    public String getSearch() { return search; }
    public List<Column> getColumns() { return columns; }
    public List<Map<String, Object>> getRows() { return rows; }
    public String getComputedAt() { return computedAt; }
    public long getTookMs() { return tookMs; }
    public String getThread() { return thread; }

    public void setKey(String key) { this.key = key; }
    public void setTitle(String title) { this.title = title; }
    public void setTotal(long total) { this.total = total; }
    public void setPage(int page) { this.page = page; }
    public void setSize(int size) { this.size = size; }
    public void setSearch(String search) { this.search = search; }
    public void setColumns(List<Column> columns) { this.columns = columns; }
    public void setRows(List<Map<String, Object>> rows) { this.rows = rows; }
    public void setComputedAt(String computedAt) { this.computedAt = computedAt; }
    public void setTookMs(long tookMs) { this.tookMs = tookMs; }
    public void setThread(String thread) { this.thread = thread; }
}
