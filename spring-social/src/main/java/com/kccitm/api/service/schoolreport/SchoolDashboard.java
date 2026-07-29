package com.kccitm.api.service.schoolreport;

import java.util.ArrayList;
import java.util.List;

import com.kccitm.api.service.schoolreport.SchoolReportService.PasteDataRow;

/**
 * The computed contents of every sheet in the Navigator360 school dashboard
 * workbook. One nested class per sheet, mirroring the sheet's own layout, so a
 * value can be traced straight back to the cell it came from.
 *
 * <p>Public fields, matching the house style of the other report DTOs.
 * Percentages are whole numbers (the workbook rounds them to 0 decimals);
 * averages carry one decimal. A {@code null} boxed value is the workbook's
 * {@code ""}.
 *
 * @see SchoolReportService
 */
public class SchoolDashboard {

    /** The class filter every sheet except "8. BY CLASS" respects. */
    public ClassFilter filter;
    /** Sheet 1 rows, with {@code calculations} populated. */
    public List<PasteDataRow> rows = new ArrayList<>();
    public SummarySheet summary;
    public PersonalitySheet personality;
    public LearningStyleSheet learningStyle;
    public AbilitiesSheet abilities;
    public ValuesSheet values;
    public CareerGapSheet careerGap;
    public ByClassSheet byClass;
    public ChartsSheet charts;

    /**
     * Sheet 2 cells C4/D4/E4. "All" widens the range to 1..99 rather than
     * switching off the comparison, exactly as the workbook does.
     */
    public static class ClassFilter {
        /** What the user picked: "All", or the class number as text. */
        public final String label;
        /** D4 — lower bound, inclusive. */
        public final int min;
        /** E4 — upper bound, inclusive. */
        public final int max;

        private ClassFilter(String label, int min, int max) {
            this.label = label;
            this.min = min;
            this.max = max;
        }

        /** C4 = "All" → D4 = 1, E4 = 99. */
        public static ClassFilter all() {
            return new ClassFilter("All", 1, 99);
        }

        /** C4 = n → D4 = E4 = n. */
        public static ClassFilter of(int studentClass) {
            return new ClassFilter(String.valueOf(studentClass), studentClass, studentClass);
        }

        /**
         * Excel's {@code >=D4} AND {@code <=E4} pair. A blank class fails both
         * comparisons in Excel, so a null class is never in view.
         */
        public boolean includes(Integer studentClass) {
            return studentClass != null && studentClass >= min && studentClass <= max;
        }

        @Override
        public String toString() {
            return "ClassFilter[" + label + " => " + min + ".." + max + "]";
        }
    }

    // ───────────────────────── 2. SUMMARY ─────────────────────────

    /** Sheet "2. SUMMARY". */
    public static class SummarySheet {
        /** C8 — rows with a name whose class is in view. Denominator for most percentages. */
        public int studentsInView;
        /** C9 — gender "F" and class in view. Does not require a name, as in the workbook. */
        public int girls;
        /** C10 — gender "M" and class in view. */
        public int boys;
        /** C11 — share of students in view with at least one matched aspiration. */
        public int careerClarityPct;
        /** C12 — mean of column AZ across students in view, 2 decimals. */
        public double avgMatchedAspirations;
        /** Rows 16..22 — classes 6..12. Ignores the class filter by design. */
        public List<ClassCount> studentsByClass = new ArrayList<>();
        /** C23 — sum of {@link #studentsByClass}. */
        public int totalStudents;

        /** C25 — trait with the highest "% as top trait" on sheet 3. */
        public String dominantPersonality;
        /** C26 — second-highest. */
        public String secondPersonality;
        /** C27 — intelligence with the highest "% strong" on sheet 4. */
        public String dominantLearningStyle;
        /** C28 — intelligence with the lowest "% strong". */
        public String weakestLearningStyle;
        /** C29 — ability with the highest "% strong" on sheet 5. */
        public String strongestAbility;
        /** C30 — ability with the highest "% low" (most students weak at it). */
        public String weakestAbility;
        /** C31 — value with the highest "% in top five" on sheet 6. */
        public String topValue;
        /** C32 — stream with the highest "Suited %" on sheet 7. */
        public String bestFitStream;
        /** C33 — stream with the highest "Aspiring %" on sheet 7. */
        public String mostWantedStream;
    }

    /** One row of sheet 2's "STUDENTS BY CLASS" block. */
    public static class ClassCount {
        /** B — "Class 6" .. "Class 12". */
        public String label;
        /** The numeric class, 6..12. */
        public int studentClass;
        /** C — students in that class across the whole school. */
        public int students;
        /** D — share of the school, whole percent. */
        public int pctOfSchool;

