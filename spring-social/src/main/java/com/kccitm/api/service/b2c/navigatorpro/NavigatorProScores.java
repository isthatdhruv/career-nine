package com.kccitm.api.service.b2c.navigatorpro;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Scorer output. Indices are 0–100 doubles, rounded only at display time. */
public final class NavigatorProScores {

    /** f_id, f_st, f_ae, drive, foundation, skill, fs_*, d_*, fam_* → 0–100. */
    public final Map<String, Double> index = new LinkedHashMap<>();
    /** chk_* → correct. */
    public final Map<String, Boolean> checks = new LinkedHashMap<>();
    public int reasoning;

    public String topFamily;
    public String secondFamily;
    public boolean flat;

    public final List<String> values = new ArrayList<>();
    public boolean valuesMissing;

    /** Internal only — never placed in the placeholder map. */
    public int validityFlags;
    public boolean attentionPassed;

    /** "construct:questionId:missing" / "construct:questionId:duplicate". */
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
