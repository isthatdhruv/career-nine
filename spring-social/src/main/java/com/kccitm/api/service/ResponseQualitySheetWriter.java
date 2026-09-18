package com.kccitm.api.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import com.kccitm.api.service.psychometric.PsychometricDataset;

/**
 * Adds the analyst's careless-responding screen to the "Generate Data Excel"
 * workbook of a Navigator 360 assessment.
 *
 * <p>A second sheet, "Response Quality", lays the item marks out exactly the
 * way the analyst's formulas expect them — column A the student, B..BC the 54
 * personality (RIASEC Yes/No, YES=2 NO=1) items, BD..DE the 54 cognitive
 * (30 aptitude + 24 MI, marks 1–4) items — and then carries the rules as live
 * Excel formulas so anyone can audit or re-tune them in the file:
 * <ol>
 *   <li>helper row of cognitive item averages (row 2; row 1 keeps the headers);</li>
 *   <li>per student: Scatter {@code STDEV}, Distance from group
 *       {@code SUMPRODUCT((items-averages)^2)/54}, Straightlining (max count of one
 *       option), Extremeness (share of Yes on personality);</li>
 *   <li>the combined verdict: two or more of {scatter ≥ 1.03, distance above the
 *       cohort's 95th percentile, straightlining &gt; 24, extremeness outside
 *       0.15–0.85} → EXCLUDE, otherwise OK;</li>
 *   <li>the analyst's extra personality check: odd/even item means per RIASEC
 *       scale and their {@code CORREL} (real respondents &gt; 0.4, random ≈ 0),
 *       shown for reference — the verdict follows the four-index rule as written.</li>
 * </ol>
 * Every formula cell also gets its value pre-computed in Java (same arithmetic,
 * Excel semantics for blanks), so viewers that do not recalculate still show the
 * numbers; Excel recalculates on open. The verdict and the flag list are echoed
 * onto the main data sheet as two trailing columns.
 */
public final class ResponseQualitySheetWriter {

    static final String SHEET_NAME = "Response Quality";

    static final int PERSONALITY_ITEMS = 54;
    static final int APTITUDE_ITEMS = 30;
    static final int MI_ITEMS = 24;
    static final int COGNITIVE_ITEMS = APTITUDE_ITEMS + MI_ITEMS;

    static final double SCATTER_FLAG_AT = 1.03;
    static final double DISTANCE_PERCENTILE = 0.95;
    static final int STRAIGHTLINING_FLAG_ABOVE = 24;
    static final double EXTREMENESS_LOW = 0.15;
    static final double EXTREMENESS_HIGH = 0.85;
    static final int FLAGS_TO_EXCLUDE = 2;

    // 1-based column positions (A=1). Personality B..BC, cognitive BD..DE.
    static final int COL_STUDENT = 1;
    static final int COL_PERSONALITY_FIRST = 2;                                   // B
    static final int COL_COGNITIVE_FIRST = COL_PERSONALITY_FIRST + PERSONALITY_ITEMS; // BD (56)
    static final int COL_STUDENT_ID = COL_COGNITIVE_FIRST + COGNITIVE_ITEMS;      // DF (110)
    static final int COL_SCATTER = COL_STUDENT_ID + 1;        // DG
    static final int COL_DISTANCE = COL_SCATTER + 1;          // DH
    static final int COL_STRAIGHTLINING = COL_DISTANCE + 1;   // DI
    static final int COL_EXTREMENESS = COL_STRAIGHTLINING + 1; // DJ
    static final int COL_VERDICT = COL_EXTREMENESS + 1;       // DK
    static final int COL_FLAGS = COL_VERDICT + 1;             // DL
    static final int COL_ODD_FIRST = COL_FLAGS + 1;           // DM..DR
    static final int COL_EVEN_FIRST = COL_ODD_FIRST + 6;      // DS..DX
    static final int COL_ODD_EVEN_R = COL_EVEN_FIRST + 6;     // DY
    /**
     * Not part of the rules, but the reason a row can sit at the top of the
     * Distance column: {@code SUMPRODUCT} reads a blank as 0, so a student who
     * answered no cognitive item scores the maximum possible distance. When
     * such rows are more than 5% of the cohort the 95th-percentile cut-off
     * lands on that same value and the Distance flag stops firing for anyone,
     * so the count is shown next to it.
     */
    static final int COL_ANSWERED = COL_ODD_EVEN_R + 1;       // DZ

