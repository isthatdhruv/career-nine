package com.kccitm.api.service.psychometric;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.service.Navigator.NavigatorCoreAnalysis;
import com.kccitm.api.service.Navigator.NavigatorReportGenerationService;
import com.kccitm.api.service.psychometric.PsychometricDataset.Instrument;
import com.kccitm.api.service.psychometric.PsychometricDataset.StudentRecord;

/**
 * Builds the "Psychometric properties of Navigator 360" workbook for a cohort.
 * The delivered file is sheet 1 of the original validation study — the
 * 174-column raw data layout (totals, item-level marks, tops, suitability
 * indices) — one row per selected student; the study's 14 analysis sheets are
 * pruned from the output.
 *
 * <p>The statistical fillers for those pruned sheets (alpha/EFA, item
 * analysis, IRT, norms, CFA screening — see {@link PsychometricAdvancedSheets})
 * remain implemented and tested; {@link #buildWorkbook} documents how to
 * re-enable them.
 */
@Service
public class PsychometricPropertiesExportService {

    private static final Logger logger = LoggerFactory.getLogger(PsychometricPropertiesExportService.class);

    private static final String TEMPLATE_PATH = "/psychometric-template/psychometric-properties-template.xlsx";

    /** Keys into IntermediaryScores.miScores, in template column order. */
    private static final String[] MI_SCORE_KEYS = {
            "Bodily-Kinesthetic", "Interpersonal", "Intrapersonal", "Linguistic",
            "Logical-Mathematical", "Musical", "Visual-Spatial", "Naturalistic"};

    @Autowired private StudentAssessmentMappingRepository mappingRepository;
    @Autowired private NavigatorReportGenerationService navigatorReportGenerationService;
    @Autowired private NavigatorCoreAnalysis navigatorCoreAnalysis;

    @Transactional(readOnly = true)
    public byte[] export(Long assessmentId, List<Long> userStudentIds) throws IOException {
        PsychometricDataset dataset = buildDataset(assessmentId, userStudentIds);
        if (dataset.records.isEmpty()) {
            return null;
        }

        // A BET (or other non-Navigator) assessment has none of the Navigator
        // sections, so every column would be 0/blank — refuse with a clear
        // message instead of producing a useless sheet.
        boolean hasNavigatorSections = dataset.records.stream().anyMatch(
                r -> r.riasecItems.length > 0 || r.aptitudeItems.length > 0 || r.miItems.length > 0);
        if (!hasNavigatorSections) {
            throw new IllegalArgumentException(
                    "This assessment has no Navigator 360 sections (RIASEC / Aptitude / Multiple"
                    + " Intelligence). The psychometric properties export only works for Navigator"
                    + " assessments — for BET data use Generate Data Excel or BET Core Data.");
        }

        try (InputStream in = getClass().getResourceAsStream(TEMPLATE_PATH)) {
            if (in == null) {
                throw new IllegalStateException("Missing resource " + TEMPLATE_PATH);
            }
            try (XSSFWorkbook wb = new XSSFWorkbook(in)) {
                buildWorkbook(wb, dataset);
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                wb.write(out);
                return out.toByteArray();
            }
        }
    }

    /**
     * Fills the raw data sheet and prunes every other sheet: the delivered
     * workbook is only sheet 1 of the original study. The statistical fillers
     * ({@link #fillPsychometricAnalysis} etc. and
     * {@link PsychometricAdvancedSheets}) are kept but intentionally not
     * invoked — re-add their calls here (and stop pruning) to ship the full
     * validation-study workbook again.
     */
    void buildWorkbook(XSSFWorkbook wb, PsychometricDataset dataset) {
        fillRawData(wb, dataset);
        while (wb.getNumberOfSheets() > 1) {
            wb.removeSheetAt(wb.getNumberOfSheets() - 1);
        }
        wb.setActiveSheet(0);
        wb.setSelectedTab(0);
    }

    // ═══════════════════════ dataset assembly ═══════════════════════

