package com.kccitm.api.service.psychometric;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;

import com.kccitm.api.service.psychometric.PsychometricDataset.Instrument;
import com.kccitm.api.service.psychometric.PsychometricDataset.StudentRecord;

/**
 * Fillers for the heavier sheets of the psychometric properties workbook:
 * IRT Analysis by Grade, the four CFA-style item screening sheets, Engineering
 * Patterns and the Psychometric Study career analysis. Layout constants mirror
 * the bundled template row-for-row; narrative sections between the tables are
 * left as authored in the original study.
 */
final class PsychometricAdvancedSheets {

    private PsychometricAdvancedSheets() {
    }

    // ═══════════════════════ IRT Analysis by Grade ═══════════════════════

    static void fillIrt(Workbook wb, PsychometricDataset ds) {
        Sheet sheet = Xl.sheet(wb, "IRT Analysis by Grade");
        String[] domainNames = {"RIASEC Interest Items", "Aptitude Items", "Multiple Intelligence Items"};
        Instrument[] instruments = {Instrument.RIASEC, Instrument.APTITUDE, Instrument.MI};

        int row = 2;
        for (int band = 0; band < 3; band++) {
            int groupN = ds.inBand(band).size();
            for (int d = 0; d < instruments.length; d++) {
                Instrument inst = instruments[d];
                Integer[][] rows = ds.itemRows(band, inst);
                double[][] complete = PsychometricStats.completeCases(rows, inst.itemCount);
                double alpha = PsychometricStats.cronbachAlpha(complete);

                for (int q = 0; q < inst.itemCount; q++) {
                    double[] valid = PsychometricStats.validColumn(rows, q);
                    double mean = PsychometricStats.mean(valid);
                    double itemTotalR = complete.length > 2
                            ? PsychometricStats.itemTotalCorrelation(complete, q) : Double.NaN;
                    double citc = complete.length > 2
                            ? PsychometricStats.correctedItemTotal(complete, q) : Double.NaN;

                    Xl.text(sheet, row, 1, PsychometricDataset.BAND_LABELS[band]);
                    Xl.text(sheet, row, 2, domainNames[d]);
                    Xl.text(sheet, row, 3, PsychometricPropertiesExportService.itemLabel(inst, q));
                    Xl.num(sheet, row, 4, groupN);
                    Xl.num(sheet, row, 5, valid.length);
                    Xl.num(sheet, row, 6, mean, 4);
                    Xl.num(sheet, row, 7, PsychometricStats.sd(valid), 4);
                    Xl.num(sheet, row, 8, PsychometricStats.skewness(valid), 4);
                    Xl.num(sheet, row, 9, PsychometricStats.excessKurtosis(valid), 4);

                    if (inst == Instrument.RIASEC) {
                        double p = endorsedShare(valid);
                        Xl.num(sheet, row, 10, p, 4);
                        Xl.num(sheet, row, 11, PsychometricStats.logitDifficulty(p), 4);
                        Xl.num(sheet, row, 13, 0.5, 4);
                        Xl.blank(sheet, row, 14);
                        Xl.blank(sheet, row, 15);
                        Xl.blank(sheet, row, 16);
                    } else {
                        Xl.blank(sheet, row, 10);
                        Xl.num(sheet, row, 11, -(mean - 2.0), 4);
                        Xl.blank(sheet, row, 13);
                        // GRM thresholds over the observed category range
                        double base = PsychometricStats.min(valid) <= 0 ? 1 : 2;
                        for (int k = 0; k < 3; k++) {
                            Xl.num(sheet, row, 14 + k, PsychometricStats.grmThreshold(valid, base + k), 4);
                        }
                    }
                    Xl.num(sheet, row, 12, PsychometricStats.discriminationFromR(itemTotalR), 4);
                    Xl.num(sheet, row, 17, itemTotalR, 4);
                    Xl.num(sheet, row, 18, citc, 4);
                    Xl.num(sheet, row, 19, alpha, 4);
                    Xl.num(sheet, row, 20, complete.length > 2
                            ? PsychometricStats.alphaIfDeleted(complete, q) : Double.NaN, 4);
                    row++;
                }
            }
        }
    }

    private static double endorsedShare(double[] valid) {
        if (valid.length == 0) return Double.NaN;
        int yes = 0;
        for (double v : valid) {
            if (v == 2) yes++;
        }
        return (double) yes / valid.length;
    }

    // ═══════════════════════ CFA — RIASEC Item Analysis ═══════════════════════

    private static class ItemScreen {
        int qIdx;
        String label;
        int factor;         // scale index
        int n;
        double mean, sd, citc, maxCross;
        double[] cross;     // vs each scale total; own slot NaN
        double alphaIfDeleted;
        String decision;    // REMOVE / REVISE / RETAIN
        String issues;
    }

