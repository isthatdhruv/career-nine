package com.kccitm.api.util;

import java.util.Comparator;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Central place for interpreting free-form class labels ("10", "10-A",
 * "Class 9", "XII", "1st Year", "B.Tech CSE").
 *
 * Class labels are stored verbatim as strings; the numeric grade is only
 * derived on demand for band logic (report template selection, dashboard
 * grade bands). Labels with no usable number (college courses, custom
 * cohorts) yield null and callers fall back to their defaults.
 */
public final class GradeParser {

    private GradeParser() {
    }

    private static final Pattern FIRST_NUMBER = Pattern.compile("(\\d{1,2})");

    private static final Pattern ROMAN_TOKEN = Pattern.compile("\\b([IVXivx]{1,4})\\b");

    private static final Map<String, Integer> ROMAN_VALUES = Map.ofEntries(
            Map.entry("I", 1), Map.entry("II", 2), Map.entry("III", 3),
            Map.entry("IV", 4), Map.entry("V", 5), Map.entry("VI", 6),
            Map.entry("VII", 7), Map.entry("VIII", 8), Map.entry("IX", 9),
            Map.entry("X", 10), Map.entry("XI", 11), Map.entry("XII", 12));

    /**
     * Best-effort numeric grade for a class label; null when the label has no
     * usable number. Never throws.
     */
    public static Integer numericGradeOrNull(String raw) {
        if (raw == null) {
            return null;
        }
        String text = raw.trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            return Integer.valueOf(text);
        } catch (NumberFormatException ignored) {
        }
        Matcher digits = FIRST_NUMBER.matcher(text);
        if (digits.find()) {
            return Integer.valueOf(digits.group(1));
        }
        Matcher roman = ROMAN_TOKEN.matcher(text);
        if (roman.find()) {
            return ROMAN_VALUES.get(roman.group(1).toUpperCase());
        }
        return null;
    }

    /**
     * Orders class labels numerically where possible ("9" &lt; "10"), then
     * alphabetically; numeric labels sort before non-numeric ones and nulls
     * sort last.
     */
    public static Comparator<String> classLabelComparator() {
        return Comparator.nullsLast(
                Comparator.comparing((String label) -> {
                    Integer grade = numericGradeOrNull(label);
                    return grade == null ? Integer.MAX_VALUE : grade;
                }).thenComparing(label -> label, String.CASE_INSENSITIVE_ORDER));
    }
}
