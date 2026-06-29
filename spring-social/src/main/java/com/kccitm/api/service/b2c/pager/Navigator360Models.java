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

    /** Spec §2.3 step 9 — one of the 24 canonical career clusters. */
    public static class CareerDefinition {
        public int srNo;                        // canonical Sr-no (cluster cascade Tier F)
        public String id;
        public String name;
        public List<RiasecType> riasec;        // [Primary, Secondary, Tertiary] (P_score)
        public List<String> mi;                 // required MI domains (I_score)
        public List<String> abilities;          // required abilities, ranked (A_score)
        public List<String> values;             // aligned values (V_score)
        public List<String> degreePaths;
    }

    /** One ranked cluster, scored by the spec §2.3 step 8 CSI. */
    public static class CareerMatch {
        public CareerDefinition career;
        public int pScore;                  // 0–100 personality sub-score
        public int aScore;                  // 0–100 ability sub-score
        public int iScore;                  // 0–100 intelligence sub-score
        public int valuesMatch;             // 0–100 V_score
        public int csiRaw;                  // 0–100 csi before reliability
        public int suitability;             // 0–100 csi_final (csi_raw × completion × 1.05, clamped)
        public int suitability9;            // 1–9
        public int cell;                    // 1–9 Page-4 bar cell = clamp(ceil(pct/11.11),1,9)
        // Back-compat alias: callers that read potentialMatch get the personality+ability+intelligence blend.
        public int potentialMatch;          // 0–100
        public List<String> matchedValues = new ArrayList<>();
        public boolean isAspiration;
    }

    /** Career Clarity Index (spec §2.3 step 10). */
    public static class CciResult {
        public boolean applicable;          // false → N/A (Insight stage, or no aspiration maps)
        public Integer pct;                 // 0–100, null when not applicable
        public String band;                 // "Clear and Aligned" | "Partially Aligned" | "Aspiration Mismatch" | "N/A"

        public CciResult() {}
        public CciResult(boolean applicable, Integer pct, String band) {
            this.applicable = applicable;
            this.pct = pct;
            this.band = band;
        }
    }

    /**
     * Validity / bias outcome computed at the item level by
     * {@code NavigatorReportGenerationService} (spec §2.2) and consumed by the
     * engine for component suppression / reweighting / hard-fail.
     */
    public static class ValidityResult {
        public boolean valid = true;        // false → ERR-*, no report
        public boolean hardFail = false;    // 2+ bias → cover-message-only
        public double completionPct = 1.0;  // (108 − total_issues) / 108
        public java.util.Set<String> suppressed = new java.util.HashSet<>(); // "personality"|"ability"|"intelligence"
        public List<FlagInfo> flags = new ArrayList<>(); // ERR/WARN/BIAS emitted at validity stage
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
        public CciResult cci;
        public int alignmentScore;

        public boolean suppressBottomTier;   // TOP9-3: ≥4 of Top-9 below csi 50
        public boolean hardFail;             // composite bias → cover-message-only

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
        public String achievements;        // from demographic field_id 19
        public String hobbiesInterests;    // from demographic field_id 18
    }
}