    /**
     * Item screening for one instrument: CITC within the item's own subscale,
     * cross-correlations against every other subscale's total, and the
     * template's removal rule (REMOVE when CITC &lt; 0.20, or CITC &lt; 0.30
     * with a larger cross-loading; RETAIN at CITC &ge; 0.30).
     */
    private static List<ItemScreen> screenItems(PsychometricDataset ds, int band, Instrument inst,
            int scaleCount, java.util.function.IntUnaryOperator scaleOf) {
        Integer[][] rows = ds.itemRows(band, inst);
        List<ItemScreen> out = new ArrayList<>();

        // Per-student subscale totals over answered items
        int nStudents = rows.length;
        double[][] scaleTotals = new double[nStudents][scaleCount];
        for (int s = 0; s < nStudents; s++) {
            for (int q = 0; q < inst.itemCount; q++) {
                if (rows[s][q] != null) scaleTotals[s][scaleOf.applyAsInt(q)] += rows[s][q];
            }
        }

        // Complete-case matrices per subscale for CITC / alpha-if-deleted
        Map<Integer, List<Integer>> scaleItems = new LinkedHashMap<>();
        for (int q = 0; q < inst.itemCount; q++) {
            scaleItems.computeIfAbsent(scaleOf.applyAsInt(q), k -> new ArrayList<>()).add(q);
        }

        for (int q = 0; q < inst.itemCount; q++) {
            int scale = scaleOf.applyAsInt(q);
            List<Integer> siblings = scaleItems.get(scale);

            ItemScreen is = new ItemScreen();
            is.qIdx = q;
            is.factor = scale;
            is.label = PsychometricPropertiesExportService.itemLabel(inst, q);
            double[] valid = PsychometricStats.validColumn(rows, q);
            is.n = valid.length;
            is.mean = PsychometricStats.mean(valid);
            is.sd = PsychometricStats.sd(valid);

            // CITC within own subscale (pairwise: rows where item + all siblings present)
            double[][] sub = subscaleMatrix(rows, siblings);
            int pos = siblings.indexOf(q);
            is.citc = sub.length > 2 ? PsychometricStats.correctedItemTotal(sub, pos) : Double.NaN;
            is.alphaIfDeleted = sub.length > 2 && siblings.size() > 2
                    ? PsychometricStats.alphaIfDeleted(sub, pos) : Double.NaN;

            // Cross-correlations vs the other subscale totals (pairwise valid rows)
            is.cross = new double[scaleCount];
            Arrays.fill(is.cross, Double.NaN);
            is.maxCross = Double.NaN;
            for (int sc = 0; sc < scaleCount; sc++) {
                if (sc == scale) continue;
                double[] x = new double[nStudents], y = new double[nStudents];
                int n = 0;
                for (int s = 0; s < nStudents; s++) {
                    if (rows[s][q] != null) {
                        x[n] = rows[s][q];
                        y[n] = scaleTotals[s][sc];
                        n++;
                    }
                }
                double r = PsychometricStats.pearson(Arrays.copyOf(x, n), Arrays.copyOf(y, n));
                is.cross[sc] = r;
                if (!Double.isNaN(r) && (Double.isNaN(is.maxCross) || r > is.maxCross)) {
                    is.maxCross = r;
                }
            }

            boolean crossBeatsOwn = !Double.isNaN(is.maxCross) && !Double.isNaN(is.citc)
                    && is.maxCross > is.citc;
            if (Double.isNaN(is.citc)) {
                is.decision = "REVISE";
                is.issues = "Insufficient data";
            } else if (is.citc < 0.20 || (is.citc < 0.30 && crossBeatsOwn)) {
                is.decision = "REMOVE";
                is.issues = join(is.citc < 0.20 ? "Very low CITC" : "Low CITC",
                        crossBeatsOwn ? "Cross-loads on another factor" : null);
            } else if (is.citc >= 0.30) {
                is.decision = "RETAIN";
                is.issues = crossBeatsOwn ? "Cross-loads on another factor" : "";
            } else {
                is.decision = "REVISE";
                is.issues = join("Low CITC", crossBeatsOwn ? "Cross-loads on another factor" : null);
            }
            out.add(is);
        }
        return out;
    }

    private static double[][] subscaleMatrix(Integer[][] rows, List<Integer> items) {
        List<double[]> out = new ArrayList<>();
        for (Integer[] row : rows) {
            double[] r = new double[items.size()];
            boolean ok = true;
            for (int i = 0; i < items.size(); i++) {
                Integer v = row[items.get(i)];
                if (v == null) {
                    ok = false;
                    break;
                }
                r[i] = v;
            }
            if (ok) out.add(r);
        }
        return out.toArray(new double[0][]);
    }

    private static double subscaleAlpha(PsychometricDataset ds, int band, Instrument inst,
            List<Integer> items) {
        double[][] sub = subscaleMatrix(ds.itemRows(band, inst), items);
        return PsychometricStats.cronbachAlpha(sub);
    }

    private static List<Integer> riasecItemsOf(int letter) {
        List<Integer> out = new ArrayList<>();
        for (int q = letter; q < 54; q += 6) out.add(q);
        return out;
    }

    private static double[][] scaleTotalsMatrix(Integer[][] rows, int scaleCount,
            java.util.function.IntUnaryOperator scaleOf, int itemCount) {
        double[][] totals = new double[rows.length][scaleCount];
        for (int s = 0; s < rows.length; s++) {
            for (int q = 0; q < itemCount; q++) {
                if (rows[s][q] != null) totals[s][scaleOf.applyAsInt(q)] += rows[s][q];
            }
        }
        return totals;
    }

    static void fillCfaRiasec(Workbook wb, PsychometricDataset ds) {
        Sheet sheet = Xl.sheet(wb, "RIASEC Item Analysis");
        Xl.text(sheet, 2, 1, "N = " + String.format("%,d", ds.records.size())
                + " students | 54 items → 6 factors (R-I-A-S-E-C)");

        List<ItemScreen> screens = screenItems(ds, -1, Instrument.RIASEC, 6, q -> q % 6);

        // Section 1 + Section 4: per-factor reliability and removal summary
        for (int f = 0; f < 6; f++) {
            List<Integer> items = riasecItemsOf(f);
            double alphaOrig = subscaleAlpha(ds, -1, Instrument.RIASEC, items);
            List<ItemScreen> mine = byFactor(screens, f);
            List<Integer> retainedItems = new ArrayList<>();
            List<String> removedLabels = new ArrayList<>(), retainedLabels = new ArrayList<>();
            for (ItemScreen is : mine) {
                if ("REMOVE".equals(is.decision)) {
                    removedLabels.add(is.label);
                } else {
                    retainedItems.add(is.qIdx);
                    retainedLabels.add(is.label);
                }
            }
            double alphaRevised = retainedItems.size() >= 2
                    ? subscaleAlpha(ds, -1, Instrument.RIASEC, retainedItems) : Double.NaN;

            int row = 8 + f;
            Xl.num(sheet, row, 2, 9);
            Xl.num(sheet, row, 3, alphaOrig, 3);
            Xl.num(sheet, row, 4, removedLabels.size());
            Xl.num(sheet, row, 5, retainedLabels.size());
            Xl.num(sheet, row, 6, alphaRevised, 3);
            Xl.num(sheet, row, 7, alphaRevised - alphaOrig, 3);
            Xl.text(sheet, row, 8, subscaleVerdict(alphaOrig));

            int s4row = 97 + f;
            Xl.num(sheet, s4row, 2, 9);
            Xl.num(sheet, s4row, 3, removedLabels.size());
            Xl.num(sheet, s4row, 4, retainedLabels.size());
            Xl.text(sheet, s4row, 5, String.join(", ", removedLabels));
            Xl.text(sheet, s4row, 6, String.join(", ", retainedLabels));
        }
        long removedTotal = screens.stream().filter(s -> "REMOVE".equals(s.decision)).count();
        Xl.num(sheet, 103, 2, 54);
        Xl.num(sheet, 103, 3, (int) removedTotal);
        Xl.num(sheet, 103, 4, (int) (54 - removedTotal));

        // Section 2: inter-factor correlation matrix
        double[][] totals = scaleTotalsMatrix(ds.itemRows(-1, Instrument.RIASEC), 6, q -> q % 6, 54);
        interFactorMatrix(sheet, 24, 2, totals, 6, 3);

        // Section 3: items grouped by factor, ascending CITC
        int row = 39;
        for (int f = 0; f < 6; f++) {
            List<ItemScreen> mine = byFactor(screens, f);
            mine.sort(Comparator.comparingDouble(a -> Double.isNaN(a.citc) ? 99 : a.citc));
            for (ItemScreen is : mine) {
                Xl.text(sheet, row, 1, is.label);
                Xl.text(sheet, row, 2, PsychometricDataset.RIASEC_LETTERS[f]);
                Xl.num(sheet, row, 3, is.n);
                Xl.num(sheet, row, 4, is.mean, 2);
                Xl.num(sheet, row, 5, is.sd, 2);
                Xl.num(sheet, row, 6, is.citc, 3);
                for (int sc = 0; sc < 6; sc++) {
                    Xl.num(sheet, row, 7 + sc, is.cross[sc], 3);
                }
                Xl.num(sheet, row, 13, is.maxCross, 3);
                boolean beats = !Double.isNaN(is.maxCross) && is.maxCross > is.citc;
                Xl.text(sheet, row, 14, beats ? "YES ⚠️" : "No");
                Xl.text(sheet, row, 15, is.decision);
                Xl.text(sheet, row, 16, is.issues);
                row++;
            }
        }
    }