    private PsychometricDataset buildDataset(Long assessmentId, List<Long> userStudentIds) {
        Set<Long> wanted = userStudentIds != null && !userStudentIds.isEmpty()
                ? new HashSet<>(userStudentIds) : null;
        Set<Long> seen = new HashSet<>();

        List<StudentAssessmentMapping> mappings = mappingRepository.findAllByAssessmentId(assessmentId).stream()
                .filter(m -> m.getUserStudent() != null
                          && (wanted == null || wanted.contains(m.getUserStudent().getUserStudentId()))
                          && seen.add(m.getUserStudent().getUserStudentId()))
                .collect(Collectors.toList());

        NavigatorReportGenerationService.AssessmentScoringContext ctx =
                navigatorReportGenerationService.buildScoringContext(assessmentId);

        PsychometricDataset dataset = new PsychometricDataset();
        dataset.riasecStatements = navigatorReportGenerationService.riasecQuestionTexts(ctx);
        int skipped = 0;

        for (StudentAssessmentMapping mapping : mappings) {
            UserStudent student = mapping.getUserStudent();
            NavigatorReportGenerationService.IntermediaryScores scores;
            try {
                scores = navigatorReportGenerationService
                        .computeIntermediaryScores(student.getUserStudentId(), assessmentId, ctx);
            } catch (Exception e) {
                logger.warn("Psychometric export: scoring failed for student {}: {}",
                        student.getUserStudentId(), e.getMessage());
                scores = null;
            }
            if (scores == null) {
                skipped++;
                continue;
            }
            dataset.records.add(toRecord(student, scores, ctx));
        }

        logger.info("Psychometric export: {} students scored, {} skipped for assessment {}",
                dataset.records.size(), skipped, assessmentId);
        return dataset;
    }

    private StudentRecord toRecord(UserStudent student,
            NavigatorReportGenerationService.IntermediaryScores scores,
            NavigatorReportGenerationService.AssessmentScoringContext ctx) {

        StudentRecord r = new StudentRecord();
        StudentInfo info = student.getStudentInfo();

        r.school = student.getInstitute() != null && student.getInstitute().getInstituteName() != null
                ? student.getInstitute().getInstituteName() : "";
        r.name = info != null && info.getName() != null ? info.getName() : safe(scores.studentName);
        r.studentClass = info != null && info.getStudentClass() != null
                ? info.getStudentClass() : parseClass(scores.studentClass);
        r.band = PsychometricDataset.bandOf(r.studentClass);

        for (int i = 0; i < MI_SCORE_KEYS.length; i++) {
            r.miTotals[i] = get(scores.miScores, MI_SCORE_KEYS[i]);
        }
        for (int i = 0; i < PsychometricDataset.ABILITY_NAMES.length; i++) {
            r.abilityTotals[i] = get(scores.aptitudeScores, PsychometricDataset.ABILITY_NAMES[i]);
        }
        for (int i = 0; i < PsychometricDataset.RIASEC_LETTERS.length; i++) {
            r.riasecTotals[i] = get(scores.riasecScores, PsychometricDataset.RIASEC_LETTERS[i]);
        }

        copyInto(r.soi, scores.selectedSOIs);
        copyInto(r.values, scores.selectedValues);
        copyInto(r.aspirations, scores.selectedCareerAsps);

        NavigatorReportGenerationService.ItemLevelMarks marks =
                navigatorReportGenerationService.computeItemLevelMarks(student.getUserStudentId(), ctx);
        r.riasecItems = marks.riasec;
        r.aptitudeItems = marks.aptitude;
        r.miItems = marks.mi;

        try {
            NavigatorCoreAnalysis.CoreAnalysisResult core = navigatorCoreAnalysis.analyze(
                    scores.riasecScores, scores.miScores, scores.aptitudeScores,
                    scores.studentClass, scores.selectedSOIs, scores.selectedValues,
                    scores.selectedCareerAsps);
            r.personalityTop[0] = core.personalityTop1;
            r.personalityTop[1] = core.personalityTop2;
            r.personalityTop[2] = core.personalityTop3;
            r.intelligenceTop[0] = core.intelligenceTop1;
            r.intelligenceTop[1] = core.intelligenceTop2;
            r.intelligenceTop[2] = core.intelligenceTop3;
            r.abilityTop[0] = core.abilityTop1;
            r.abilityTop[1] = core.abilityTop2;
            r.abilityTop[2] = core.abilityTop3;
            r.abilityTop[3] = core.abilityTop4;
            r.abilityTop[4] = core.abilityTop5;
            if (core.suitabilityIndex != null) {
                for (int i = 0; i < r.suitabilityIndex.length && i < core.suitabilityIndex.length; i++) {
                    r.suitabilityIndex[i] = core.suitabilityIndex[i];
                }
            }
        } catch (Exception e) {
            logger.warn("Psychometric export: core analysis failed for student {}: {}",
                    student.getUserStudentId(), e.getMessage());
        }
        return r;
    }

