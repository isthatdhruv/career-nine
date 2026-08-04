package com.kccitm.api.service.psychometric;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * In-memory cohort for the psychometric properties export: one record per
 * scored student, plus the fixed item/scale vocabulary of the Navigator 360
 * instrument (54 RIASEC + 30 aptitude + 24 MI items) in questionnaire order.
 */
public class PsychometricDataset {

    // ── instrument vocabulary, in question order ────────────────────────────

    /** RIASEC letters cycle every 6 questions; 9 rounds of 6 = 54 items. */
    public static final String[] RIASEC_LETTERS = {"R", "I", "A", "S", "E", "C"};

    public static final String[] RIASEC_FULL_NAMES = {
            "Realistic", "Investigative", "Artistic", "Social", "Enterprising", "Conventional"};

    /**
     * The historical item codes of the validation workbook, kept so the export
     * matches the template row-for-row (R22/A310/C525 etc. are the original
     * analyst's dedup suffixes, not typos).
     */
    public static final String[] RIASEC_ITEM_LABELS = {
            "R1", "I1", "A1", "S1", "E1", "C1",
            "R2", "I2", "A2", "S2", "E2", "C2",
            "R22", "I23", "A24", "S25", "E26", "C27",
            "R3", "I3", "A3", "S3", "E3", "C3",
            "R38", "I39", "A310", "S311", "E312", "C313",
            "R4", "I4", "A4", "S4", "E4", "C4",
            "R414", "I415", "A416", "S417", "E418", "C419",
            "R5", "I5", "A5", "S5", "E5", "C5",
            "R520", "I521", "A522", "S523", "E524", "C525"};

    /** Ability scales; aptitude question q maps to scale (q-1) % 10. */
    public static final String[] ABILITY_NAMES = {
            "Speed and accuracy", "Computational", "Creativity/Artistic",
            "Language/Communication", "Technical", "Decision making & problem solving",
            "Finger dexterity", "Form perception", "Logical reasoning", "Motor movement"};

    /** Short ability names used on the CFA sheets. */
    public static final String[] ABILITY_CFA_NAMES = {
            "Speed & Accuracy", "Computational", "Creativity/Artistic",
            "Language/Communication", "Technical", "Decision Making",
            "Finger Dexterity", "Form Perception", "Logical Reasoning", "Motor Movement"};

    /** MI scales; MI question q maps to scale floor((q-1)/3). */
    public static final String[] MI_NAMES = {
            "Bodily-Kinesthetic", "Interpersonal", "Intrapersonal", "Linguistic",
            "Logical-Mathematical", "Musical", "Spatial-Visual", "Naturalistic"};

    public static final String[] BAND_LABELS = {"6th to 8th", "9th and 10th", "11th and 12th"};
    public static final String[] BAND_DISPLAY = {"Grades 6-8", "Grades 9-10", "Grades 11-12"};

    /** "Speed and accuracy 1" .. "Motor movement 3" in question order. */
    public static String aptitudeItemLabel(int qIdx) {
        return ABILITY_NAMES[qIdx % 10] + " " + (qIdx / 10 + 1);
    }

    /** CFA-style aptitude label, e.g. "Speed & Accuracy 1". */
    public static String aptitudeCfaItemLabel(int scale, int itemNo) {
        return ABILITY_CFA_NAMES[scale] + " " + itemNo;
    }

    /** "Bodily-Kinesthetic 1" .. "Naturalistic 3" in question order. */
    public static String miItemLabel(int qIdx) {
        return MI_NAMES[qIdx / 3] + " " + (qIdx % 3 + 1);
    }

    /** Grade band index: 0 = 6-8, 1 = 9-10, 2 = 11-12, -1 = outside/unknown. */
    public static int bandOf(Integer studentClass) {
        if (studentClass == null) return -1;
        if (studentClass >= 6 && studentClass <= 8) return 0;
        if (studentClass >= 9 && studentClass <= 10) return 1;
        if (studentClass >= 11 && studentClass <= 12) return 2;
        return -1;
    }

    // ── per-student record ──────────────────────────────────────────────────

    public static class StudentRecord {
        public String school = "";
        public String name = "";
        public Integer studentClass;
        public int band = -1;

        /** Question-order marks; null = unanswered. */
        public Integer[] riasecItems = new Integer[0];
        public Integer[] aptitudeItems = new Integer[0];
        public Integer[] miItems = new Integer[0];

        /** Scale totals in vocabulary order. */
        public Integer[] miTotals = new Integer[8];
        public Integer[] abilityTotals = new Integer[10];
        public Integer[] riasecTotals = new Integer[6];

        public String[] soi = new String[5];
        public String[] values = new String[5];
        public String[] aspirations = new String[5];
        public String[] personalityTop = new String[3];
        public String[] intelligenceTop = new String[3];
        public String[] abilityTop = new String[5];
        public String[] suitabilityIndex = new String[9];

        public double riasecTotal() {
            double s = 0;
            for (Integer v : riasecTotals) s += v != null ? v : 0;
            return s;
        }

        public double abilityTotal() {
            double s = 0;
            for (Integer v : abilityTotals) s += v != null ? v : 0;
            return s;
        }

        public double miTotal() {
            double s = 0;
            for (Integer v : miTotals) s += v != null ? v : 0;
            return s;
        }
    }

    public final List<StudentRecord> records = new ArrayList<>();

    /**
     * The RIASEC section's question statements in question order (index =
     * question 0..53), used to label the personality item columns like
     * "R1 (I enjoy physical activities...)". Empty when unavailable.
     */
    public String[] riasecStatements = new String[0];

    public List<StudentRecord> inBand(int band) {
        return records.stream().filter(r -> r.band == band).collect(Collectors.toList());
    }

    /** Item matrix [student][question] for one instrument in one band (-1 = all). */
    public Integer[][] itemRows(int band, Instrument instrument) {
        List<StudentRecord> pool = band < 0 ? records : inBand(band);
        List<Integer[]> rows = new ArrayList<>();
        for (StudentRecord r : pool) {
            Integer[] items = instrument.itemsOf(r);
            if (items.length == instrument.itemCount) rows.add(items);
        }
        return rows.toArray(new Integer[0][]);
    }

    public enum Instrument {
        RIASEC(54, 2), APTITUDE(30, 4), MI(24, 4);

        public final int itemCount;
        public final int maxScore;

        Instrument(int itemCount, int maxScore) {
            this.itemCount = itemCount;
            this.maxScore = maxScore;
        }

        public Integer[] itemsOf(StudentRecord r) {
            switch (this) {
                case RIASEC: return r.riasecItems;
                case APTITUDE: return r.aptitudeItems;
                default: return r.miItems;
            }
        }
    }
}