    private static List<ItemScreen> byFactor(List<ItemScreen> screens, int factor) {
        List<ItemScreen> out = new ArrayList<>();
        for (ItemScreen is : screens) {
            if (is.factor == factor) out.add(is);
        }
        return out;
    }

    private static String subscaleVerdict(double alpha) {
        if (Double.isNaN(alpha)) return "n/a";
        if (alpha >= 0.7) return "✓ ACCEPTABLE";
        if (alpha >= 0.5) return "⚠️ QUESTIONABLE — weak internal consistency";
        return "⚠️ POOR — items don't cohere; factor not usable as-is";
    }

    private static void interFactorMatrix(Sheet sheet, int firstRow, int firstCol,
            double[][] totals, int scaleCount, int places) {
        for (int i = 0; i < scaleCount; i++) {
            for (int j = 0; j < scaleCount; j++) {
                if (i == j) {
                    Xl.num(sheet, firstRow + i, firstCol + j, 1, 0);
                } else {
                    double r = PsychometricStats.pearson(
                            PsychometricStats.column(totals, i), PsychometricStats.column(totals, j));
                    Xl.num(sheet, firstRow + i, firstCol + j, r, places);
                }
            }
        }
    }

    // ═══════════════════════ CFA — Grade-Wise Analysis ═══════════════════════

    static void fillCfaGradeWise(Workbook wb, PsychometricDataset ds) {
        Sheet sheet = Xl.sheet(wb, "Grade-Wise Analysis");

        @SuppressWarnings("unchecked")
        List<ItemScreen>[] perBand = new List[3];
        for (int b = 0; b < 3; b++) {
            perBand[b] = screenItems(ds, b, Instrument.RIASEC, 6, q -> q % 6);
        }
        int[] bandN = {ds.inBand(0).size(), ds.inBand(1).size(), ds.inBand(2).size()};

        // Section 1 header + per-factor rows
        Xl.text(sheet, 7, 2, "Grades 6–8 (N=" + bandN[0] + ")");
        Xl.text(sheet, 7, 5, "Grades 9–10 (N=" + bandN[1] + ")");
        Xl.text(sheet, 7, 8, "Grades 11–12 (N=" + bandN[2] + ")");
        for (int f = 0; f < 6; f++) {
            double worst = Double.NaN;
            for (int b = 0; b < 3; b++) {
                double alpha = subscaleAlpha(ds, b, Instrument.RIASEC, riasecItemsOf(f));
                long removed = byFactor(perBand[b], f).stream()
                        .filter(s -> "REMOVE".equals(s.decision)).count();
                int col = 2 + b * 3;
                Xl.num(sheet, 9 + f, col, alpha, 3);
                Xl.num(sheet, 9 + f, col + 1, (int) removed);
                Xl.num(sheet, 9 + f, col + 2, (int) (9 - removed));
                if (Double.isNaN(worst) || alpha < worst) worst = alpha;
            }
            Xl.text(sheet, 9 + f, 11, gradeVerdict(worst));
        }

        // Section 2: three side-by-side inter-factor matrices
        Xl.text(sheet, 21, 1, "Grades 6–8 (N=" + bandN[0] + ")");
        Xl.text(sheet, 21, 9, "Grades 9–10 (N=" + bandN[1] + ")");
        Xl.text(sheet, 21, 17, "Grades 11–12 (N=" + bandN[2] + ")");
        int[] matrixCols = {2, 10, 18};
        for (int b = 0; b < 3; b++) {
            double[][] totals = scaleTotalsMatrix(ds.itemRows(b, Instrument.RIASEC), 6, q -> q % 6, 54);
            interFactorMatrix(sheet, 23, matrixCols[b], totals, 6, 3);
        }

        // Sections 3a-3c: per-band item tables in factor/question order
        int[] titleRows = {33, 94, 155};
        int[] itemStartRows = {36, 97, 158};
        int[] summaryRows = {91, 152, 213};
        String[] bandTitles = {"Grades 6–8", "Grades 9–10", "Grades 11–12"};
        for (int b = 0; b < 3; b++) {
            Xl.text(sheet, titleRows[b], 1, "SECTION 3" + (char) ('a' + b) + ": ITEM-LEVEL ANALYSIS — "
                    + bandTitles[b] + " (N=" + bandN[b] + ")");
            int row = itemStartRows[b];
            int nRemove = 0, nRevise = 0, nRetain = 0;
            for (int f = 0; f < 6; f++) {
                for (ItemScreen is : byFactor(perBand[b], f)) {
                    Xl.text(sheet, row, 1, is.label);
                    Xl.text(sheet, row, 2, PsychometricDataset.RIASEC_LETTERS[f]);
                    Xl.num(sheet, row, 3, is.n);
                    Xl.num(sheet, row, 4, is.mean, 2);
                    Xl.num(sheet, row, 5, is.sd, 2);
                    Xl.num(sheet, row, 6, is.citc, 3);
                    for (int sc = 0; sc < 6; sc++) {
                        Xl.num(sheet, row, 7 + sc, is.cross[sc], 3);
                    }
                    Xl.num(sheet, row, 13, is.maxCross, 3);
                    Xl.text(sheet, row, 14, is.decision);
                    if ("REMOVE".equals(is.decision)) nRemove++;
                    else if ("REVISE".equals(is.decision)) nRevise++;
                    else nRetain++;
                    row++;
                }
            }
            Xl.text(sheet, summaryRows[b], 1, "Summary: " + nRemove + " REMOVE | " + nRevise
                    + " REVISE | " + nRetain + " RETAIN out of 54 items");
        }

        // Section 4: cross-grade comparison (rows 220-273), most-flagged items
        // first like the original study, + flag summary text
        class CrossGrade {
            ItemScreen s0, s1, s2;
            int factor, flags;
        }
        List<CrossGrade> crossRows = new ArrayList<>();
        List<String> all3 = new ArrayList<>(), twoOf3 = new ArrayList<>();
        for (int f = 0; f < 6; f++) {
            for (int qi = 0; qi < 9; qi++) {
                CrossGrade cg = new CrossGrade();
                cg.factor = f;
                cg.s0 = byFactor(perBand[0], f).get(qi);
                cg.s1 = byFactor(perBand[1], f).get(qi);
                cg.s2 = byFactor(perBand[2], f).get(qi);
                cg.flags = ("REMOVE".equals(cg.s0.decision) ? 1 : 0)
                        + ("REMOVE".equals(cg.s1.decision) ? 1 : 0)
                        + ("REMOVE".equals(cg.s2.decision) ? 1 : 0);
                if (cg.flags == 3) all3.add(cg.s0.label);
                else if (cg.flags == 2) twoOf3.add(cg.s0.label);
                crossRows.add(cg);
            }
        }
        crossRows.sort(Comparator.<CrossGrade>comparingInt(c -> -c.flags)
                .thenComparing(c -> c.s0.label));
        int row = 220;
        for (CrossGrade cg : crossRows) {
            Xl.text(sheet, row, 1, cg.s0.label);
            Xl.text(sheet, row, 2, PsychometricDataset.RIASEC_LETTERS[cg.factor]);
            Xl.num(sheet, row, 3, cg.s0.citc, 3);
            Xl.text(sheet, row, 4, cg.s0.decision);
            Xl.num(sheet, row, 5, cg.s1.citc, 3);
            Xl.text(sheet, row, 6, cg.s1.decision);
            Xl.num(sheet, row, 7, cg.s2.citc, 3);
            Xl.text(sheet, row, 8, cg.s2.decision);
            row++;
        }
        all3.sort(String::compareTo);
        twoOf3.sort(String::compareTo);
        Xl.text(sheet, 275, 1, "🔴 Flagged REMOVE in ALL 3 grade groups (" + all3.size() + "): "
                + String.join(", ", all3));
        Xl.text(sheet, 276, 1, "🟠 Flagged REMOVE in 2 of 3 groups (" + twoOf3.size() + "): "
                + String.join(", ", twoOf3));
    }

