package com.kccitm.api.service.b2c.pager;

/** Stanine-derived bucket. Spec §4.2. */
public enum AbsoluteLevel {
    HIGH, MODERATE, LOW;

    /** Stanine ≥7 → HIGH, ≥3 → MODERATE, else LOW. */
    public static AbsoluteLevel fromStanine(int stanine) {
        if (stanine >= 7) return HIGH;
        if (stanine >= 3) return MODERATE;
        return LOW;
    }
}