    // ═══════════════════════ Sheet: raw data ═══════════════════════

    /** First of the 54 RIASEC item columns (R1) on the raw data sheet. */
    private static final int RIASEC_ITEM_FIRST_COL = 44;

    void fillRawData(XSSFWorkbook wb, PsychometricDataset ds) {
        Sheet sheet = Xl.sheet(wb, "Psychometric properties of Navi");

        // Personality item headers carry the full statement: "R1 (I enjoy ...)"
        for (int q = 0; q < 54 && q < ds.riasecStatements.length; q++) {
            String statement = ds.riasecStatements[q];
            if (statement != null && !statement.trim().isEmpty()) {
                Xl.text(sheet, 1, RIASEC_ITEM_FIRST_COL + q,
                        PsychometricDataset.RIASEC_ITEM_LABELS[q] + " (" + statement.trim() + ")");
            }
        }

        int rowNum = 2;
        for (StudentRecord r : ds.records) {
            int col = 1;
            Xl.text(sheet, rowNum, col++, r.school);
            Xl.text(sheet, rowNum, col++, r.name);
            Xl.num(sheet, rowNum, col++, r.studentClass);
            for (Integer v : r.miTotals) Xl.num(sheet, rowNum, col++, v);
            for (Integer v : r.abilityTotals) Xl.num(sheet, rowNum, col++, v);
            for (Integer v : r.riasecTotals) Xl.num(sheet, rowNum, col++, v);
            Xl.text(sheet, rowNum, col++, "Keep");
            for (String s : r.soi) Xl.text(sheet, rowNum, col++, s);
            for (String s : r.values) Xl.text(sheet, rowNum, col++, s);
            for (String s : r.aspirations) Xl.text(sheet, rowNum, col++, s);
            col = writeItems(sheet, rowNum, col, r.riasecItems, 54);
            col = writeItems(sheet, rowNum, col, r.aptitudeItems, 30);
            col = writeItems(sheet, rowNum, col, r.miItems, 24);
            for (String s : r.personalityTop) Xl.text(sheet, rowNum, col++, s);
            for (String s : r.intelligenceTop) Xl.text(sheet, rowNum, col++, s);
            for (String s : r.abilityTop) Xl.text(sheet, rowNum, col++, s);
            for (String s : r.suitabilityIndex) Xl.text(sheet, rowNum, col++, s);
            rowNum++;
        }
    }

    private int writeItems(Sheet sheet, int rowNum, int col, Integer[] items, int width) {
        for (int i = 0; i < width; i++) {
            Xl.num(sheet, rowNum, col++, i < items.length ? items[i] : null);
        }
        return col;
    }

    // ═══════════════════════ Sheet: Psychometric Analysis ═══════════════════════