    private static String gradeVerdict(double worstAlpha) {
        if (Double.isNaN(worstAlpha)) return "n/a";
        if (worstAlpha >= 0.7) return "🟢 ACCEPTABLE across all grades";
        if (worstAlpha >= 0.6) return "🟡 BELOW threshold (< 0.70)";
        if (worstAlpha >= 0.5) return "🟠 QUESTIONABLE everywhere";
        return "🔴 POOR across all grades";
    }

    // ═══════════════════════ CFA Ability (Skills) + CFA MI ═══════════════════════

    static void fillCfaAbility(Workbook wb, PsychometricDataset ds) {
        Sheet sheet = Xl.sheet(wb, "CFA Ability");
        fillScaleGroupedCfa(sheet, ds, Instrument.APTITUDE, 10, q -> q % 10,
                PsychometricDataset.ABILITY_CFA_NAMES,
                6, 40, 54, 68);
    }

    static void fillCfaMi(Workbook wb, PsychometricDataset ds) {
        Sheet sheet = Xl.sheet(wb, "CFA Multiple Intelligence");
        fillScaleGroupedCfa(sheet, ds, Instrument.MI, 8, q -> q / 3,
                PsychometricDataset.MI_NAMES,
                6, 34, 46, 58);
    }

    /**
     * Shared layout of the two overall-sample CFA sheets: item table (mean,
     * CITC, cross-loadings), subscale reliability by grade band, inter-factor
     * matrix, and item removal decisions.
     */
    private static void fillScaleGroupedCfa(Sheet sheet, PsychometricDataset ds, Instrument inst,
            int scaleCount, java.util.function.IntUnaryOperator scaleOf, String[] scaleNames,
            int itemTableRow, int reliabilityRow, int matrixRow, int removalRow) {

        Integer[][] rows = ds.itemRows(-1, inst);
        Xl.text(sheet, 2, 1, "N = " + rows.length + " (Overall Sample)");
        List<ItemScreen> screens = screenItems(ds, -1, inst, scaleCount, scaleOf);

        // Group scale-by-scale, keeping item number order within the scale
        Map<Integer, List<Integer>> scaleItems = new LinkedHashMap<>();
        for (int q = 0; q < inst.itemCount; q++) {
            scaleItems.computeIfAbsent(scaleOf.applyAsInt(q), k -> new ArrayList<>()).add(q);
        }

        int row = itemTableRow;
        int removal = removalRow;
        for (int sc = 0; sc < scaleCount; sc++) {
            List<Integer> items = scaleItems.get(sc);
            double currentAlpha = subscaleAlpha(ds, -1, inst, items);
            for (int i = 0; i < items.size(); i++) {
                ItemScreen is = screens.get(items.get(i));
                String label = inst == Instrument.APTITUDE
                        ? PsychometricDataset.aptitudeCfaItemLabel(sc, i + 1)
                        : PsychometricDataset.miItemLabel(items.get(i));

                Xl.text(sheet, row, 1, label);
                Xl.text(sheet, row, 2, scaleNames[sc]);
                Xl.num(sheet, row, 3, is.mean, 2);
                Xl.num(sheet, row, 4, is.citc, 3);
                for (int c = 0; c < scaleCount; c++) {
                    if (c == sc) {
                        Xl.num(sheet, row, 5 + c, is.citc, 3);
                    } else {
                        Xl.num(sheet, row, 5 + c, is.cross[c], 3);
                    }
                }
                Xl.num(sheet, row, 5 + scaleCount, is.maxCross, 3);
                boolean beats = !Double.isNaN(is.maxCross) && is.maxCross > is.citc;
                Xl.text(sheet, row, 6 + scaleCount, beats ? "NO" : "Yes");
                row++;

                // Removal decisions block
                Xl.text(sheet, removal, 1, label);
                Xl.text(sheet, removal, 2, scaleNames[sc]);
                Xl.num(sheet, removal, 3, is.citc, 3);
                Xl.num(sheet, removal, 4, is.alphaIfDeleted, 3);
                Xl.num(sheet, removal, 5, currentAlpha, 3);
                String flag;
                List<String> reasons = new ArrayList<>();
                if (!Double.isNaN(is.citc) && is.citc < 0.15) {
                    flag = "YES";
                    reasons.add("CITC < 0.15 (very poor discrimination)");
                    if (beats) reasons.add("Cross-loading exceeds own-factor CITC");
                } else if (!Double.isNaN(is.citc) && is.citc < 0.20) {
                    flag = "YES";
                    reasons.add("CITC < 0.20 (poor discrimination)");
                    if (beats) reasons.add("Cross-loading exceeds own-factor CITC");
                } else if (beats && !Double.isNaN(is.alphaIfDeleted)
                        && !Double.isNaN(currentAlpha) && is.alphaIfDeleted > currentAlpha) {
                    flag = "YES";
                    reasons.add("Cross-loading exceeds own-factor CITC");
                } else if (beats) {
                    flag = "CONSIDER";
                    reasons.add("Cross-loading exceeds own-factor CITC");
                } else {
                    flag = "No";
                }
                Xl.text(sheet, removal, 6, flag);
                Xl.text(sheet, removal, 7, String.join("; ", reasons));
                removal++;
            }

            // Subscale reliability summary
            int rel = reliabilityRow + sc;
            Xl.text(sheet, rel, 1, scaleNames[sc]);
            Xl.num(sheet, rel, 2, items.size());
            Xl.num(sheet, rel, 3, currentAlpha, 3);
            for (int b = 0; b < 3; b++) {
                Xl.num(sheet, rel, 4 + b, subscaleAlpha(ds, b, inst, items), 3);
            }
            Xl.text(sheet, rel, 7, reliabilityDecision(currentAlpha));
        }

        // Inter-factor correlation matrix
        double[][] totals = scaleTotalsMatrix(rows, scaleCount, scaleOf, inst.itemCount);
        interFactorMatrix(sheet, matrixRow, 2, totals, scaleCount, 3);
    }

