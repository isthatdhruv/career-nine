package com.kccitm.api.service.schoolreport;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.ToIntFunction;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Java port of the Navigator360 school dashboard workbook
 * ({@code signup-c9-html/Navigator360_Dashboard.xlsx}).
 *
 * <p>The workbook is driven by sheet <b>"1. PASTE DATA"</b>: one student per row
 * (rows 4..1503), headers on row 3. Columns A..AX are pasted by hand from the
 * "Raw + Master Sheet" export; columns AZ..BE are grey self-calculating helper
 * columns that every downstream sheet (2..9) aggregates over.
 *
 * <p>This class implements <b>sheet 1 only</b> — the six helper columns. Sheets
 * 2..9 are layered on top of {@link PasteDataCalculations} in later passes.
 *
 * <h2>Formulas ported (row 4 shown; identical for all 1500 rows)</h2>
 * <pre>
 * AZ  » Matched aspirations
 *     =IF($B4="","",SUMPRODUCT(($AL4:$AO4&lt;&gt;"")*(COUNTIF($AP4:$AX4,$AL4:$AO4)&gt;0)))
 * BA  » Has a match
 *     =IF($B4="","",IF(AZ4&gt;0,1,0))
 * BB  » Suitability #1 stream        = stream bucket of AP4 (suitability_index_1)
 * BC  » Top aspiration stream        = stream bucket of AL4 (Career Aspiration 1)
 * BD  » Abilities 10+
 *     =IF($B4="","",--(F4&gt;=10)+...+--(O4&gt;=10))
 * BE  » Abilities 8-
 *     =IF($B4="","",--(AND(F4&lt;&gt;"",F4&lt;=8))+...+--(AND(O4&lt;&gt;"",O4&lt;=8)))
 * </pre>
 *
 * <h2>Deliberate deviation from the workbook: field-name matching</h2>
 * Excel compares career-aspiration and suitability strings with <b>exact</b>
 * equality. In the real export those two families of strings are produced by
 * two different tables that disagree on punctuation:
 * {@code NavigatorReportGenerationService.CAREER_ASP_LABELS} feeds AL:AO while
 * {@code NavigatorCoreAnalysis.PATHWAY_MAPPINGS} feeds AP:AX, and 5 of the 24
 * fields differ ("Art Design" vs "Art, Design", "Computer Science IT and Allied
 * Fields" vs "Computer Science, IT and Allied Fields", "Life Sciences/Medicine
 * and Healthcare" vs "Life Sciences /Medicine and Healthcare",
 * "Defence/Protective Service" vs "Defence/ Protective Service", "Agriculture
 * Food Industry and Forestry" vs "Agriculture, Food Industry and Forestry").
 *
 * <p>In the spreadsheet those five silently never match — AZ under-counts and BC
 * returns blank. This port compares on {@link #normalizeField(String)} instead
 * (case-folded, punctuation stripped, whitespace collapsed), which is what the
 * formulas intend. Results therefore match the workbook for the 19 clean fields
 * and are <em>corrected</em> for the other 5.
 *
 * @see com.kccitm.api.service.GeneralAssessmentExportService#exportCombinedOldFormat
 */
@Service
public class SchoolReportService {

    private static final Logger logger = LoggerFactory.getLogger(SchoolReportService.class);

    /** First student row in "1. PASTE DATA" (1-based, as shown in Excel). */
    public static final int FIRST_DATA_ROW = 4;
    /** Last student row in "1. PASTE DATA" (1-based). */
    public static final int LAST_DATA_ROW = 1503;
    /** Row carrying the column headers in "1. PASTE DATA". */
    public static final int HEADER_ROW = 3;

    public static final String STREAM_SCIENCE = "Science";
    public static final String STREAM_COMMERCE = "Commerce";
    public static final String STREAM_ARTS = "Arts / Humanities";

    /** Column F..O — the 10 ability headers, in sheet order. */
    public static final List<String> ABILITY_HEADERS = Collections.unmodifiableList(Arrays.asList(
            "Speed and accuracy", "Computational", "Creativity", "Communication", "Technical",
            "Decision making & problem solving", "Finger dexterity", "Form perception",
            "Logical reasoning", "Motor movement"));

    /** Column P..W — the 8 multiple-intelligence headers, in sheet order. */
    public static final List<String> INTELLIGENCE_HEADERS = Collections.unmodifiableList(Arrays.asList(
            "Bodily-Kinesthetic", "Interpersonal", "Intrapersonal", "Linguistic",
            "Logical-Mathematical", "Musical", "Visual-Spatial", "Naturalistic"));

    /** Column X..AC — the 6 RIASEC headers, in sheet order. */
    public static final List<String> RIASEC_HEADERS = Collections.unmodifiableList(Arrays.asList(
            "Realistic", "Investigative", "Artistic", "Social", "Enterprising", "Conventional"));

    public static final int ABILITY_COUNT = 10;
    public static final int INTELLIGENCE_COUNT = 8;
    public static final int RIASEC_COUNT = 6;
    public static final int PERSONALITY_TOP_COUNT = 3;
    public static final int VALUE_COUNT = 5;
    public static final int CAREER_ASPIRATION_COUNT = 4;
    public static final int SUITABILITY_INDEX_COUNT = 9;

    /** BD threshold: an ability score at or above this is a "strong" ability. */
    private static final int STRONG_ABILITY_MIN = 10;
    /** BE threshold: an ability score at or below this is a "weak" ability. */
    private static final int WEAK_ABILITY_MAX = 8;
    /** Sheet 8 row 7: how many weak abilities make a student worth flagging. */
    private static final int WEAK_ABILITY_ALERT = 5;
    /** Sheet 7's cluster block counts a student as suited on their top N pathways (AP:AR). */
    private static final int SUITED_TOP_N = 3;

    /** The classes the dashboard reports on, left to right on sheet 8. */
    public static final List<Integer> CLASSES = Collections.unmodifiableList(Arrays.asList(
            6, 7, 8, 9, 10, 11, 12));

    /** The three school streams, in sheet-7 row order. */
    public static final List<String> STREAMS = Collections.unmodifiableList(Arrays.asList(
            STREAM_SCIENCE, STREAM_COMMERCE, STREAM_ARTS));

    /** Report-friendly names for the six RIASEC traits, aligned with {@link #RIASEC_HEADERS}. */
    private static final List<String> PERSONALITY_SHORT_LABELS = Collections.unmodifiableList(Arrays.asList(
            "Doer", "Thinker", "Creator", "Helper", "Persuader", "Conventional"));

    /** Report-friendly names for the eight intelligences, aligned with {@link #INTELLIGENCE_HEADERS}. */
    private static final List<String> INTELLIGENCE_SHORT_LABELS = Collections.unmodifiableList(Arrays.asList(
            "Body smart", "People smart", "Self smart", "Word smart",
            "Logic smart", "Music smart", "Picture smart", "Nature smart"));

    /** The 15 work values in sheet-6 row order (not the order they are stored in). */
    public static final List<String> VALUE_SHEET_LABELS = Collections.unmodifiableList(Arrays.asList(
            "Lucrative Salary", "High Achievement", "Job Security", "Building Relations",
            "Mental Activity", "Creativity", "Physical Activity", "Leadership", "Autonomy",
            "Hands on activities", "Working Conditions", "Routine Activity",
            "Prestige/Recognition", "Variety and Diversity", "Supervised Work"));

    /** The 24 career clusters in sheet-7 row order: {@code {cluster, stream}}. */
    private static final String[][] CAREER_CLUSTERS = {
            {"Engineering and Technology", STREAM_SCIENCE},
            {"Science and Mathematics", STREAM_SCIENCE},
            {"Computer Science, IT and Allied Fields", STREAM_SCIENCE},
            {"Life Sciences /Medicine and Healthcare", STREAM_SCIENCE},
            {"Paramedical", STREAM_SCIENCE},
            {"Architecture", STREAM_SCIENCE},
            {"Environmental Service", STREAM_SCIENCE},
            {"Agriculture, Food Industry and Forestry", STREAM_SCIENCE},
            {"Banking and Finance", STREAM_COMMERCE},
            {"Management and Administration", STREAM_COMMERCE},
            {"Marketing", STREAM_COMMERCE},
            {"Sales", STREAM_COMMERCE},
            {"Entrepreneurship", STREAM_COMMERCE},
            {"Hospitality and Tourism", STREAM_COMMERCE},
            {"Social Sciences and Humanities", STREAM_ARTS},
            {"Law Studies", STREAM_ARTS},
            {"Education and Training", STREAM_ARTS},
            {"Art, Design", STREAM_ARTS},
            {"Entertainment and Mass Media", STREAM_ARTS},
            {"Community and Social Service", STREAM_ARTS},
            {"Personal Care and Services", STREAM_ARTS},
            {"Government and Public Administration", STREAM_ARTS},
            {"Defence/ Protective Service", STREAM_ARTS},
            {"Sports", STREAM_ARTS},
    };

    /**
     * Row 3 of "1. PASTE DATA", columns A..BE. Index 0 = column A. Index 50
     * (column AY) is the empty spacer between the pasted block and the grey
     * calculated block. Use this to validate an uploaded workbook.
     */
    public static final List<String> PASTE_DATA_HEADERS;

    /** Normalized career-field name -> stream bucket. Covers all 24 pathways. */
    private static final Map<String, String> STREAM_BY_FIELD;

    static {
        List<String> headers = new ArrayList<>();
        headers.add("School");                              // A
        headers.add("Student Name");                        // B
        headers.add("Class");                               // C
        headers.add("Section");                             // D
        headers.add("Gender");                              // E
        headers.addAll(ABILITY_HEADERS);                    // F..O
        headers.addAll(INTELLIGENCE_HEADERS);               // P..W
        headers.addAll(RIASEC_HEADERS);                     // X..AC
        for (int i = 1; i <= PERSONALITY_TOP_COUNT; i++) {
            headers.add("Personality_Top" + i);             // AD..AF
        }
        for (int i = 1; i <= VALUE_COUNT; i++) {
            headers.add("Value " + i);                      // AG..AK
        }
        for (int i = 1; i <= CAREER_ASPIRATION_COUNT; i++) {
            headers.add("Career Aspiration " + i);          // AL..AO
        }
        for (int i = 1; i <= SUITABILITY_INDEX_COUNT; i++) {
            headers.add("suitability_index_" + i);          // AP..AX
        }
        headers.add("");                                    // AY spacer
        headers.add("» Matched aspirations");          // AZ
        headers.add("» Has a match");                  // BA
        headers.add("» Suitability #1 stream");        // BB
        headers.add("» Top aspiration stream");        // BC
        headers.add("» Abilities 10+");                // BD
        headers.add("» Abilities 8-");                 // BE
        PASTE_DATA_HEADERS = Collections.unmodifiableList(headers);

        Map<String, String> streams = new LinkedHashMap<>();
        putStream(streams, STREAM_SCIENCE,
                "Engineering and Technology",
                "Science and Mathematics",
                "Computer Science, IT and Allied Fields",
                "Life Sciences /Medicine and Healthcare",
                "Paramedical",
                "Architecture",
                "Environmental Service",
                "Agriculture, Food Industry and Forestry");
        putStream(streams, STREAM_COMMERCE,
                "Banking and Finance",
                "Management and Administration",
                "Marketing",
                "Sales",
                "Entrepreneurship",
                "Hospitality and Tourism");
        putStream(streams, STREAM_ARTS,
                "Social Sciences and Humanities",
                "Law Studies",
                "Education and Training",
                "Art, Design",
                "Entertainment and Mass Media",
                "Community and Social Service",
                "Personal Care and Services",
                "Government and Public Administration",
                "Defence/ Protective Service",
                "Sports");
        STREAM_BY_FIELD = Collections.unmodifiableMap(streams);
    }

    private static void putStream(Map<String, String> target, String stream, String... fields) {
        for (String field : fields) {
            target.put(normalizeField(field), stream);
        }
    }

    // ═════════════════════════════ MODELS ═════════════════════════════

    /**
     * One row of "1. PASTE DATA" (columns A..AX — the pasted block only).
     * Public fields to match the house style of
     * {@code NavigatorReportGenerationService.IntermediaryScores}.
     *
     * <p>A {@code null} field means an empty cell. Fixed-width arrays may be
     * shorter than their declared length or hold nulls; the calculator treats
     * missing slots as blank.
     */
    public static class PasteDataRow {
        /** A — School / institute name. */
        public String school;
        /** B — Student name. Blank means "row not used": AZ, BA, BD, BE stay blank. */
        public String studentName;
        /** C — Class (6..12). Downstream sheets filter on this. */
        public Integer studentClass;
        /** D — Section. */
        public String section;
        /** E — Gender, "M" / "F" as counted by sheet 2. */
        public String gender;
        /** F..O — 10 ability scores, in {@link #ABILITY_HEADERS} order. */
        public Integer[] abilities = new Integer[ABILITY_COUNT];
        /** P..W — 8 MI scores, in {@link #INTELLIGENCE_HEADERS} order. */
        public Integer[] intelligences = new Integer[INTELLIGENCE_COUNT];
        /** X..AC — 6 RIASEC scores, in {@link #RIASEC_HEADERS} order. */
        public Integer[] riasec = new Integer[RIASEC_COUNT];
        /** AD..AF — top 3 RIASEC personality codes, strongest first. */
        public String[] personalityTop = new String[PERSONALITY_TOP_COUNT];
        /** AG..AK — 5 selected work values. */
        public String[] values = new String[VALUE_COUNT];
        /** AL..AO — 4 self-declared career aspirations, most preferred first. */
        public String[] careerAspirations = new String[CAREER_ASPIRATION_COUNT];
        /** AP..AX — top 9 computed suitability pathways, best fit first. */
        public String[] suitabilityIndex = new String[SUITABILITY_INDEX_COUNT];

        /**
         * AZ..BE, populated in place by
         * {@link SchoolReportService#calculateAll(List)}. Null until calculated.
         */
        public PasteDataCalculations calculations;
    }

    /**
     * The six grey calculated columns AZ..BE for one row.
     *
     * <p>A {@code null} numeric or stream value is the workbook's {@code ""} —
     * the guard clause fired and the cell is blank. A stream that is an
     * <em>empty string</em> is different: the source cell held a value the
     * 24-pathway table does not recognise (a typo or an unmapped field), which
     * the workbook also renders as {@code ""}. Both are non-matches for every
     * downstream COUNTIFS, so aggregation is unaffected either way.
     */
    public static class PasteDataCalculations {
        /** AZ — how many of the 4 aspirations appear in the 9 suitability slots (0..4). */
        public Integer matchedAspirations;
        /** BA — 1 when {@link #matchedAspirations} &gt; 0, else 0. */
        public Integer hasMatch;
        /** BB — stream bucket of suitability_index_1. */
        public String suitabilityTopStream;
        /** BC — stream bucket of Career Aspiration 1. */
        public String topAspirationStream;
        /** BD — how many of the 10 abilities scored &gt;= 10 (0..10). */
        public Integer abilities10Plus;
        /** BE — how many of the 10 abilities were answered and scored &lt;= 8 (0..10). */
        public Integer abilities8OrLess;
    }

    // ═══════════════════════ SHEET 1 CALCULATION ═══════════════════════

    /**
     * Computes columns AZ..BE for every row and stores the result on each
     * {@link PasteDataRow#calculations}.
     *
     * @param rows rows 4..1503 of "1. PASTE DATA"; null entries are skipped
     * @return the calculations, index-aligned with {@code rows} (null where the
     *         input row was null)
     */
    public List<PasteDataCalculations> calculateAll(List<PasteDataRow> rows) {
        if (rows == null || rows.isEmpty()) {
            return Collections.emptyList();
        }
        if (rows.size() > LAST_DATA_ROW - FIRST_DATA_ROW + 1) {
            logger.warn("PASTE DATA: {} rows supplied, workbook only holds {} — "
                    + "sheets 2-9 would truncate in Excel; calculating all of them here.",
                    rows.size(), LAST_DATA_ROW - FIRST_DATA_ROW + 1);
        }

        List<PasteDataCalculations> results = new ArrayList<>(rows.size());
        for (PasteDataRow row : rows) {
            if (row == null) {
                results.add(null);
                continue;
            }
            PasteDataCalculations calc = calculateRow(row);
            row.calculations = calc;
            results.add(calc);
        }
        return results;
    }

    /**
     * Computes columns AZ..BE for a single row of "1. PASTE DATA".
     *
     * <p>Guards mirror the workbook exactly: AZ/BA/BD/BE key off a blank
     * Student Name (B), whereas BB and BC key only off their own source cell
     * (AP and AL respectively) and so can still be produced for a row with no
     * name.
     *
     * @param row a pasted row; must not be null
     * @return the six calculated values, never null
     */
    public PasteDataCalculations calculateRow(PasteDataRow row) {
        if (row == null) {
            throw new IllegalArgumentException("row must not be null");
        }
        PasteDataCalculations calc = new PasteDataCalculations();

        // AZ / BA / BD / BE — IF($B4="","", ...)
        if (!isBlank(row.studentName)) {
            calc.matchedAspirations = countMatchedAspirations(
                    row.careerAspirations, row.suitabilityIndex);
            calc.hasMatch = calc.matchedAspirations > 0 ? 1 : 0;
            calc.abilities10Plus = countAbilitiesAtLeast(row.abilities, STRONG_ABILITY_MIN);
            calc.abilities8OrLess = countAbilitiesAtMost(row.abilities, WEAK_ABILITY_MAX);
        }

        // BB — IF($AP4="","", stream(AP4))
        String topSuitability = at(row.suitabilityIndex, 0);
        if (!isBlank(topSuitability)) {
            calc.suitabilityTopStream = streamOf(topSuitability);
        }

        // BC — IF($AL4="","", stream(AL4))
        String topAspiration = at(row.careerAspirations, 0);
        if (!isBlank(topAspiration)) {
            calc.topAspirationStream = streamOf(topAspiration);
        }

        return calc;
    }

    /**
     * AZ — {@code SUMPRODUCT(($AL:$AO<>"")*(COUNTIF($AP:$AX,$AL:$AO)>0))}.
     *
     * <p>Counts <em>cells</em>, not distinct values: a student who listed the
     * same aspiration twice and it is suitable scores 2, exactly as the
     * workbook does.
     */
    private int countMatchedAspirations(String[] aspirations, String[] suitability) {
        Set<String> suitable = new LinkedHashSet<>();
        if (suitability != null) {
            for (String pathway : suitability) {
                if (!isBlank(pathway)) {
                    suitable.add(normalizeField(pathway));
                }
            }
        }
        if (suitable.isEmpty() || aspirations == null) {
            return 0;
        }
        int matched = 0;
        for (String aspiration : aspirations) {
            if (!isBlank(aspiration) && suitable.contains(normalizeField(aspiration))) {
                matched++;
            }
        }
        return matched;
    }

    /**
     * BD — {@code --(F>=10)+...+--(O>=10)}. An unanswered ability is 0 in Excel,
     * so it never clears the threshold and is not counted.
     */
    private int countAbilitiesAtLeast(Integer[] abilities, int threshold) {
        if (abilities == null) {
            return 0;
        }
        int count = 0;
        for (int i = 0; i < ABILITY_COUNT && i < abilities.length; i++) {
            Integer score = abilities[i];
            if (score != null && score >= threshold) {
                count++;
            }
        }
        return count;
    }

    /**
     * BE — {@code --(AND(F<>"",F<=8))+...}. The {@code <>""} test is what keeps
     * unanswered abilities out; without it every blank would count as 0 &lt;= 8.
     */
    private int countAbilitiesAtMost(Integer[] abilities, int threshold) {
        if (abilities == null) {
            return 0;
        }
        int count = 0;
        for (int i = 0; i < ABILITY_COUNT && i < abilities.length; i++) {
            Integer score = abilities[i];
            if (score != null && score <= threshold) {
                count++;
            }
        }
        return count;
    }

    /**
     * BB / BC — buckets one of the 24 career fields into a school stream.
     *
     * @return {@link #STREAM_SCIENCE}, {@link #STREAM_COMMERCE},
     *         {@link #STREAM_ARTS}, or {@code ""} when the field is not one of
     *         the 24 known pathways (the workbook's trailing {@code ""} branch)
     */
    public String streamOf(String careerField) {
        if (isBlank(careerField)) {
            return "";
        }
        String stream = STREAM_BY_FIELD.get(normalizeField(careerField));
        if (stream == null) {
            logger.debug("PASTE DATA: career field '{}' is not one of the 24 known pathways; "
                    + "stream left blank", careerField);
            return "";
        }
        return stream;
    }

    // ═══════════════════════ SHEET 2: SUMMARY ═══════════════════════

    /**
     * Sheet "2. SUMMARY". The headline block (C25..C33) is INDEX/MATCH over
     * sheets 3..7, so those must be computed first and handed in.
     *
     * <p><b>Deviation:</b> the workbook's C32/C33 point at {@code '7. CAREER
     * GAP'!$B$6} and {@code $B$7}, which are the literal row labels "Science"
     * and "Commerce" — so the real sheet always reports the same two streams no
     * matter what the data says. This port derives them from the highest
     * "Suited %" and highest "Aspiring %", which is what the captions promise.
     */
    public SchoolDashboard.SummarySheet calculateSummary(
            List<PasteDataRow> rows, SchoolDashboard.ClassFilter filter,
            SchoolDashboard.PersonalitySheet personality,
            SchoolDashboard.LearningStyleSheet learningStyle,
            SchoolDashboard.AbilitiesSheet abilities,
            SchoolDashboard.ValuesSheet values,
            SchoolDashboard.CareerGapSheet careerGap) {

        List<PasteDataRow> safeRows = safe(rows);
        SchoolDashboard.SummarySheet sheet = new SchoolDashboard.SummarySheet();

        sheet.studentsInView = countStudentsInView(safeRows, filter);          // C8

        int girls = 0, boys = 0, matchedSum = 0, hasMatchSum = 0;
        for (PasteDataRow row : safeRows) {
            if (!filter.includes(row.studentClass)) {
                continue;
            }
            if (isGender(row.gender, 'F')) girls++;                            // C9
            if (isGender(row.gender, 'M')) boys++;                             // C10
            PasteDataCalculations calc = calcOf(row);
            if (calc.hasMatch != null) hasMatchSum += calc.hasMatch;
            if (calc.matchedAspirations != null) matchedSum += calc.matchedAspirations;
        }
        sheet.girls = girls;
        sheet.boys = boys;
        sheet.careerClarityPct = pct(hasMatchSum, sheet.studentsInView);        // C11
        sheet.avgMatchedAspirations = sheet.studentsInView == 0                 // C12
                ? 0 : round((double) matchedSum / sheet.studentsInView, 2);

        // Rows 16..22 count the whole school — the workbook leaves the class
        // filter off this block on purpose.
        int[] perClass = new int[CLASSES.size()];
        for (int i = 0; i < CLASSES.size(); i++) {
            perClass[i] = countStudentsInClass(safeRows, CLASSES.get(i));
            sheet.totalStudents += perClass[i];
        }
        for (int i = 0; i < CLASSES.size(); i++) {
            sheet.studentsByClass.add(new SchoolDashboard.ClassCount(
                    "Class " + CLASSES.get(i), CLASSES.get(i), perClass[i],
                    pct(perClass[i], sheet.totalStudents)));
        }

        // C25..C33 — INDEX(labels, MATCH(MAX(values), values, 0)); ties resolve
        // to the first matching row, as MATCH does.
        List<String> traitLabels = labels(personality.traits, t -> t.label);
        List<Integer> topTraitPct = ints(personality.traits, t -> t.pctAsTopTrait);
        sheet.dominantPersonality = labelAt(traitLabels, indexOfNthLargest(topTraitPct, 1));
        sheet.secondPersonality = labelAt(traitLabels, indexOfNthLargest(topTraitPct, 2));

        List<String> miLabels = labels(learningStyle.intelligences, i -> i.label);
        List<Integer> miStrong = ints(learningStyle.intelligences, i -> i.pctStrong);
        sheet.dominantLearningStyle = labelAt(miLabels, indexOfMax(miStrong));
        sheet.weakestLearningStyle = labelAt(miLabels, indexOfMin(miStrong));

        List<String> abLabels = labels(abilities.abilities, a -> a.label);
        sheet.strongestAbility = labelAt(abLabels, indexOfMax(ints(abilities.abilities, a -> a.pctStrong)));
        sheet.weakestAbility = labelAt(abLabels, indexOfMax(ints(abilities.abilities, a -> a.pctLow)));

        sheet.topValue = labelAt(labels(values.values, v -> v.label),
                indexOfMax(ints(values.values, v -> v.pctInTopFive)));

        List<String> streamLabels = labels(careerGap.streams, s -> s.label);
        sheet.bestFitStream = labelAt(streamLabels, indexOfMax(ints(careerGap.streams, s -> s.suitedPct)));
        sheet.mostWantedStream = labelAt(streamLabels, indexOfMax(ints(careerGap.streams, s -> s.aspiringPct)));

        return sheet;
    }

    // ═════════════════════ SHEET 3: PERSONALITY ═════════════════════

    /**
     * Sheet "3. PERSONALITY" — raw RIASEC averages plus how often each trait
     * lands in a student's top one and top three (columns AD, AE, AF).
     */
    public SchoolDashboard.PersonalitySheet calculatePersonality(
            List<PasteDataRow> rows, SchoolDashboard.ClassFilter filter) {

        List<PasteDataRow> safeRows = safe(rows);
        int inView = countStudentsInView(safeRows, filter);
        SchoolDashboard.PersonalitySheet sheet = new SchoolDashboard.PersonalitySheet();

        for (int i = 0; i < RIASEC_COUNT; i++) {
            final int idx = i;
            String riasecName = RIASEC_HEADERS.get(i);
            SchoolDashboard.TraitRow trait = new SchoolDashboard.TraitRow();
            trait.label = PERSONALITY_SHORT_LABELS.get(i) + "  (" + riasecName + ")";
            trait.riasecName = riasecName;
            trait.avgRawScore = averageInView(safeRows, filter, r -> at(r.riasec, RIASEC_COUNT, idx));

            int top1 = 0, top3 = 0;
            for (PasteDataRow row : safeRows) {
                if (!filter.includes(row.studentClass)) {
                    continue;
                }
                if (fieldEquals(at(row.personalityTop, PERSONALITY_TOP_COUNT, 0), riasecName)) {
                    top1++;
                }
                for (int slot = 0; slot < PERSONALITY_TOP_COUNT; slot++) {
                    if (fieldEquals(at(row.personalityTop, PERSONALITY_TOP_COUNT, slot), riasecName)) {
                        top3++;
                    }
                }
            }
            trait.studentsTopTrait = top1;
            trait.studentsInTopThree = top3;
            trait.pctAsTopTrait = pct(top1, inView);
            trait.pctInTopThree = pct(top3, inView);
            sheet.traits.add(trait);
        }

        List<Integer> shares = ints(sheet.traits, t -> t.pctAsTopTrait);
        sheet.totalTopTraitPct = shares.stream().mapToInt(Integer::intValue).sum();   // D12
        sheet.highestTraitShare = shares.stream().mapToInt(Integer::intValue).max().orElse(0);
        sheet.lowestTraitShare = shares.stream().mapToInt(Integer::intValue).min().orElse(0);
        sheet.spread = sheet.highestTraitShare - sheet.lowestTraitShare;
        sheet.traitsAbove20 = (int) shares.stream().filter(v -> v >= 20).count();
        return sheet;
    }

    // ═══════════════════ SHEET 4: LEARNING STYLE ════════════════════

    /**
     * Sheet "4. LEARNING STYLE" — the eight multiple-intelligence columns
     * P..W. Strong is 10 or more out of 12; low is 8 or under.
     */
    public SchoolDashboard.LearningStyleSheet calculateLearningStyle(
            List<PasteDataRow> rows, SchoolDashboard.ClassFilter filter) {

        List<PasteDataRow> safeRows = safe(rows);
        int inView = countStudentsInView(safeRows, filter);
        SchoolDashboard.LearningStyleSheet sheet = new SchoolDashboard.LearningStyleSheet();

        for (int i = 0; i < INTELLIGENCE_COUNT; i++) {
            final int idx = i;
            SchoolDashboard.IntelligenceRow row = new SchoolDashboard.IntelligenceRow();
            row.label = INTELLIGENCE_SHORT_LABELS.get(i) + "  (" + INTELLIGENCE_HEADERS.get(i) + ")";
            row.studentsStrong = countInView(safeRows, filter,
                    r -> atLeast(at(r.intelligences, INTELLIGENCE_COUNT, idx), STRONG_ABILITY_MIN));
            row.studentsLow = countInView(safeRows, filter,
                    r -> atMost(at(r.intelligences, INTELLIGENCE_COUNT, idx), WEAK_ABILITY_MAX));
            row.pctStrong = pct(row.studentsStrong, inView);
            row.pctLow = pct(row.studentsLow, inView);
            row.avgScore = averageInView(safeRows, filter, r -> at(r.intelligences, INTELLIGENCE_COUNT, idx));
            sheet.intelligences.add(row);
        }
        return sheet;
    }

    // ═════════════════════ SHEET 5: ABILITIES ═══════════════════════

    /**
     * Sheet "5. ABILITIES" — the ten ability columns F..O, with the gap column
     * showing how much bigger the weak group is than the strong group.
     */
    public SchoolDashboard.AbilitiesSheet calculateAbilities(
            List<PasteDataRow> rows, SchoolDashboard.ClassFilter filter) {

        List<PasteDataRow> safeRows = safe(rows);
        int inView = countStudentsInView(safeRows, filter);
        SchoolDashboard.AbilitiesSheet sheet = new SchoolDashboard.AbilitiesSheet();

        for (int i = 0; i < ABILITY_COUNT; i++) {
            final int idx = i;
            SchoolDashboard.AbilityRow row = new SchoolDashboard.AbilityRow();
            row.label = ABILITY_HEADERS.get(i);
            row.studentsStrong = countInView(safeRows, filter,
                    r -> atLeast(at(r.abilities, ABILITY_COUNT, idx), STRONG_ABILITY_MIN));
            row.studentsLow = countInView(safeRows, filter,
                    r -> atMost(at(r.abilities, ABILITY_COUNT, idx), WEAK_ABILITY_MAX));
            row.pctStrong = pct(row.studentsStrong, inView);
            row.pctLow = pct(row.studentsLow, inView);
            row.gap = row.pctLow - row.pctStrong;
            row.avgScore = averageInView(safeRows, filter, r -> at(r.abilities, ABILITY_COUNT, idx));
            sheet.abilities.add(row);
        }

        // "ABILITY LOAD PER STUDENT" (rows 17..21) averages the sheet-1 helper
        // columns BD and BE rather than the raw scores.
        sheet.avgAbilities10Plus = averageInView(safeRows, filter, r -> calcOf(r).abilities10Plus);
        sheet.avgAbilities8OrLess = averageInView(safeRows, filter, r -> calcOf(r).abilities8OrLess);
        sheet.studentsWith5PlusWeak = countInView(safeRows, filter,
                r -> atLeast(calcOf(r).abilities8OrLess, WEAK_ABILITY_ALERT));
        sheet.pctWith5PlusWeak = pct(sheet.studentsWith5PlusWeak, inView);
        return sheet;
    }

    // ═══════════════════════ SHEET 6: VALUES ════════════════════════

    /**
     * Sheet "6. VALUES" — share of students placing each work value anywhere in
     * their top five (columns AG:AK).
     *
     * <p>The workbook's SUMPRODUCT counts <em>cells</em>, so a student who
     * listed the same value twice is counted twice; that is preserved here.
     * Rank is Excel's descending RANK: ties share the better rank and the next
     * rank is skipped, and a 0% value has no rank at all.
     */
    public SchoolDashboard.ValuesSheet calculateValues(
            List<PasteDataRow> rows, SchoolDashboard.ClassFilter filter) {

        List<PasteDataRow> safeRows = safe(rows);
        int inView = countStudentsInView(safeRows, filter);
        SchoolDashboard.ValuesSheet sheet = new SchoolDashboard.ValuesSheet();

        for (String label : VALUE_SHEET_LABELS) {
            SchoolDashboard.ValueRow row = new SchoolDashboard.ValueRow();
            row.label = label;
            int hits = 0;
            for (PasteDataRow student : safeRows) {
                if (!filter.includes(student.studentClass)) {
                    continue;
                }
                for (int slot = 0; slot < VALUE_COUNT; slot++) {
                    if (fieldEquals(at(student.values, VALUE_COUNT, slot), label)) {
                        hits++;
                    }
                }
            }
            row.students = hits;
            row.pctInTopFive = pct(hits, inView);
            sheet.values.add(row);
        }

        List<Integer> shares = ints(sheet.values, v -> v.pctInTopFive);
        for (SchoolDashboard.ValueRow row : sheet.values) {
            row.rank = row.pctInTopFive == 0 ? null : rankDescending(shares, row.pctInTopFive);
        }
        return sheet;
    }

    // ═════════════════════ SHEET 7: CAREER GAP ══════════════════════

    /**
     * Sheet "7. CAREER GAP" — where students are suited versus where they want
     * to go, first by stream (columns BB and BC) then by all 24 career
     * clusters.
     *
     * <p>The two halves use different windows on purpose: the stream block
     * looks only at suitability #1 (BB), while the cluster block counts a
     * student as suited if the cluster is in their <em>top three</em>
     * suitability slots (AP:AR), which is what its "Suited (top 3)" header
     * says.
     */
    public SchoolDashboard.CareerGapSheet calculateCareerGap(
            List<PasteDataRow> rows, SchoolDashboard.ClassFilter filter) {

        List<PasteDataRow> safeRows = safe(rows);
        int inView = countStudentsInView(safeRows, filter);
        SchoolDashboard.CareerGapSheet sheet = new SchoolDashboard.CareerGapSheet();

        for (String stream : STREAMS) {
            SchoolDashboard.StreamRow row = new SchoolDashboard.StreamRow();
            row.label = stream;
            row.studentsSuited = countInView(safeRows, filter,
                    r -> fieldEquals(calcOf(r).suitabilityTopStream, stream));
            row.studentsAspiring = countInView(safeRows, filter,
                    r -> fieldEquals(calcOf(r).topAspirationStream, stream));
            row.suitedPct = pct(row.studentsSuited, inView);
            row.aspiringPct = pct(row.studentsAspiring, inView);
            row.gap = row.aspiringPct - row.suitedPct;
            sheet.streams.add(row);
        }

        for (String[] cluster : CAREER_CLUSTERS) {
            SchoolDashboard.ClusterRow row = new SchoolDashboard.ClusterRow();
            row.label = cluster[0];
            row.stream = cluster[1];
            for (PasteDataRow student : safeRows) {
                if (!filter.includes(student.studentClass)) {
                    continue;
                }
                for (int slot = 0; slot < SUITED_TOP_N; slot++) {
                    if (fieldEquals(at(student.suitabilityIndex, SUITABILITY_INDEX_COUNT, slot), row.label)) {
                        row.suitedTop3++;
                    }
                }
                for (int slot = 0; slot < CAREER_ASPIRATION_COUNT; slot++) {
                    if (fieldEquals(at(student.careerAspirations, CAREER_ASPIRATION_COUNT, slot), row.label)) {
                        row.aspiring++;
                    }
                }
            }
            row.gap = row.aspiring - row.suitedTop3;
            row.readinessPct = row.aspiring == 0
                    ? null : pct(Math.min(row.suitedTop3, row.aspiring), row.aspiring);
            sheet.clusters.add(row);
        }
        return sheet;
    }

    // ══════════════════════ SHEET 8: BY CLASS ═══════════════════════

    /**
     * Sheet "8. BY CLASS" — one column per class 6..12. Takes no filter: the
     * sheet deliberately ignores it so the whole school can be compared side by
     * side.
     */
    public SchoolDashboard.ByClassSheet calculateByClass(List<PasteDataRow> rows) {
        List<PasteDataRow> safeRows = safe(rows);
        SchoolDashboard.ByClassSheet sheet = new SchoolDashboard.ByClassSheet();
        sheet.classes.addAll(CLASSES);

        int[] headcount = new int[CLASSES.size()];
        for (int c = 0; c < CLASSES.size(); c++) {
            int studentClass = CLASSES.get(c);
            headcount[c] = countStudentsInClass(safeRows, studentClass);
            sheet.students.add(headcount[c]);

            int clarity = 0, weak5 = 0;
            for (PasteDataRow row : safeRows) {
                if (!inClass(row, studentClass)) {
                    continue;
                }
                PasteDataCalculations calc = calcOf(row);
                if (calc.hasMatch != null) clarity += calc.hasMatch;
                if (calc.abilities8OrLess != null && calc.abilities8OrLess >= WEAK_ABILITY_ALERT) weak5++;
            }
            sheet.careerClarityPct.add(pct(clarity, headcount[c]));
            sheet.fiveOrMoreWeakAbilities.add(weak5);
        }

        for (int i = 0; i < RIASEC_COUNT; i++) {
            final int idx = i;
            String riasecName = RIASEC_HEADERS.get(i);
            sheet.personalityTopTraitPct.add(series(
                    "  " + PERSONALITY_SHORT_LABELS.get(i) + " (" + riasecName + ")",
                    safeRows, headcount,
                    r -> fieldEquals(at(r.personalityTop, PERSONALITY_TOP_COUNT, 0), RIASEC_HEADERS.get(idx))));
        }
        for (int i = 0; i < INTELLIGENCE_COUNT; i++) {
            final int idx = i;
            sheet.learningStyleStrongPct.add(series(
                    "  " + INTELLIGENCE_SHORT_LABELS.get(i), safeRows, headcount,
                    r -> atLeast(at(r.intelligences, INTELLIGENCE_COUNT, idx), STRONG_ABILITY_MIN)));
        }
        for (int i = 0; i < ABILITY_COUNT; i++) {
            final int idx = i;
            sheet.abilityLowPct.add(series(
                    "  " + ABILITY_HEADERS.get(i), safeRows, headcount,
                    r -> atMost(at(r.abilities, ABILITY_COUNT, idx), WEAK_ABILITY_MAX)));
        }
        for (String stream : STREAMS) {
            sheet.streamFitVsWish.add(series("  " + stream + " — suited", safeRows, headcount,
                    r -> fieldEquals(calcOf(r).suitabilityTopStream, stream)));
            sheet.streamFitVsWish.add(series("  " + stream + " — aspiring", safeRows, headcount,
                    r -> fieldEquals(calcOf(r).topAspirationStream, stream)));
        }
        return sheet;
    }

    // ═══════════════════════ SHEET 9: CHARTS ════════════════════════

    /**
     * Sheet "9. CHARTS" — chart-ready copies of numbers already on sheets 2..7.
     * Nothing is recalculated.
     *
     * <p><b>Deviation:</b> the workbook's "Students by class" block reads
     * {@code '2. SUMMARY'!C18:C24} while the class counts actually live in
     * C16:C22, so every class is shown two rows late — "Class 6" displays
     * Class 8's headcount, "Class 11" displays the Total row, and "Class 12"
     * reads an empty cell. This port pairs each class with its own count.
     */
    public SchoolDashboard.ChartsSheet calculateCharts(SchoolDashboard dashboard) {
        SchoolDashboard.ChartsSheet sheet = new SchoolDashboard.ChartsSheet();

        for (int i = 0; i < dashboard.personality.traits.size(); i++) {
            sheet.personalityMix.add(new SchoolDashboard.LabeledValue(
                    PERSONALITY_SHORT_LABELS.get(i), dashboard.personality.traits.get(i).pctAsTopTrait));
        }
        for (int i = 0; i < dashboard.learningStyle.intelligences.size(); i++) {
            sheet.learningStyle.add(new SchoolDashboard.LabeledValue(
                    INTELLIGENCE_SHORT_LABELS.get(i), dashboard.learningStyle.intelligences.get(i).pctStrong));
        }
        for (SchoolDashboard.AbilityRow ability : dashboard.abilities.abilities) {
            sheet.abilities.add(new SchoolDashboard.LabeledPair(
                    ability.label, ability.pctStrong, ability.pctLow));
        }
        for (SchoolDashboard.ValueRow value : dashboard.values.values) {
            sheet.values.add(new SchoolDashboard.LabeledValue(value.label, value.pctInTopFive));
        }
        for (SchoolDashboard.StreamRow stream : dashboard.careerGap.streams) {
            sheet.streamFitVsWish.add(new SchoolDashboard.LabeledPair(
                    stream.label, stream.suitedPct, stream.aspiringPct));
        }
        for (SchoolDashboard.ClassCount classCount : dashboard.summary.studentsByClass) {
            sheet.studentsByClass.add(new SchoolDashboard.LabeledValue(
                    classCount.label, classCount.students));
        }
        return sheet;
    }

    // ═════════════════════════ ORCHESTRATOR ═════════════════════════

    /**
     * Computes the whole workbook: sheet 1's helper columns, then sheets 3..7
     * (which sheet 2's headline block indexes into), then 2, 8 and 9.
     *
     * @param rows   one entry per student, in the order they should appear on
     *               sheet 1; mutated to carry their {@code calculations}
     * @param filter the sheet-2 class filter; null is treated as "All"
     */
    public SchoolDashboard calculateDashboard(List<PasteDataRow> rows, SchoolDashboard.ClassFilter filter) {
        SchoolDashboard.ClassFilter effective = filter != null ? filter : SchoolDashboard.ClassFilter.all();
        List<PasteDataRow> safeRows = safe(rows);

        SchoolDashboard dashboard = new SchoolDashboard();
        dashboard.filter = effective;
        dashboard.rows = safeRows;

        calculateAll(safeRows);
        dashboard.personality = calculatePersonality(safeRows, effective);
        dashboard.learningStyle = calculateLearningStyle(safeRows, effective);
        dashboard.abilities = calculateAbilities(safeRows, effective);
        dashboard.values = calculateValues(safeRows, effective);
        dashboard.careerGap = calculateCareerGap(safeRows, effective);
        dashboard.summary = calculateSummary(safeRows, effective, dashboard.personality,
                dashboard.learningStyle, dashboard.abilities, dashboard.values, dashboard.careerGap);
        dashboard.byClass = calculateByClass(safeRows);
        dashboard.charts = calculateCharts(dashboard);

        logger.info("School dashboard built: {} rows, filter {}, {} students in view",
                safeRows.size(), effective, dashboard.summary.studentsInView);
        return dashboard;
    }

    // ═══════════════════════════ HELPERS ═══════════════════════════

    /**
     * Folds the punctuation differences between the career-aspiration labels and
     * the suitability-pathway names so the two compare equal: case-folded, every
     * run of non-alphanumeric characters collapsed to a single space, trimmed.
     * "Life Sciences /Medicine and Healthcare" and
     * "Life Sciences/Medicine and Healthcare" both become
     * "life sciences medicine and healthcare".
     */
    static String normalizeField(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }

    /** Excel's {@code cell=""} test: null, empty, or whitespace-only. */
    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static String at(String[] array, int index) {
        return array != null && index < array.length ? array[index] : null;
    }

    private static String at(String[] array, int declaredLength, int index) {
        return index < declaredLength ? at(array, index) : null;
    }

    private static Integer at(Integer[] array, int declaredLength, int index) {
        return array != null && index < declaredLength && index < array.length ? array[index] : null;
    }

    private static boolean atLeast(Integer value, int threshold) {
        return value != null && value >= threshold;
    }

    private static boolean atMost(Integer value, int threshold) {
        return value != null && value <= threshold;
    }

    /**
     * Excel's text comparison, which is case-insensitive, further relaxed by
     * {@link #normalizeField(String)} so the two career-field spellings agree.
     * A blank on either side never matches, mirroring COUNTIF.
     */
    private static boolean fieldEquals(String left, String right) {
        return !isBlank(left) && !isBlank(right)
                && normalizeField(left).equals(normalizeField(right));
    }

    /**
     * Sheet 2's {@code COUNTIFS(E,"F",...)}. The workbook wants a bare "M"/"F";
     * matching on the initial also accepts the "Male"/"Female" that
     * {@code StudentInfo.gender} may hold.
     */
    private static boolean isGender(String gender, char initial) {
        return !isBlank(gender) && Character.toUpperCase(gender.trim().charAt(0)) == initial;
    }

    private static List<PasteDataRow> safe(List<PasteDataRow> rows) {
        return rows != null ? rows : Collections.emptyList();
    }

    /**
     * Sheet-1 values for a row, computed on demand so every sheet function can
     * be called on its own without first running {@link #calculateAll(List)}.
     */
    private PasteDataCalculations calcOf(PasteDataRow row) {
        if (row.calculations == null) {
            row.calculations = calculateRow(row);
        }
        return row.calculations;
    }

    /** C8 — {@code COUNTIFS(B,"<>", C,">="&min, C,"<="&max)}. */
    private int countStudentsInView(List<PasteDataRow> rows, SchoolDashboard.ClassFilter filter) {
        int count = 0;
        for (PasteDataRow row : rows) {
            if (!isBlank(row.studentName) && filter.includes(row.studentClass)) {
                count++;
            }
        }
        return count;
    }

    /** {@code COUNTIFS(C,n, B,"<>")} — one class, whole school, filter ignored. */
    private int countStudentsInClass(List<PasteDataRow> rows, int studentClass) {
        int count = 0;
        for (PasteDataRow row : rows) {
            if (inClass(row, studentClass) && !isBlank(row.studentName)) {
                count++;
            }
        }
        return count;
    }

    /** {@code COUNTIFS(C,n)} on its own — no name test, as sheet 8 writes it. */
    private static boolean inClass(PasteDataRow row, int studentClass) {
        return row.studentClass != null && row.studentClass == studentClass;
    }

    private int countInView(List<PasteDataRow> rows, SchoolDashboard.ClassFilter filter,
            Predicate<PasteDataRow> test) {
        int count = 0;
        for (PasteDataRow row : rows) {
            if (filter.includes(row.studentClass) && test.test(row)) {
                count++;
            }
        }
        return count;
    }

    /**
     * {@code AVERAGEIFS(scores, C,">="&min, C,"<="&max)} rounded to 1 decimal,
     * 0 when nothing qualifies. Like AVERAGEIFS, blank scores are skipped
     * rather than counted as zero.
     */
    private double averageInView(List<PasteDataRow> rows, SchoolDashboard.ClassFilter filter,
            Function<PasteDataRow, Integer> score) {
        long sum = 0;
        int n = 0;
        for (PasteDataRow row : rows) {
            if (!filter.includes(row.studentClass)) {
                continue;
            }
            Integer value = score.apply(row);
            if (value != null) {
                sum += value;
                n++;
            }
        }
        return n == 0 ? 0 : round((double) sum / n, 1);
    }

    /** One sheet-8 row: the share of each class matching {@code test}. */
    private SchoolDashboard.LabeledSeries series(String label, List<PasteDataRow> rows,
            int[] headcount, Predicate<PasteDataRow> test) {
        SchoolDashboard.LabeledSeries out = new SchoolDashboard.LabeledSeries(label);
        for (int c = 0; c < CLASSES.size(); c++) {
            int studentClass = CLASSES.get(c);
            int hits = 0;
            for (PasteDataRow row : rows) {
                if (inClass(row, studentClass) && test.test(row)) {
                    hits++;
                }
            }
            out.values.add(pct(hits, headcount[c]));
        }
        return out;
    }

    /** {@code IFERROR(ROUND(n/d*100,0),0)} — the workbook's percentage idiom. */
    private static int pct(double numerator, double denominator) {
        return denominator == 0 ? 0 : (int) round(numerator / denominator * 100, 0);
    }

    /** Excel ROUND: half away from zero, unlike {@link Math#round}'s half up. */
    private static double round(double value, int scale) {
        if (Double.isNaN(value) || Double.isInfinite(value)) {
            return 0;
        }
        return BigDecimal.valueOf(value).setScale(scale, RoundingMode.HALF_UP).doubleValue();
    }

    private static <T> List<String> labels(List<T> items, Function<T, String> label) {
        List<String> out = new ArrayList<>(items.size());
        for (T item : items) {
            out.add(label.apply(item));
        }
        return out;
    }

    private static <T> List<Integer> ints(List<T> items, ToIntFunction<T> value) {
        List<Integer> out = new ArrayList<>(items.size());
        for (T item : items) {
            out.add(value.applyAsInt(item));
        }
        return out;
    }

    private static String labelAt(List<String> labels, int index) {
        return index >= 0 && index < labels.size() ? labels.get(index) : "";
    }

    private static int indexOfMax(List<Integer> values) {
        int best = -1;
        for (int i = 0; i < values.size(); i++) {
            if (best < 0 || values.get(i) > values.get(best)) {
                best = i;
            }
        }
        return best;
    }

    private static int indexOfMin(List<Integer> values) {
        int best = -1;
        for (int i = 0; i < values.size(); i++) {
            if (best < 0 || values.get(i) < values.get(best)) {
                best = i;
            }
        }
        return best;
    }

    /**
     * {@code MATCH(LARGE(range,n), range, 0)}. On a tie this returns the same
     * index for several n, exactly as the workbook's "Dominant" and "Second"
     * personality cells do.
     */
    private static int indexOfNthLargest(List<Integer> values, int n) {
        if (values.isEmpty() || n < 1 || n > values.size()) {
            return -1;
        }
        List<Integer> sorted = new ArrayList<>(values);
        sorted.sort(Comparator.reverseOrder());
        return values.indexOf(sorted.get(n - 1));
    }

    /** Excel {@code RANK(value, range)} with the default descending order. */
    private static int rankDescending(List<Integer> values, int value) {
        int greater = 0;
        for (Integer candidate : values) {
            if (candidate > value) {
                greater++;
            }
        }
        return greater + 1;
    }
}