    void fillPsychometricAnalysis(XSSFWorkbook wb, PsychometricDataset ds) {
        Sheet sheet = Xl.sheet(wb, "Psychometric Analysis");

        double[][][] complete = new double[3][][]; // [band] riasec complete cases
        double[] alphaR = new double[3], alphaA = new double[3], alphaM = new double[3];
        for (int b = 0; b < 3; b++) {
            double[][] riasec = PsychometricStats.completeCases(ds.itemRows(b, Instrument.RIASEC), 54);
            double[][] apt = PsychometricStats.completeCases(ds.itemRows(b, Instrument.APTITUDE), 30);
            double[][] mi = PsychometricStats.completeCases(ds.itemRows(b, Instrument.MI), 24);
            complete[b] = riasec;
            alphaR[b] = PsychometricStats.cronbachAlpha(riasec);
            alphaA[b] = PsychometricStats.cronbachAlpha(apt);
            alphaM[b] = PsychometricStats.cronbachAlpha(mi);

            // Section 1: sample sizes
            Xl.num(sheet, 5 + b, 2, complete[b].length);
            Xl.num(sheet, 5 + b, 3, 54);
            Xl.num(sheet, 5 + b, 4, 30);
            Xl.num(sheet, 5 + b, 5, 24);

            // Section 3: EFA rows (20-28: band-major, instrument-minor)
            int base = 20 + b * 3;
            fillEfaRow(sheet, base, riasec, 54);
            fillEfaRow(sheet, base + 1, apt, 30);
            fillEfaRow(sheet, base + 2, mi, 24);

            // Section 4: eigenvalue tables
            fillEigenRow(sheet, 35 + b, riasec, 54, 17);
            fillEigenRow(sheet, 41 + b, apt, 30, 8);
            fillEigenRow(sheet, 47 + b, mi, 24, 6);
        }

        // Section 2: Cronbach's alpha
        fillAlphaRow(sheet, 12, 54, alphaR);
        fillAlphaRow(sheet, 13, 30, alphaA);
        fillAlphaRow(sheet, 14, 24, alphaM);

        // Narrative headline numbers (Section 5)
        int total = ds.records.size();
        Xl.text(sheet, 67, 1, "We tested this assessment across " + String.format("%,d", total)
                + " students in three age groups:");
        Xl.text(sheet, 68, 1, "   • Grades 6–8 (" + ds.inBand(0).size() + " students)    • Grades 9–10 ("
                + ds.inBand(1).size() + " students)    • Grades 11–12 (" + ds.inBand(2).size() + " students)");
        writeAlphaBullets(sheet, 86, alphaR);
        writeAlphaBullets(sheet, 92, alphaA);
        writeAlphaBullets(sheet, 98, alphaM);
    }

    private void fillAlphaRow(Sheet sheet, int row, int items, double[] alphas) {
        Xl.num(sheet, row, 2, items);
        for (int b = 0; b < 3; b++) Xl.num(sheet, row, 3 + b, alphas[b], 4);
        String hi = alphaClass(PsychometricStats.max(alphas));
        String lo = alphaClass(PsychometricStats.min(alphas));
        Xl.text(sheet, row, 6, hi.equals(lo) ? hi : hi + " / " + lo);
    }

    private void writeAlphaBullets(Sheet sheet, int startRow, double[] alphas) {
        for (int b = 0; b < 3; b++) {
            String label = b == 0 ? "Grades 6–8:  " : b == 1 ? "Grades 9–10: " : "Grades 11–12:";
            String cls = alphaClass(alphas[b]).toUpperCase();
            String value = Double.isNaN(alphas[b]) ? "n/a" : String.format("%.2f", alphas[b]);
            Xl.text(sheet, startRow + b, 1, "   • " + label + "  α = " + value + "  →  " + cls + ".");
        }
    }

    private static String alphaClass(double a) {
        if (Double.isNaN(a)) return "n/a";
        if (a >= 0.9) return "Excellent";
        if (a >= 0.8) return "Good";
        if (a >= 0.7) return "Acceptable";
        if (a >= 0.6) return "Questionable";
        return "Poor";
    }

    private void fillEfaRow(Sheet sheet, int row, double[][] complete, int items) {
        Xl.num(sheet, row, 3, complete.length);
        Xl.num(sheet, row, 4, items);
        if (complete.length < items + 2) {
            Xl.blank(sheet, row, 5);
            Xl.blank(sheet, row, 6);
            Xl.blank(sheet, row, 7);
            Xl.text(sheet, row, 8, "Sample too small for EFA");
            return;
        }
        double[] eig = PsychometricStats.eigenvaluesDescending(PsychometricStats.correlationMatrix(complete));
        int factors = 0;
        double retained = 0;
        for (double e : eig) {
            if (e > 1.0) {
                factors++;
                retained += e;
            }
        }
        Xl.num(sheet, row, 5, PsychometricStats.kmo(complete), 4);
        Xl.num(sheet, row, 6, factors);
        Xl.num(sheet, row, 7, retained / items * 100.0, 2);
        Xl.text(sheet, row, 8, factors > 10 ? "Multi-factor structure" : factors + "-factor structure");
    }