    private static String reliabilityDecision(double alpha) {
        if (Double.isNaN(alpha)) return "n/a";
        if (alpha >= 0.7) return "Acceptable — Monitor";
        if (alpha >= 0.6) return "Below threshold — Monitor";
        if (alpha >= 0.5) return "Questionable — Consider revision";
        if (alpha >= 0.4) return "Poor — Revise items";
        return "Very Poor — Major revision needed";
    }

    // ═══════════════════════ Engineering Patterns ═══════════════════════

    static void fillEngineeringPatterns(Workbook wb, PsychometricDataset ds) {
        Sheet sheet = Xl.sheet(wb, "Engineering Patterns");

        List<StudentRecord> eng = new ArrayList<>(), non = new ArrayList<>();
        int first = 0, second = 0, third = 0;
        for (StudentRecord r : ds.records) {
            if (isEngineering(r.suitabilityIndex[0])) first++;
            if (isEngineering(r.suitabilityIndex[1])) second++;
            if (isEngineering(r.suitabilityIndex[2])) third++;
            if (isEngineering(r.suitabilityIndex[0]) || isEngineering(r.suitabilityIndex[1])
                    || isEngineering(r.suitabilityIndex[2])) {
                eng.add(r);
            } else {
                non.add(r);
            }
        }
        int total = ds.records.size();

        // Section 1: sample overview
        Xl.num(sheet, 6, 2, eng.size());
        Xl.num(sheet, 6, 3, non.size());
        Xl.num(sheet, 7, 2, first);
        Xl.num(sheet, 8, 2, second);
        Xl.num(sheet, 9, 2, third);
        Xl.num(sheet, 10, 2, total > 0 ? (double) eng.size() / total : Double.NaN, 3);
        Xl.num(sheet, 10, 3, total > 0 ? (double) non.size() / total : Double.NaN, 3);

        for (int g = 6; g <= 12; g++) {
            int engN = countGrade(eng, g), nonN = countGrade(non, g);
            int row = 13 + (g - 6);
            Xl.num(sheet, row, 2, engN);
            Xl.num(sheet, row, 3, nonN);
            Xl.num(sheet, row, 4, engN + nonN > 0 ? (double) engN / (engN + nonN) : Double.NaN, 3);
        }

        // Section 2A: RIASEC totals in template order R, C, I, A, S, E
        int[] riasecOrder = {0, 5, 1, 2, 3, 4};
        for (int i = 0; i < 6; i++) {
            int idx = riasecOrder[i];
            double[] e = riasecTotals(eng, idx), n = riasecTotals(non, idx);
            writeGroupComparison(sheet, 25 + i, e, n);
        }

        // Section 2B: fixed scales — Interpersonal(MI 1), Language/Comm(abil 3),
        // Decision making(abil 5), Linguistic(MI 3)
        writeGroupComparison(sheet, 34, miTotals(eng, 1), miTotals(non, 1));
        writeGroupComparison(sheet, 35, abilityTotals(eng, 3), abilityTotals(non, 3));
        writeGroupComparison(sheet, 36, abilityTotals(eng, 5), abilityTotals(non, 5));
        writeGroupComparison(sheet, 37, miTotals(eng, 3), miTotals(non, 3));

        // Section 3: item endorsement rates per letter, template order R, C, I, A, S, E
        for (int i = 0; i < 6; i++) {
            int letter = riasecOrder[i];
            double e = endorsementRate(eng, letter), n = endorsementRate(non, letter);
            int row = 42 + i;
            Xl.num(sheet, row, 2, e, 3);
            Xl.num(sheet, row, 3, n, 3);
            Xl.num(sheet, row, 4, e - n, 3);
            double diffPct = Math.abs(e - n) * 100;
            String full = PsychometricDataset.RIASEC_FULL_NAMES[letter];
            Xl.text(sheet, row, 5, String.format("Engineering students endorse %s items %.1f%% %s",
                    full, diffPct, e >= n ? "more often" : "less often"));
        }

        // Section 4: top 15 items by |mean difference|
        fillTopItemGaps(sheet, ds, eng, non);

        // Section 7A/B/C/D: per-grade breakdowns
        for (int g = 6; g <= 12; g++) {
            List<StudentRecord> engG = ofGrade(eng, g), nonG = ofGrade(non, g), allG = ofGrade(ds.records, g);
            int i = g - 6;

            Xl.num(sheet, 99 + i, 2, allG.size());
            Xl.num(sheet, 99 + i, 3, engG.size());
            Xl.num(sheet, 99 + i, 4, allG.isEmpty() ? Double.NaN : (double) engG.size() / allG.size(), 3);
            int firstChoice = 0;
            for (StudentRecord r : engG) {
                if (isEngineering(r.suitabilityIndex[0])) firstChoice++;
            }
            Xl.num(sheet, 99 + i, 5, firstChoice);

            for (int l = 0; l < 6; l++) { // 7B header order R,I,A,S,E,C
                Xl.num(sheet, 111 + i, 2 + l,
                        PsychometricStats.mean(riasecTotals(engG, l)) - PsychometricStats.mean(riasecTotals(nonG, l)), 2);
            }
            int[] gapLetters = {0, 3, 4, 5}; // 7C: R, S, E, C endorsement gaps
            for (int l = 0; l < gapLetters.length; l++) {
                Xl.num(sheet, 123 + i, 2 + l,
                        endorsementRate(engG, gapLetters[l]) - endorsementRate(nonG, gapLetters[l]), 3);
            }
            // 7D: Interpersonal(MI 1), Linguistic(MI 3), Language/Comm(abil 3), Decision Making(abil 5)
            Xl.num(sheet, 135 + i, 2,
                    PsychometricStats.mean(miTotals(engG, 1)) - PsychometricStats.mean(miTotals(nonG, 1)), 2);
            Xl.num(sheet, 135 + i, 3,
                    PsychometricStats.mean(miTotals(engG, 3)) - PsychometricStats.mean(miTotals(nonG, 3)), 2);
            Xl.num(sheet, 135 + i, 4,
                    PsychometricStats.mean(abilityTotals(engG, 3)) - PsychometricStats.mean(abilityTotals(nonG, 3)), 2);
            Xl.num(sheet, 135 + i, 5,
                    PsychometricStats.mean(abilityTotals(engG, 5)) - PsychometricStats.mean(abilityTotals(nonG, 5)), 2);
        }
    }

