package com.kccitm.api.service.b2c.navigatorpro;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Scorer output. Indices are 0–100 doubles, rounded only at display time. */
public final class NavigatorProScores {

    /** f_id, f_st, f_ae, drive (Will), foundation, skill, fs_*, d_*, fam_* → 0–100. */
    public final Map<String, Double> index = new LinkedHashMap<>();
    /** Raw construct sums (Σ of stored marks), for the raw export. */
    public final Map<String, Integer> sums = new LinkedHashMap<>();
    /** chk_* → correct. */
    public final Map<String, Boolean> checks = new LinkedHashMap<>();
    public int reasoning;

    public String topFamily;
    public String secondFamily;
    /** Top family − second family &lt; flat-gap: "tied" interest shape (copy selection only). */
    public boolean flat;

    /** Ranked value tags, rank 1 first (at most 4). */
    public final List<String> values = new ArrayList<>();
    /** Option texts in the same order as {@link #values}. */
    public final List<String> valueOptions = new ArrayList<>();
    public boolean valuesMissing;

    /** Aspiration picks as domain keys (d_*), in answer order; never scored. */
    public final List<String> aspirations = new ArrayList<>();

    /** Internal only — never placed in the student placeholder map. */
    public int validityFlags;
    public boolean attentionPassed;

    /** "construct:questionId:missing" / "construct:questionId:duplicate" / "values:ranked:n". */
    public final List<String> incomplete = new ArrayList<>();

    public double get(String key) {
        return index.getOrDefault(key, 0.0);
    }

    public double maxFamily() {
        return NavigatorProConstructMap.FAMILY_KEYS.stream().mapToDouble(this::get).max().orElse(0.0);
    }

    public double maxDomain() {
        return NavigatorProConstructMap.DOMAIN_KEYS.stream().mapToDouble(this::get).max().orElse(0.0);
    }
}