    private void fillEigenRow(Sheet sheet, int row, double[][] complete, int items, int maxCols) {
        double[] eig = complete.length >= items + 2
                ? PsychometricStats.eigenvaluesDescending(PsychometricStats.correlationMatrix(complete))
                : new double[0];
        double retained = 0;
        int written = 0;
        for (int f = 0; f < maxCols; f++) {
            if (f < eig.length && eig[f] > 1.0) {
                Xl.num(sheet, row, 2 + f, eig[f], 4);
                retained += eig[f];
                written++;
            } else {
                Xl.blank(sheet, row, 2 + f);
            }
        }
        if (written > 0) {
            Xl.num(sheet, row, 2 + maxCols, retained / items * 100.0, 2);
        } else {
            Xl.blank(sheet, row, 2 + maxCols);
        }
    }

    // ═══════════════════════ Sheet: Item Analysis ═══════════════════════

    private static final int[][] IA_BLOCKS = {
            // {titleRow, band, instrumentOrdinal}; item rows start at titleRow + 2
            {22, 0, 0}, {80, 0, 1}, {114, 0, 2},
            {142, 1, 0}, {200, 1, 1}, {234, 1, 2},
            {262, 2, 0}, {320, 2, 1}, {354, 2, 2}};

    void fillItemAnalysis(XSSFWorkbook wb, PsychometricDataset ds) {
        Sheet sheet = Xl.sheet(wb, "Item Analysis");
        Instrument[] instruments = {Instrument.RIASEC, Instrument.APTITUDE, Instrument.MI};
        String[] instrumentNames = {"RIASEC", "Skills", "Multiple Intelligence"};

        for (int[] block : IA_BLOCKS) {
            int titleRow = block[0];
            int band = block[1];
            Instrument inst = instruments[block[2]];
            double[][] complete = PsychometricStats.completeCases(ds.itemRows(band, inst), inst.itemCount);

            Xl.text(sheet, titleRow, 1, PsychometricDataset.BAND_DISPLAY[band] + " — " + instrumentNames[block[2]]
                    + " (N=" + complete.length + ", Items=" + inst.itemCount + ", Max Score=" + inst.maxScore + ")");

            double sumP = 0, sumD = 0;
            double minP = Double.NaN, maxP = Double.NaN, minD = Double.NaN, maxD = Double.NaN;
            for (int q = 0; q < inst.itemCount; q++) {
                int row = titleRow + 2 + q;
                double mean = complete.length > 0
                        ? PsychometricStats.mean(PsychometricStats.column(complete, q)) : Double.NaN;
                double p = mean / inst.maxScore;
                double citc = complete.length > 2 ? PsychometricStats.correctedItemTotal(complete, q) : Double.NaN;

                Xl.num(sheet, row, 1, q + 1);
                Xl.text(sheet, row, 2, itemLabel(inst, q));
                Xl.num(sheet, row, 3, mean, 4);
                Xl.num(sheet, row, 4, p, 4);
                Xl.num(sheet, row, 5, citc, 4);
                Xl.text(sheet, row, 6, difficultyClass(p) + " / " + discriminationClass(citc));

                if (!Double.isNaN(p)) {
                    sumP += p;
                    minP = Double.isNaN(minP) ? p : Math.min(minP, p);
                    maxP = Double.isNaN(maxP) ? p : Math.max(maxP, p);
                }
                if (!Double.isNaN(citc)) {
                    sumD += citc;
                    minD = Double.isNaN(minD) ? citc : Math.min(minD, citc);
                    maxD = Double.isNaN(maxD) ? citc : Math.max(maxD, citc);
                }
            }

            // Summary table rows 5-13: band-major (3 rows per band, instrument order)
            int summaryRow = 5 + band * 3 + block[2];
            Xl.text(sheet, summaryRow, 1, block[2] == 0 ? PsychometricDataset.BAND_DISPLAY[band] : "");
            Xl.text(sheet, summaryRow, 2, instrumentNames[block[2]]);
            Xl.num(sheet, summaryRow, 3, complete.length);
            Xl.num(sheet, summaryRow, 4, inst.itemCount);
            Xl.num(sheet, summaryRow, 5, sumP / inst.itemCount, 4);
            Xl.num(sheet, summaryRow, 6, sumD / inst.itemCount, 4);
            Xl.text(sheet, summaryRow, 7, range2(minP, maxP));
            Xl.text(sheet, summaryRow, 8, range2(minD, maxD));
        }
    }