    static final int HEADER_ROW = 1;
    static final int AVERAGE_ROW = 2;
    static final int FIRST_DATA_ROW = 3;

    /** One student's item marks; null = unanswered. Arrays may be shorter than the fixed widths. */
    public static final class StudentItems {
        public final long userStudentId;
        public final String name;
        public final Integer[] personality;
        public final Integer[] aptitude;
        public final Integer[] mi;

        public StudentItems(long userStudentId, String name, Integer[] personality, Integer[] aptitude, Integer[] mi) {
            this.userStudentId = userStudentId;
            this.name = name;
            this.personality = personality != null ? personality : new Integer[0];
            this.aptitude = aptitude != null ? aptitude : new Integer[0];
            this.mi = mi != null ? mi : new Integer[0];
        }
    }

    /** Pre-computed values mirroring the sheet formulas (Excel blank semantics). */
    static final class Computed {
        Double scatter;          // null = STDEV undefined (< 2 answers) → formula falls back to 0
        double distance;
        int straightlining;
        double extremeness;
        int answered;
        final Double[] oddMeans = new Double[6];
        final Double[] evenMeans = new Double[6];
        Double oddEvenR;
        final List<String> flags = new ArrayList<>();

        String verdict() {
            return flags.size() >= FLAGS_TO_EXCLUDE ? "EXCLUDE" : "OK";
        }

        String flagsText() {
            return String.join(" ", flags);
        }
    }

    private ResponseQualitySheetWriter() {
    }