    private static void fillTopItemGaps(Sheet sheet, PsychometricDataset ds,
            List<StudentRecord> eng, List<StudentRecord> non) {
        class Gap {
            String label, domain;
            double engMean, nonMean, diff;
        }
        List<Gap> gaps = new ArrayList<>();
        Instrument[] instruments = {Instrument.RIASEC, Instrument.APTITUDE, Instrument.MI};
        String[] domains = {"RIASEC", "Aptitude", "MI"};
        for (int d = 0; d < instruments.length; d++) {
            Instrument inst = instruments[d];
            for (int q = 0; q < inst.itemCount; q++) {
                double e = PsychometricStats.mean(itemValues(eng, inst, q));
                double n = PsychometricStats.mean(itemValues(non, inst, q));
                if (Double.isNaN(e) || Double.isNaN(n)) continue;
                Gap g = new Gap();
                g.engMean = e;
                g.nonMean = n;
                g.diff = e - n;
                g.domain = domains[d];
                if (inst == Instrument.RIASEC) {
                    g.label = PsychometricDataset.RIASEC_ITEM_LABELS[q] + " ("
                            + PsychometricDataset.RIASEC_FULL_NAMES[q % 6] + " item)";
                } else if (inst == Instrument.MI) {
                    g.label = PsychometricDataset.miItemLabel(q) + " (MI)";
                } else {
                    g.label = PsychometricDataset.aptitudeItemLabel(q);
                }
                gaps.add(g);
            }
        }
        gaps.sort((a, b) -> Double.compare(Math.abs(b.diff), Math.abs(a.diff)));
        for (int i = 0; i < 15; i++) {
            int row = 53 + i;
            if (i >= gaps.size()) {
                for (int c = 1; c <= 7; c++) Xl.blank(sheet, row, c);
                continue;
            }
            Gap g = gaps.get(i);
            Xl.num(sheet, row, 1, i + 1);
            Xl.text(sheet, row, 2, g.label);
            Xl.num(sheet, row, 3, g.engMean, 2);
            Xl.num(sheet, row, 4, g.nonMean, 2);
            Xl.num(sheet, row, 5, g.diff, 2);
            Xl.text(sheet, row, 6, g.domain);
            Xl.text(sheet, row, 7, g.diff >= 0 ? "Eng HIGHER ⬆" : "Eng LOWER");
        }
    }

    private static void writeGroupComparison(Sheet sheet, int row, double[] eng, double[] non) {
        double em = PsychometricStats.mean(eng), nm = PsychometricStats.mean(non);
        Xl.num(sheet, row, 2, em, 2);
        Xl.num(sheet, row, 3, PsychometricStats.sd(eng), 2);
        Xl.num(sheet, row, 4, nm, 2);
        Xl.num(sheet, row, 5, PsychometricStats.sd(non), 2);
        double diff = em - nm;
        Xl.num(sheet, row, 6, diff, 2);
        String pattern;
        if (Double.isNaN(diff)) pattern = "";
        else if (diff >= 1.0) pattern = "⬆ Engineering students score MUCH HIGHER";
        else if (diff >= 0.3) pattern = "⬆ Engineering students score higher";
        else if (diff > -0.3) pattern = "≈ Similar (small difference)";
        else if (diff > -1.0) pattern = "⬇ Engineering students score lower";
        else pattern = "⬇ Engineering students score MUCH LOWER";
        Xl.text(sheet, row, 7, pattern);
    }

    static boolean isEngineering(String career) {
        return career != null && career.toLowerCase().contains("engineering");
    }

    private static int countGrade(List<StudentRecord> pool, int grade) {
        int n = 0;
        for (StudentRecord r : pool) {
            if (r.studentClass != null && r.studentClass == grade) n++;
        }
        return n;
    }

    private static List<StudentRecord> ofGrade(List<StudentRecord> pool, int grade) {
        List<StudentRecord> out = new ArrayList<>();
        for (StudentRecord r : pool) {
            if (r.studentClass != null && r.studentClass == grade) out.add(r);
        }
        return out;
    }

    private static double[] riasecTotals(List<StudentRecord> pool, int idx) {
        return pool.stream().filter(r -> r.riasecTotals[idx] != null)
                .mapToDouble(r -> r.riasecTotals[idx]).toArray();
    }

    private static double[] abilityTotals(List<StudentRecord> pool, int idx) {
        return pool.stream().filter(r -> r.abilityTotals[idx] != null)
                .mapToDouble(r -> r.abilityTotals[idx]).toArray();
    }

    private static double[] miTotals(List<StudentRecord> pool, int idx) {
        return pool.stream().filter(r -> r.miTotals[idx] != null)
                .mapToDouble(r -> r.miTotals[idx]).toArray();
    }

    private static double[] itemValues(List<StudentRecord> pool, Instrument inst, int q) {
        List<Double> out = new ArrayList<>();
        for (StudentRecord r : pool) {
            Integer[] items = inst.itemsOf(r);
            if (q < items.length && items[q] != null) out.add((double) items[q]);
        }
        double[] a = new double[out.size()];
        for (int i = 0; i < a.length; i++) a[i] = out.get(i);
        return a;
    }