        public ClassCount(String label, int studentClass, int students, int pctOfSchool) {
            this.label = label;
            this.studentClass = studentClass;
            this.students = students;
            this.pctOfSchool = pctOfSchool;
        }
    }

    // ─────────────────────── 3. PERSONALITY ───────────────────────

    /** Sheet "3. PERSONALITY". */
    public static class PersonalitySheet {
        /** Rows 6..11 — the six RIASEC traits in sheet order. */
        public List<TraitRow> traits = new ArrayList<>();
        /** D12 — sum of the six "% as top trait" values. */
        public int totalTopTraitPct;
        /** C15 — highest "% as top trait". */
        public int highestTraitShare;
        /** C16 — lowest. */
        public int lowestTraitShare;
        /** C17 — highest minus lowest. */
        public int spread;
        /** C18 — how many traits are at 20% or above. */
        public int traitsAbove20;
    }

    /** One trait row on sheet 3. */
    public static class TraitRow {
        /** B — e.g. "Doer  (Realistic)". */
        public String label;
        /** The RIASEC name as it appears in Personality_Top1..3, e.g. "Realistic". */
        public String riasecName;
        /** C — mean raw RIASEC score, 1 decimal. */
        public double avgRawScore;
        /** D — share of students whose top trait this is. */
        public int pctAsTopTrait;
        /** E — share of students with this trait anywhere in their top three. */
        public int pctInTopThree;
        /** F — headcount behind {@link #pctAsTopTrait}. */
        public int studentsTopTrait;
        /** G — headcount behind {@link #pctInTopThree}. */
        public int studentsInTopThree;
    }

    // ────────────────────── 4. LEARNING STYLE ─────────────────────

    /** Sheet "4. LEARNING STYLE". */
    public static class LearningStyleSheet {
        /** Rows 6..13 — the eight intelligences in sheet order. */
        public List<IntelligenceRow> intelligences = new ArrayList<>();
    }

    /** One intelligence row on sheet 4. */
    public static class IntelligenceRow {
        /** B — e.g. "Body smart  (Bodily-Kinesthetic)". */
        public String label;
        /** C — share scoring 10 or more. */
        public int pctStrong;
        /** D — share scoring 8 or under. */
        public int pctLow;
        /** E — mean score, 1 decimal. */
        public double avgScore;
        /** F — headcount scoring 10 or more. */
        public int studentsStrong;
        /** G — headcount scoring 8 or under. */
        public int studentsLow;
    }

    // ──────────────────────── 5. ABILITIES ────────────────────────

    /** Sheet "5. ABILITIES". */
    public static class AbilitiesSheet {
        /** Rows 6..15 — the ten abilities in sheet order. */
        public List<AbilityRow> abilities = new ArrayList<>();
        /** C18 — mean of column BD: strong abilities per student, 1 decimal. */
        public double avgAbilities10Plus;
        /** C19 — mean of column BE: weak abilities per student, 1 decimal. */
        public double avgAbilities8OrLess;
        /** C20 — students carrying 5 or more weak abilities. */
        public int studentsWith5PlusWeak;
        /** C21 — {@link #studentsWith5PlusWeak} as a share of students in view. */
        public int pctWith5PlusWeak;
    }

    /** One ability row on sheet 5. */
    public static class AbilityRow {
        /** B — e.g. "Speed and accuracy". */
        public String label;
        /** C — share scoring 10 or more. */
        public int pctStrong;
        /** D — share scoring 8 or under. */
        public int pctLow;
        /** E — {@link #pctLow} minus {@link #pctStrong}. */
        public int gap;
        /** F — mean score, 1 decimal. */
        public double avgScore;
        /** G — headcount scoring 10 or more. */
        public int studentsStrong;
        /** H — headcount scoring 8 or under. */
        public int studentsLow;
    }

    // ────────────────────────── 6. VALUES ─────────────────────────

    /** Sheet "6. VALUES". */
    public static class ValuesSheet {
        /** Rows 6..20 — the fifteen work values in sheet order. */
        public List<ValueRow> values = new ArrayList<>();
    }

    /** One value row on sheet 6. */
    public static class ValueRow {
        /** B — e.g. "Lucrative Salary". */
        public String label;
        /** C — share of students listing it anywhere in their top five. */
        public int pctInTopFive;
        /** D — headcount. Counts cells, so a duplicate pick counts twice. */
        public int students;
        /** E — descending rank of {@link #pctInTopFive}; null when the share is 0. */
        public Integer rank;
    }

    // ─────────────────────── 7. CAREER GAP ────────────────────────