    /**
     * Writes the "Response Quality" sheet for {@code students} (in the same
     * order as the data sheet's rows, which start at row 2) and appends the
     * verdict + flags columns to {@code dataSheet} starting at 0-based column
     * {@code dataFirstFreeCol}.
     */
    public static void write(XSSFWorkbook wb, Sheet dataSheet, int dataFirstFreeCol, List<StudentItems> students) {
        Sheet sheet = wb.createSheet(SHEET_NAME);
        int n = students.size();
        int lastRow = FIRST_DATA_ROW + n - 1;

        CellStyle headerStyle = wb.createCellStyle();
        Font bold = wb.createFont();
        bold.setBold(true);
        headerStyle.setFont(bold);
        CellStyle helperStyle = wb.createCellStyle();
        Font italic = wb.createFont();
        italic.setItalic(true);
        helperStyle.setFont(italic);

        writeHeaders(sheet, headerStyle, lastRow);

        // Helper row: cohort average of every cognitive item.
        text(sheet, AVERAGE_ROW, COL_STUDENT, "Item average (helper row)").setCellStyle(helperStyle);
        double[] itemAverages = cognitiveAverages(students);
        for (int j = 0; j < COGNITIVE_ITEMS; j++) {
            int col = COL_COGNITIVE_FIRST + j;
            String c = colName(col);
            Cell cell = formula(sheet, AVERAGE_ROW, col,
                    "IFERROR(AVERAGE(" + c + "$" + FIRST_DATA_ROW + ":" + c + "$" + lastRow + "),0)");
            cell.setCellValue(itemAverages[j]);
            cell.setCellStyle(helperStyle);
        }

        List<Computed> computed = compute(students, itemAverages);

        for (int i = 0; i < n; i++) {
            StudentItems s = students.get(i);
            Computed c = computed.get(i);
            int r = FIRST_DATA_ROW + i;

            text(sheet, r, COL_STUDENT, s.name);
            writeItems(sheet, r, COL_PERSONALITY_FIRST, s.personality, PERSONALITY_ITEMS);
            writeItems(sheet, r, COL_COGNITIVE_FIRST, s.aptitude, APTITUDE_ITEMS);
            writeItems(sheet, r, COL_COGNITIVE_FIRST + APTITUDE_ITEMS, s.mi, MI_ITEMS);
            num(sheet, r, COL_STUDENT_ID, (double) s.userStudentId);

            String cog = range(COL_COGNITIVE_FIRST, r, COL_COGNITIVE_FIRST + COGNITIVE_ITEMS - 1, r);
            String avg = range(COL_COGNITIVE_FIRST, AVERAGE_ROW, COL_COGNITIVE_FIRST + COGNITIVE_ITEMS - 1, AVERAGE_ROW, true);
            String pers = range(COL_PERSONALITY_FIRST, r, COL_PERSONALITY_FIRST + PERSONALITY_ITEMS - 1, r);
            String scatter = ref(COL_SCATTER, r);
            String distance = ref(COL_DISTANCE, r);
            String straight = ref(COL_STRAIGHTLINING, r);
            String extreme = ref(COL_EXTREMENESS, r);
            String distanceCol = colName(COL_DISTANCE);
            String cutoff = "PERCENTILE(" + distanceCol + "$" + FIRST_DATA_ROW + ":" + distanceCol + "$" + lastRow
                    + "," + DISTANCE_PERCENTILE + ")";

            // 1. Scatter — STDEV.S; fewer than two answers would be #DIV/0!, so fall back to 0 (no flag).
            formula(sheet, r, COL_SCATTER, "IFERROR(STDEV(" + cog + "),0)")
                    .setCellValue(c.scatter != null ? c.scatter : 0);
            // 2. Distance from the group
            formula(sheet, r, COL_DISTANCE, "SUMPRODUCT((" + cog + "-" + avg + ")^2)/" + COGNITIVE_ITEMS)
                    .setCellValue(c.distance);
            // 3. Straightlining — biggest count of any single option
            formula(sheet, r, COL_STRAIGHTLINING, "MAX(COUNTIF(" + cog + ",1),COUNTIF(" + cog + ",2),COUNTIF("
                    + cog + ",3),COUNTIF(" + cog + ",4))")
                    .setCellValue(c.straightlining);
            // 4. Extremeness — proportion of Yes
            formula(sheet, r, COL_EXTREMENESS, "COUNTIF(" + pers + ",2)/" + PERSONALITY_ITEMS)
                    .setCellValue(c.extremeness);

            String fScatter = scatter + ">=" + SCATTER_FLAG_AT;
            String fDistance = distance + ">" + cutoff;
            String fStraight = straight + ">" + STRAIGHTLINING_FLAG_ABOVE;
            String fExtreme = "OR(" + extreme + "<" + EXTREMENESS_LOW + "," + extreme + ">" + EXTREMENESS_HIGH + ")";

            // Combine: two flags minimum.
            formula(sheet, r, COL_VERDICT, "IF((" + fScatter + ")+(" + fDistance + ")+(" + fStraight + ")+("
                    + fExtreme + ")>=" + FLAGS_TO_EXCLUDE + ",\"EXCLUDE\",\"OK\")")
                    .setCellValue(c.verdict());
            formula(sheet, r, COL_FLAGS, "TRIM(IF(" + fScatter + ",\"Scatter \",\"\")&IF(" + fDistance
                    + ",\"Distance \",\"\")&IF(" + fStraight + ",\"Straightlining \",\"\")&IF(" + fExtreme
                    + ",\"Extremeness \",\"\"))")
                    .setCellValue(c.flagsText());

            // Odd/even split-half per RIASEC scale, then CORREL across the six scales.
            for (int s6 = 0; s6 < 6; s6++) {
                Cell odd = formula(sheet, r, COL_ODD_FIRST + s6,
                        "IFERROR(AVERAGE(" + personalityCells(r, s6, true) + "),\"\")");
                setNumberOrBlankText(odd, c.oddMeans[s6]);
                Cell even = formula(sheet, r, COL_EVEN_FIRST + s6,
                        "IFERROR(AVERAGE(" + personalityCells(r, s6, false) + "),\"\")");
                setNumberOrBlankText(even, c.evenMeans[s6]);
            }
            Cell corr = formula(sheet, r, COL_ODD_EVEN_R, "IFERROR(CORREL("
                    + range(COL_ODD_FIRST, r, COL_ODD_FIRST + 5, r) + ","
                    + range(COL_EVEN_FIRST, r, COL_EVEN_FIRST + 5, r) + "),\"\")");
            setNumberOrBlankText(corr, c.oddEvenR);
            formula(sheet, r, COL_ANSWERED, "COUNT(" + cog + ")").setCellValue(c.answered);

            // Echo onto the data sheet (its rows start at 2, ours at 3).
            Row dataRow = dataSheet.getRow(1 + i);
            if (dataRow != null) {
                Cell v = dataRow.createCell(dataFirstFreeCol);
                v.setCellFormula("'" + SHEET_NAME + "'!" + ref(COL_VERDICT, r));
                v.setCellValue(c.verdict());
                Cell f = dataRow.createCell(dataFirstFreeCol + 1);
                f.setCellFormula("'" + SHEET_NAME + "'!" + ref(COL_FLAGS, r));
                f.setCellValue(c.flagsText());
            }
        }

        Row dataHeader = dataSheet.getRow(0);
        if (dataHeader != null) {
            CellStyle dataHeaderStyle = dataHeader.getCell(0) != null ? dataHeader.getCell(0).getCellStyle() : headerStyle;
            Cell h1 = dataHeader.createCell(dataFirstFreeCol);
            h1.setCellValue("Response Quality");
            h1.setCellStyle(dataHeaderStyle);
            Cell h2 = dataHeader.createCell(dataFirstFreeCol + 1);
            h2.setCellValue("Response Quality Flags");
            h2.setCellStyle(dataHeaderStyle);
        }

        sheet.createFreezePane(1, FIRST_DATA_ROW - 1);
        for (int col = COL_SCATTER; col <= COL_ANSWERED; col++) {
            sheet.setColumnWidth(col - 1, 18 * 256);
        }
        sheet.setColumnWidth(COL_STUDENT - 1, 28 * 256);
        wb.setForceFormulaRecalculation(true);
    }