    private static double endorsementRate(List<StudentRecord> pool, int letter) {
        int yes = 0, valid = 0;
        for (StudentRecord r : pool) {
            for (int q = letter; q < r.riasecItems.length; q += 6) {
                if (r.riasecItems[q] != null) {
                    valid++;
                    if (r.riasecItems[q] == 2) yes++;
                }
            }
        }
        return valid > 0 ? (double) yes / valid : Double.NaN;
    }

    // ═══════════════════════ Psychometric Study ═══════════════════════

    /** Ability-ish outputs that indicate the SI1 "debug log" bug, template order. */
    private static final String[] BUG_ABILITY_ROWS = {
            "Logical reasoning", "Form perception", "Communication", "Computational",
            "Technical", "Speed and accuracy", "Finger dexterity", "Motor movement",
            "Decision making & problem solving"};

    /** Template career rows in Section 2 → substring matcher against SI values. */
    private static final String[][] CAREER_ROWS = {
            {"Engineering and Technology", "engineering"},
            {"Science and Mathematics", "science and math"},
            {"Agriculture, Food & Forestry", "agricultur"},
            {"Law Studies", "law"},
            {"Defence/Protective Service", "defence"},
            {"Sports", "sport"},
            {"Computer Science & IT", "computer"},
            {"Architecture", "architect"},
            {"Management & Administration", "management"},
            {"Life Sciences/Healthcare", "life science"},
            {"Banking and Finance", "banking"},
            {"Paramedical", "paramedic"},
            {"Social Sciences & Humanities", "social science"},
            {"Sales", "sales"},
            {"Entrepreneurship", "entrepreneur"},
            {"Community & Social Service", "community"},
            {"Government & Public Admin", "government"},
            {"Hospitality and Tourism", "hospitality"},
            {"Education and Training", "education"},
            {"Marketing", "marketing"}};

    /** Section 4 archetype careers (template rows 66-76). */
    private static final String[] ARCHETYPE_MATCHERS = {
            "engineering", "science and math", "agricultur", "computer", "law",
            "defence", "sport", "architect", "management", "life science", "banking"};

    private static final String[] MI_ABBREV = {"BK", "Inter", "Intra", "Ling", "LogMath", "Musical", "SpatVis", "Nat"};
    private static final String[] ABILITY_ABBREV = {"Speed", "Comp", "Creat", "Comm", "Tech", "DecMak",
            "FinDex", "FormPer", "LogReas", "Motor"};

    static void fillPsychometricStudy(Workbook wb, PsychometricDataset ds) {
        Sheet sheet = Xl.sheet(wb, "Psychometric Study");
        int total = ds.records.size();
        Xl.text(sheet, 2, 1, "N = " + String.format("%,d", total)
                + " valid students | 34 career categories | 9 suitability indices per student");

        // Section 1: ability names leaking into SI1
        int bugTotal = 0;
        for (int i = 0; i < BUG_ABILITY_ROWS.length; i++) {
            int count = 0;
            for (StudentRecord r : ds.records) {
                if (matchesAbility(r.suitabilityIndex[0], BUG_ABILITY_ROWS[i])) count++;
            }
            Xl.num(sheet, 7 + i, 2, count);
            Xl.num(sheet, 7 + i, 3, total > 0 ? (double) count / total : Double.NaN, 4);
            bugTotal += count;
        }
        Xl.num(sheet, 16, 2, bugTotal);
        Xl.num(sheet, 16, 3, total > 0 ? (double) bugTotal / total : Double.NaN, 4);
        Xl.text(sheet, 16, 4, total > 0
                ? String.format("%.1f%% of sample", 100.0 * bugTotal / total) : "");

        // Section 2: SI1 career distribution among legitimate outputs
        List<StudentRecord> legit = new ArrayList<>();
        for (StudentRecord r : ds.records) {
            if (r.suitabilityIndex[0] != null && !isAbilityName(r.suitabilityIndex[0])) legit.add(r);
        }
        int legitN = legit.size();
        int matched = 0;
        for (int i = 0; i < CAREER_ROWS.length; i++) {
            int count = 0;
            for (StudentRecord r : legit) {
                if (containsIgnoreCase(r.suitabilityIndex[0], CAREER_ROWS[i][1])) count++;
            }
            Xl.num(sheet, 24 + i, 2, count);
            Xl.num(sheet, 24 + i, 3, legitN > 0 ? (double) count / legitN : Double.NaN, 4);
            Xl.num(sheet, 24 + i, 5, legitN > 0 ? (double) count / legitN - 0.04 : Double.NaN, 4);
            matched += count;
        }
        Xl.num(sheet, 44, 2, Math.max(0, legitN - matched));
        Xl.num(sheet, 44, 3, legitN > 0 ? (double) (legitN - matched) / legitN : Double.NaN, 4);
        Xl.num(sheet, 44, 5, legitN > 0 ? (double) (legitN - matched) / legitN - 0.04 : Double.NaN, 4);

        // Section 3: personality top-1 → SI1 career concentration
        double weightedAccuracy = 0;
        int weightedN = 0;
        for (int p = 0; p < PsychometricDataset.RIASEC_FULL_NAMES.length; p++) {
            String name = PsychometricDataset.RIASEC_FULL_NAMES[p];
            // template rows: 53 Realistic, 54 Investigative, 55 Conventional,
            // 56 Social, 57 Enterprising, 58 Artistic
            int row = new int[]{53, 54, 58, 56, 57, 55}[p];
            List<StudentRecord> group = new ArrayList<>();
            for (StudentRecord r : legit) {
                if (name.equalsIgnoreCase(r.personalityTop[0])) group.add(r);
            }
            Map<String, Integer> careers = new LinkedHashMap<>();
            for (StudentRecord r : group) {
                careers.merge(r.suitabilityIndex[0], 1, Integer::sum);
            }
            List<Map.Entry<String, Integer>> top = new ArrayList<>(careers.entrySet());
            top.sort((a, b) -> b.getValue() - a.getValue());

            Xl.text(sheet, row, 1, name + " (n=" + group.size() + ")");
            Xl.num(sheet, row, 2, group.size());
            for (int t = 0; t < 3; t++) {
                if (t < top.size() && !group.isEmpty()) {
                    Xl.text(sheet, row, 3 + t, shortCareer(top.get(t).getKey()) + " ("
                            + Math.round(100.0 * top.get(t).getValue() / group.size()) + "%)");
                } else {
                    Xl.blank(sheet, row, 3 + t);
                }
            }
            double acc = !top.isEmpty() && !group.isEmpty()
                    ? (double) top.get(0).getValue() / group.size() : Double.NaN;
            Xl.num(sheet, row, 6, acc, 3);
            if (!Double.isNaN(acc)) {
                weightedAccuracy += acc * group.size();
                weightedN += group.size();
            }
        }
        Xl.text(sheet, 60, 1, "Weighted Average Top-1 Accuracy: ~"
                + (weightedN > 0 ? Math.round(100.0 * weightedAccuracy / weightedN) : 0)
                + "% — share of students whose personality type's most common career matches their SI1");

        // Section 4: archetype profiles for the template's 11 careers
        for (int c = 0; c < ARCHETYPE_MATCHERS.length; c++) {
            int row = 66 + c;
            List<StudentRecord> group = new ArrayList<>();
            for (StudentRecord r : legit) {
                if (containsIgnoreCase(r.suitabilityIndex[0], ARCHETYPE_MATCHERS[c])) group.add(r);
            }
            Xl.num(sheet, row, 2, group.size());
            double[] means = new double[6];
            for (int l = 0; l < 6; l++) {
                means[l] = PsychometricStats.mean(riasecTotals(group, l));
                Xl.num(sheet, row, 3 + l, means[l], 2);
            }
            Xl.text(sheet, row, 9, riasecCode(means));
            Xl.text(sheet, row, 10, topTwo(group, true));
            Xl.text(sheet, row, 11, topTwo(group, false));
        }

        // Section 5: Cohen's d, engineering vs rest, sorted by |d|
        List<StudentRecord> eng = new ArrayList<>(), non = new ArrayList<>();
        for (StudentRecord r : ds.records) {
            boolean isEng = isEngineering(r.suitabilityIndex[0]) || isEngineering(r.suitabilityIndex[1])
                    || isEngineering(r.suitabilityIndex[2]);
            (isEng ? eng : non).add(r);
        }
        class DRow {
            int letter;
            double d;
        }
        List<DRow> dRows = new ArrayList<>();
        for (int l = 0; l < 6; l++) {
            DRow dr = new DRow();
            dr.letter = l;
            dr.d = PsychometricStats.cohenD(riasecTotals(eng, l), riasecTotals(non, l));
            dRows.add(dr);
        }
        dRows.sort((a, b) -> Double.compare(Math.abs(b.d), Math.abs(a.d)));
        for (int i = 0; i < 6; i++) {
            int row = 82 + i;
            DRow dr = dRows.get(i);
            Xl.text(sheet, row, 1, PsychometricDataset.RIASEC_FULL_NAMES[dr.letter]
                    + " (" + PsychometricDataset.RIASEC_LETTERS[dr.letter] + ")");
            Xl.num(sheet, row, 2, dr.d, 3);
            Xl.text(sheet, row, 3, magnitude(dr.d));
            Xl.text(sheet, row, 4, Double.isNaN(dr.d) ? ""
                    : dr.d >= 0 ? "↑ Higher in Engineering" : "↓ Lower in Engineering");
            double a = Math.abs(dr.d);
            Xl.text(sheet, row, 5, Double.isNaN(dr.d) ? ""
                    : a >= 0.35 ? "Differentiates Engineering students"
                    : a >= 0.15 ? "Weak differentiator" : "Not a meaningful differentiator");
        }
    }