    static String itemLabel(Instrument inst, int qIdx) {
        switch (inst) {
            case RIASEC: return PsychometricDataset.RIASEC_ITEM_LABELS[qIdx];
            case APTITUDE: return PsychometricDataset.aptitudeItemLabel(qIdx);
            default: return PsychometricDataset.miItemLabel(qIdx);
        }
    }

    static String difficultyClass(double p) {
        if (Double.isNaN(p)) return "n/a";
        if (p < 0.30) return "Difficult";
        if (p <= 0.70) return "Moderate";
        return "Easy";
    }

    static String discriminationClass(double d) {
        if (Double.isNaN(d)) return "n/a";
        if (d >= 0.40) return "Very Good";
        if (d >= 0.30) return "Good";
        if (d >= 0.20) return "Acceptable";
        return "Poor";
    }

    private static String range2(double lo, double hi) {
        if (Double.isNaN(lo) || Double.isNaN(hi)) return "";
        return String.format("%.2f - %.2f", lo, hi);
    }

    // ═══════════════════════ Sheet1: percentile norms & T-scores ═══════════════════════

    void fillNorms(XSSFWorkbook wb, PsychometricDataset ds) {
        Sheet sheet = Xl.sheet(wb, "Sheet1");

        double[][] mi = totalsMatrix(ds, 0);
        double[][] abil = totalsMatrix(ds, 1);
        double[][] riasec = totalsMatrix(ds, 2);

        double[] miMeans = normBlock(sheet, 5, mi, 8);
        double[] abilMeans = normBlock(sheet, 20, abil, 10);
        double[] riasecMeans = normBlock(sheet, 35, riasec, 6);

        double[] miSds = sds(mi, 8);
        double[] abilSds = sds(abil, 10);
        double[] riasecSds = sds(riasec, 6);

        // T-score conversion tables
        for (int raw = 0; raw <= 12; raw++) {
            for (int j = 0; j < 8; j++) Xl.num(sheet, 54 + raw, 2 + j, tScore(raw, miMeans[j], miSds[j]), 0);
            for (int j = 0; j < 10; j++) Xl.num(sheet, 71 + raw, 2 + j, tScore(raw, abilMeans[j], abilSds[j]), 0);
        }
        for (int raw = 9; raw <= 18; raw++) {
            for (int j = 0; j < 6; j++) {
                Xl.num(sheet, 88 + (raw - 9), 2 + j, tScore(raw, riasecMeans[j], riasecSds[j]), 0);
            }
        }
    }

    /** which: 0 = MI totals, 1 = ability totals, 2 = RIASEC totals. */
    private double[][] totalsMatrix(PsychometricDataset ds, int which) {
        List<double[]> rows = new ArrayList<>();
        for (StudentRecord r : ds.records) {
            Integer[] src = which == 0 ? r.miTotals : which == 1 ? r.abilityTotals : r.riasecTotals;
            double[] row = new double[src.length];
            boolean ok = true;
            for (int i = 0; i < src.length; i++) {
                if (src[i] == null) {
                    ok = false;
                    break;
                }
                row[i] = src[i];
            }
            if (ok) rows.add(row);
        }
        return rows.toArray(new double[0][]);
    }