    private static void writeHeaders(Sheet sheet, CellStyle style, int lastRow) {
        text(sheet, HEADER_ROW, COL_STUDENT, "Student").setCellStyle(style);
        for (int q = 0; q < PERSONALITY_ITEMS; q++) {
            String label = q < PsychometricDataset.RIASEC_ITEM_LABELS.length
                    ? PsychometricDataset.RIASEC_ITEM_LABELS[q] : ("P" + (q + 1));
            text(sheet, HEADER_ROW, COL_PERSONALITY_FIRST + q, "Personality " + label).setCellStyle(style);
        }
        for (int q = 0; q < APTITUDE_ITEMS; q++) {
            text(sheet, HEADER_ROW, COL_COGNITIVE_FIRST + q,
                    "Aptitude " + PsychometricDataset.aptitudeItemLabel(q)).setCellStyle(style);
        }
        for (int q = 0; q < MI_ITEMS; q++) {
            text(sheet, HEADER_ROW, COL_COGNITIVE_FIRST + APTITUDE_ITEMS + q,
                    "MI " + PsychometricDataset.miItemLabel(q)).setCellStyle(style);
        }
        text(sheet, HEADER_ROW, COL_STUDENT_ID, "Student ID").setCellStyle(style);
        text(sheet, HEADER_ROW, COL_SCATTER, "Scatter (SD of cognitive items; flag >= " + SCATTER_FLAG_AT + ")")
                .setCellStyle(style);
        text(sheet, HEADER_ROW, COL_DISTANCE, "Distance from group (flag > 95th percentile of column)")
                .setCellStyle(style);
        text(sheet, HEADER_ROW, COL_STRAIGHTLINING, "Straightlining (max same option; flag > "
                + STRAIGHTLINING_FLAG_ABOVE + " of " + COGNITIVE_ITEMS + ")").setCellStyle(style);
        text(sheet, HEADER_ROW, COL_EXTREMENESS, "Extremeness (share of Yes; flag < " + EXTREMENESS_LOW
                + " or > " + EXTREMENESS_HIGH + ")").setCellStyle(style);
        text(sheet, HEADER_ROW, COL_VERDICT, "Verdict (" + FLAGS_TO_EXCLUDE + "+ flags = EXCLUDE)")
                .setCellStyle(style);
        text(sheet, HEADER_ROW, COL_FLAGS, "Flags").setCellStyle(style);
        for (int s6 = 0; s6 < 6; s6++) {
            String letter = PsychometricDataset.RIASEC_LETTERS[s6];
            text(sheet, HEADER_ROW, COL_ODD_FIRST + s6, letter + " odd items mean").setCellStyle(style);
            text(sheet, HEADER_ROW, COL_EVEN_FIRST + s6, letter + " even items mean").setCellStyle(style);
        }
        text(sheet, HEADER_ROW, COL_ODD_EVEN_R, "Personality odd-even r (real > 0.4, random ~ 0)")
                .setCellStyle(style);
        text(sheet, HEADER_ROW, COL_ANSWERED, "Cognitive items answered (of " + COGNITIVE_ITEMS
                + "; a 0 here maximises Distance)").setCellStyle(style);
    }

