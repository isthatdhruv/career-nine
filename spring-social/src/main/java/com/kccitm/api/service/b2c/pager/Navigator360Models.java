package com.kccitm.api.service.b2c.pager;

import java.util.ArrayList;
import java.util.List;

/**
 * Container for the DTO/value classes that the Navigator 360 engine produces
 * and the FourPager placeholder builder consumes. Mirrors the type definitions
 * in {@code react-social/.../Navigator360Types.ts}.
 *
 * <p>Kept as nested public static classes so the entire model surface lives in
 * one file (Java requires one public top-level class per source file).
 */
public final class Navigator360Models {

    private Navigator360Models() {}

    /** One dimension after stanine/level computation. */
    public static class ScoredDimension {
        public String name;
        public int rawScore;
        public double normPct;      // 0–100, 1dp
        public int stanine;         // 1–9
        public AbsoluteLevel level;

        public ScoredDimension() {}

        public ScoredDimension(String name, int rawScore, double normPct, int stanine, AbsoluteLevel level) {
            this.name = name;
            this.rawScore = rawScore;
            this.normPct = normPct;
            this.stanine = stanine;
            this.level = level;
        }
    }

    /** Spec §5. */
    public static class PotentialScoreResult {
        public int personality;     // max 25
        public int intelligence;    // max 25
        public int ability;         // max 30
        public int academic;        // max 20
        public int total;           // max 100
        public double completionPct;
        public List<String> flags = new ArrayList<>();
    }

    /** Spec §6. */
    public static class PreferenceScoreResult {
        public int p1Values;        // max 20
        public int p2Aspirations;   // max 20
        public int p3Culture;       // max 30
        public int p4Subjects;      // max 30
        public int total;           // max 100
    }

    /** Spec §7.5. */
    public static class CareerDefinition {
        public String id;
        public String name;
        public List<RiasecType> riasec;        // [Primary, Secondary, Tertiary]
        public List<String> mi;                 // 3 supporting MI
        public List<String> abilities;          // 3 supporting abilities
        public List<String> values;             // aligned values
        public List<String> degreePaths;
    }

    /** One row of the ranked career-match list. */
    public static class CareerMatch {
        public CareerDefinition career;
        public int potentialMatch;          // 0–100
        public int valuesMatch;             // 0–100
        public int suitability;             // 0–100
        public int suitability9;            // 1–9
        public List<String> matchedValues = new ArrayList<>();
        public boolean isAspiration;
    }

    /** Psychometric flag (spec §10–12). */
    public static class FlagInfo {
        public String code;
        public String name;
        public String message;
        public String severity;             // "info" | "warning" | "critical"

        public FlagInfo() {}

        public FlagInfo(String code, String name, String message, String severity) {
            this.code = code;
            this.name = name;
            this.message = message;
            this.severity = severity;
        }
    }

    /** Top-level engine output consumed by FourPagerEngineService. */
    public static class Navigator360Result {
        public String studentName;
        public String studentClass;
        public String gradeGroup;           // "6-8" | "9-10" | "11-12"

        public List<ScoredDimension> riasec = new ArrayList<>();
        public List<ScoredDimension> abilities = new ArrayList<>();
        public List<ScoredDimension> mi = new ArrayList<>();

        public List<String> careerAspirations = new ArrayList<>();
        public List<String> values = new ArrayList<>();
        public List<String> subjectsOfInterest = new ArrayList<>();

        public PotentialScoreResult potentialScore;
        public PreferenceScoreResult preferenceScore;

        public List<CareerMatch> careerMatches = new ArrayList<>();
        public List<CareerMatch> topCareers = new ArrayList<>();
        public CciLevel cci;
        public int alignmentScore;

        public List<FlagInfo> flags = new ArrayList<>();
        public String hollandCode;
    }

    /** Pass-through student metadata for placeholder rendering. */
    public static class StudentMeta {
        public String studentName;
        public String studentClass;
        public String age;
        public String schoolName;
        public String schoolCity;
        public String reportUrl;
    }
}