    private static String magnitude(double d) {
        double a = Math.abs(d);
        if (Double.isNaN(d)) return "";
        if (a >= 0.8) return "Large";
        if (a >= 0.5) return "Medium";
        if (a >= 0.35) return "Small-Medium";
        if (a >= 0.15) return "Small";
        return "Negligible";
    }

    private static String riasecCode(double[] means) {
        Integer[] order = {0, 1, 2, 3, 4, 5};
        Arrays.sort(order, (a, b) -> Double.compare(
                Double.isNaN(means[b]) ? -99 : means[b], Double.isNaN(means[a]) ? -99 : means[a]));
        if (Double.isNaN(means[order[0]])) return "";
        return PsychometricDataset.RIASEC_LETTERS[order[0]] + "-"
                + PsychometricDataset.RIASEC_LETTERS[order[1]] + "-"
                + PsychometricDataset.RIASEC_LETTERS[order[2]];
    }

    private static String topTwo(List<StudentRecord> group, boolean mi) {
        int count = mi ? 8 : 10;
        double[] means = new double[count];
        for (int i = 0; i < count; i++) {
            means[i] = PsychometricStats.mean(mi ? miTotals(group, i) : abilityTotals(group, i));
        }
        Integer[] order = new Integer[count];
        for (int i = 0; i < count; i++) order[i] = i;
        Arrays.sort(order, (a, b) -> Double.compare(
                Double.isNaN(means[b]) ? -99 : means[b], Double.isNaN(means[a]) ? -99 : means[a]));
        if (Double.isNaN(means[order[0]])) return "";
        String[] abbrev = mi ? MI_ABBREV : ABILITY_ABBREV;
        return abbrev[order[0]] + "(" + PsychometricStats.round(means[order[0]], 1) + "), "
                + abbrev[order[1]] + "(" + PsychometricStats.round(means[order[1]], 1) + ")";
    }

    private static String shortCareer(String career) {
        if (career == null) return "";
        String c = career.trim();
        int cut = c.indexOf(',');
        if (cut < 0) cut = c.indexOf(" and ");
        if (cut < 0) cut = c.indexOf('/');
        if (cut > 3) c = c.substring(0, cut);
        return c.length() > 22 ? c.substring(0, 22) : c;
    }

    private static boolean matchesAbility(String si1, String abilityRow) {
        if (si1 == null) return false;
        String norm = si1.trim().toLowerCase();
        String target = abilityRow.toLowerCase();
        return norm.equals(target)
                || (target.equals("communication") && norm.contains("communication") && !norm.contains("career"))
                || (target.startsWith("decision") && norm.startsWith("decision"));
    }

    private static boolean isAbilityName(String si1) {
        if (si1 == null || si1.trim().isEmpty()) return true;
        for (String a : BUG_ABILITY_ROWS) {
            if (matchesAbility(si1, a)) return true;
        }
        String norm = si1.trim().toLowerCase();
        for (String a : PsychometricDataset.ABILITY_NAMES) {
            if (norm.equals(a.toLowerCase())) return true;
        }
        return norm.equals("creativity") || norm.equals("creativity/artistic");
    }

    private static boolean containsIgnoreCase(String haystack, String needle) {
        return haystack != null && haystack.toLowerCase().contains(needle);
    }

    private static String join(String a, String b) {
        if (b == null) return a;
        return a + "; " + b;
    }
}