    /**
     * Personality cells of one RIASEC scale's odd (k = 1,3,5,7,9) or even
     * (k = 2,4,6,8) items: item k of scale s is question s + 6(k-1).
     */
    private static String personalityCells(int row, int scale, boolean odd) {
        List<String> cells = new ArrayList<>();
        for (int k = odd ? 0 : 1; k < 9; k += 2) {
            cells.add(ref(COL_PERSONALITY_FIRST + scale + 6 * k, row));
        }
        return String.join(",", cells);
    }

    // ── Java mirror of the formulas ─────────────────────────────────────────

    static double[] cognitiveAverages(List<StudentItems> students) {
        double[] sum = new double[COGNITIVE_ITEMS];
        int[] count = new int[COGNITIVE_ITEMS];
        for (StudentItems s : students) {
            Integer[] cog = cognitive(s);
            for (int j = 0; j < COGNITIVE_ITEMS; j++) {
                if (cog[j] != null) {
                    sum[j] += cog[j];
                    count[j]++;
                }
            }
        }
        double[] avg = new double[COGNITIVE_ITEMS];
        for (int j = 0; j < COGNITIVE_ITEMS; j++) avg[j] = count[j] == 0 ? 0 : sum[j] / count[j];
        return avg;
    }

    static List<Computed> compute(List<StudentItems> students, double[] itemAverages) {
        List<Computed> out = new ArrayList<>();
        for (StudentItems s : students) {
            Computed c = new Computed();
            Integer[] cog = cognitive(s);

            // STDEV ignores blanks
            List<Double> answered = new ArrayList<>();
            for (Integer v : cog) if (v != null) answered.add((double) v);
            c.answered = answered.size();
            if (answered.size() >= 2) {
                double m = answered.stream().mapToDouble(d -> d).average().orElse(0);
                double ss = 0;
                for (double v : answered) ss += (v - m) * (v - m);
                c.scatter = Math.sqrt(ss / (answered.size() - 1));
            }

            // SUMPRODUCT treats a blank as 0
            double ss = 0;
            for (int j = 0; j < COGNITIVE_ITEMS; j++) {
                double v = cog[j] != null ? cog[j] : 0;
                ss += (v - itemAverages[j]) * (v - itemAverages[j]);
            }
            c.distance = ss / COGNITIVE_ITEMS;

            int[] counts = new int[5];
            for (Integer v : cog) if (v != null && v >= 1 && v <= 4) counts[v]++;
            c.straightlining = Math.max(Math.max(counts[1], counts[2]), Math.max(counts[3], counts[4]));

            int yes = 0;
            for (int q = 0; q < PERSONALITY_ITEMS && q < s.personality.length; q++) {
                if (s.personality[q] != null && s.personality[q] == 2) yes++;
            }
            c.extremeness = yes / (double) PERSONALITY_ITEMS;

            for (int s6 = 0; s6 < 6; s6++) {
                c.oddMeans[s6] = personalityMean(s.personality, s6, true);
                c.evenMeans[s6] = personalityMean(s.personality, s6, false);
            }
            c.oddEvenR = correl(c.oddMeans, c.evenMeans);
            out.add(c);
        }

        double[] distances = out.stream().mapToDouble(c -> c.distance).toArray();
        double cutoff = percentileInc(distances, DISTANCE_PERCENTILE);

        for (Computed c : out) {
            double scatter = c.scatter != null ? c.scatter : 0;
            if (scatter >= SCATTER_FLAG_AT) c.flags.add("Scatter");
            if (c.distance > cutoff) c.flags.add("Distance");
            if (c.straightlining > STRAIGHTLINING_FLAG_ABOVE) c.flags.add("Straightlining");
            if (c.extremeness < EXTREMENESS_LOW || c.extremeness > EXTREMENESS_HIGH) c.flags.add("Extremeness");
        }
        return out;
    }