    /** Sheet "7. CAREER GAP". */
    public static class CareerGapSheet {
        /** Rows 6..8 — Science, Commerce, Arts / Humanities. */
        public List<StreamRow> streams = new ArrayList<>();
        /** Rows 12..35 — the 24 career clusters. */
        public List<ClusterRow> clusters = new ArrayList<>();
    }

    /** One stream row on sheet 7. */
    public static class StreamRow {
        /** B — "Science" / "Commerce" / "Arts / Humanities". */
        public String label;
        /** C — share whose suitability #1 sits in this stream. */
        public int suitedPct;
        /** D — share whose first aspiration sits in this stream. */
        public int aspiringPct;
        /** E — {@link #aspiringPct} minus {@link #suitedPct}; positive means over-subscribed. */
        public int gap;
        /** F — headcount behind {@link #suitedPct}. */
        public int studentsSuited;
        /** G — headcount behind {@link #aspiringPct}. */
        public int studentsAspiring;
    }

    /** One career-cluster row on sheet 7. */
    public static class ClusterRow {
        /** B — the cluster name. */
        public String label;
        /** C — students with this cluster in their top 3 suitability slots (AP:AR). */
        public int suitedTop3;
        /** D — students naming this cluster among their 4 aspirations (AL:AO). */
        public int aspiring;
        /** E — {@link #aspiring} minus {@link #suitedTop3}. */
        public int gap;
        /** F — of those who want it, the share whose profile also lists it; null when nobody chose it. */
        public Integer readinessPct;
        /** G — the stream this cluster belongs to. */
        public String stream;
    }

    // ───────────────────────── 8. BY CLASS ────────────────────────

    /**
     * Sheet "8. BY CLASS". Deliberately ignores the class filter — every series
     * is indexed by {@link #classes}, one entry per class 6..12.
     */
    public static class ByClassSheet {
        /** Row 4 — the classes across the top, 6..12. */
        public List<Integer> classes = new ArrayList<>();
        /** Row 5 — headcount per class. */
        public List<Integer> students = new ArrayList<>();
        /** Row 6 — share per class with at least one matched aspiration. */
        public List<Integer> careerClarityPct = new ArrayList<>();
        /** Row 7 — headcount per class with 5 or more weak abilities. */
        public List<Integer> fiveOrMoreWeakAbilities = new ArrayList<>();
        /** Rows 10..15 — "% as top trait" per trait per class. */
        public List<LabeledSeries> personalityTopTraitPct = new ArrayList<>();
        /** Rows 18..25 — "% strong" per intelligence per class. */
        public List<LabeledSeries> learningStyleStrongPct = new ArrayList<>();
        /** Rows 28..37 — "% low" per ability per class. */
        public List<LabeledSeries> abilityLowPct = new ArrayList<>();
        /** Rows 40..45 — suited/aspiring share per stream per class. */
        public List<LabeledSeries> streamFitVsWish = new ArrayList<>();
    }

    /** A labelled row of per-class values, index-aligned with {@link ByClassSheet#classes}. */
    public static class LabeledSeries {
        public String label;
        public List<Integer> values = new ArrayList<>();

        public LabeledSeries(String label) {
            this.label = label;
        }
    }

    // ────────────────────────── 9. CHARTS ─────────────────────────

    /**
     * Sheet "9. CHARTS" — chart-ready copies of numbers already computed on
     * sheets 3..7 and 2. Nothing new is calculated here.
     */
    public static class ChartsSheet {
        /** Rows 6..11 — "% as top trait" from sheet 3 column D. */
        public List<LabeledValue> personalityMix = new ArrayList<>();
        /** Rows 14..21 — "% strong" from sheet 4 column C. */
        public List<LabeledValue> learningStyle = new ArrayList<>();
        /** Rows 25..34 — "% strong" and "% low" from sheet 5 columns C and D. */
        public List<LabeledPair> abilities = new ArrayList<>();
        /** Rows 37..51 — "% in top five" from sheet 6 column C. */
        public List<LabeledValue> values = new ArrayList<>();
        /** Rows 55..57 — suited and aspiring shares from sheet 7 columns C and D. */
        public List<LabeledPair> streamFitVsWish = new ArrayList<>();
        /** Rows 60..66 — headcount per class from sheet 2. */
        public List<LabeledValue> studentsByClass = new ArrayList<>();
    }

    /** A chart label with a single series value. */
    public static class LabeledValue {
        public String label;
        public int value;

        public LabeledValue(String label, int value) {
            this.label = label;
            this.value = value;
        }
    }

    /** A chart label with two series values. */
    public static class LabeledPair {
        public String label;
        public int first;
        public int second;

        public LabeledPair(String label, int first, int second) {
            this.label = label;
            this.first = first;
            this.second = second;
        }
    }
}