    private double[] normBlock(Sheet sheet, int firstRow, double[][] data, int cols) {
        double[] means = new double[cols];
        double[] percentiles = {5, 10, 25, 50, 75, 90, 95};
        for (int j = 0; j < cols; j++) {
            double[] col = data.length > 0 ? PsychometricStats.column(data, j) : new double[0];
            means[j] = PsychometricStats.mean(col);
            Xl.num(sheet, firstRow, 2 + j, data.length);
            Xl.num(sheet, firstRow + 1, 2 + j, means[j], 2);
            Xl.num(sheet, firstRow + 2, 2 + j, PsychometricStats.sd(col), 2);
            Xl.num(sheet, firstRow + 3, 2 + j, PsychometricStats.min(col), 0);
            Xl.num(sheet, firstRow + 4, 2 + j, PsychometricStats.max(col), 0);
            for (int p = 0; p < percentiles.length; p++) {
                Xl.num(sheet, firstRow + 5 + p, 2 + j, PsychometricStats.percentile(col, percentiles[p]), 1);
            }
        }
        return means;
    }

    private double[] sds(double[][] data, int cols) {
        double[] out = new double[cols];
        for (int j = 0; j < cols; j++) {
            out[j] = data.length > 1 ? PsychometricStats.sd(PsychometricStats.column(data, j)) : Double.NaN;
        }
        return out;
    }

    private double tScore(int raw, double mean, double sd) {
        if (Double.isNaN(mean) || Double.isNaN(sd) || sd == 0) return Double.NaN;
        return Math.round(50 + 10 * (raw - mean) / sd);
    }

    // ═══════════════════════ Sheet: Predictive Analysis ═══════════════════════

    void fillPredictive(XSSFWorkbook wb, PsychometricDataset ds) {
        Sheet sheet = Xl.sheet(wb, "Predictive Analysis");

        double[] abilityTotal = ds.records.stream().mapToDouble(StudentRecord::abilityTotal).toArray();
        double[] miTotal = ds.records.stream().mapToDouble(StudentRecord::miTotal).toArray();
        double[] riasecTotal = ds.records.stream().mapToDouble(StudentRecord::riasecTotal).toArray();

        double r1 = PsychometricStats.pearson(abilityTotal, miTotal);
        double r2 = PsychometricStats.pearson(riasecTotal, miTotal);
        double r3 = PsychometricStats.pearson(abilityTotal, riasecTotal);
        Xl.num(sheet, 6, 2, r1, 4);
        Xl.num(sheet, 7, 2, r2, 4);
        Xl.num(sheet, 8, 2, r3, 4);
        Xl.text(sheet, 6, 5, strength(r1));
        Xl.text(sheet, 7, 5, strength(r2));
        Xl.text(sheet, 8, 5, strength(r3));

        // Ability x MI cross-correlation matrix under the row-13 header
        for (int i = 0; i < 10; i++) {
            Xl.text(sheet, 14 + i, 1, PsychometricDataset.ABILITY_NAMES[i]);
            for (int j = 0; j < 8; j++) {
                double[] ai = new double[ds.records.size()];
                double[] mj = new double[ds.records.size()];
                int n = 0;
                for (StudentRecord r : ds.records) {
                    if (r.abilityTotals[i] != null && r.miTotals[j] != null) {
                        ai[n] = r.abilityTotals[i];
                        mj[n] = r.miTotals[j];
                        n++;
                    }
                }
                double[] x = new double[n], y = new double[n];
                System.arraycopy(ai, 0, x, 0, n);
                System.arraycopy(mj, 0, y, 0, n);
                Xl.num(sheet, 14 + i, 2 + j, PsychometricStats.pearson(x, y), 3);
            }
        }
    }

    private static String strength(double r) {
        double a = Math.abs(r);
        if (Double.isNaN(r)) return "";
        if (a >= 0.5) return "Moderate-Strong";
        if (a >= 0.4) return "Moderate";
        if (a >= 0.3) return "Weak-Moderate";
        return "Weak";
    }

    // ═══════════════════════ helpers ═══════════════════════

    private static Integer get(Map<String, Integer> map, String key) {
        return map != null ? map.get(key) : null;
    }

    private static void copyInto(String[] target, List<String> source) {
        if (source == null) return;
        for (int i = 0; i < target.length && i < source.size(); i++) {
            target[i] = source.get(i);
        }
    }

    private static Integer parseClass(String studentClass) {
        if (studentClass == null) return null;
        try {
            return Integer.valueOf(studentClass.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String safe(String s) {
        return s != null ? s : "";
    }
}