    /** Aptitude then MI marks in the fixed 30 + 24 slots. */
    static Integer[] cognitive(StudentItems s) {
        Integer[] cog = new Integer[COGNITIVE_ITEMS];
        for (int j = 0; j < APTITUDE_ITEMS && j < s.aptitude.length; j++) cog[j] = s.aptitude[j];
        for (int j = 0; j < MI_ITEMS && j < s.mi.length; j++) cog[APTITUDE_ITEMS + j] = s.mi[j];
        return cog;
    }

    private static Double personalityMean(Integer[] personality, int scale, boolean odd) {
        double sum = 0;
        int n = 0;
        for (int k = odd ? 0 : 1; k < 9; k += 2) {
            int q = scale + 6 * k;
            if (q < personality.length && q < PERSONALITY_ITEMS && personality[q] != null) {
                sum += personality[q];
                n++;
            }
        }
        return n == 0 ? null : sum / n;
    }

    /** Excel CORREL: pairs with a non-numeric member are skipped; undefined → null. */
    static Double correl(Double[] x, Double[] y) {
        List<double[]> pairs = new ArrayList<>();
        for (int i = 0; i < x.length; i++) {
            if (x[i] != null && y[i] != null) pairs.add(new double[] {x[i], y[i]});
        }
        if (pairs.size() < 2) return null;
        double mx = 0, my = 0;
        for (double[] p : pairs) {
            mx += p[0];
            my += p[1];
        }
        mx /= pairs.size();
        my /= pairs.size();
        double sxy = 0, sxx = 0, syy = 0;
        for (double[] p : pairs) {
            sxy += (p[0] - mx) * (p[1] - my);
            sxx += (p[0] - mx) * (p[0] - mx);
            syy += (p[1] - my) * (p[1] - my);
        }
        if (sxx == 0 || syy == 0) return null;
        return sxy / Math.sqrt(sxx * syy);
    }

    /** Excel PERCENTILE / PERCENTILE.INC (linear interpolation on sorted values). */
    static double percentileInc(double[] values, double p) {
        if (values.length == 0) return Double.NaN;
        double[] s = values.clone();
        Arrays.sort(s);
        if (s.length == 1) return s[0];
        double rank = p * (s.length - 1);
        int lo = (int) Math.floor(rank);
        int hi = (int) Math.ceil(rank);
        return lo == hi ? s[lo] : s[lo] + (rank - lo) * (s[hi] - s[lo]);
    }

    // ── cell helpers (1-based) ──────────────────────────────────────────────

    private static void writeItems(Sheet sheet, int row, int firstCol, Integer[] items, int width) {
        for (int j = 0; j < width; j++) {
            Integer v = j < items.length ? items[j] : null;
            if (v != null) num(sheet, row, firstCol + j, (double) v);
        }
    }

    private static Cell cell(Sheet sheet, int row1, int col1) {
        Row row = sheet.getRow(row1 - 1);
        if (row == null) row = sheet.createRow(row1 - 1);
        Cell cell = row.getCell(col1 - 1);
        if (cell == null) cell = row.createCell(col1 - 1);
        return cell;
    }

    private static Cell text(Sheet sheet, int row1, int col1, String value) {
        Cell c = cell(sheet, row1, col1);
        c.setCellValue(value != null ? value : "");
        return c;
    }

    private static Cell num(Sheet sheet, int row1, int col1, double value) {
        Cell c = cell(sheet, row1, col1);
        c.setCellValue(value);
        return c;
    }

    private static Cell formula(Sheet sheet, int row1, int col1, String formula) {
        Cell c = cell(sheet, row1, col1);
        c.setCellFormula(formula);
        return c;
    }

    /** Cached value for an IFERROR(...,"") formula: the number, or the empty string. */
    private static void setNumberOrBlankText(Cell formulaCell, Double value) {
        if (value != null) {
            formulaCell.setCellValue(value);
        } else {
            formulaCell.setCellValue("");
        }
    }

    static String colName(int col1) {
        return CellReference.convertNumToColString(col1 - 1);
    }

    static String ref(int col1, int row1) {
        return colName(col1) + row1;
    }

    private static String range(int c1, int r1, int c2, int r2) {
        return range(c1, r1, c2, r2, false);
    }

    private static String range(int c1, int r1, int c2, int r2, boolean absoluteRows) {
        String d = absoluteRows ? "$" : "";
        return colName(c1) + d + r1 + ":" + colName(c2) + d + r2;
    }
}
