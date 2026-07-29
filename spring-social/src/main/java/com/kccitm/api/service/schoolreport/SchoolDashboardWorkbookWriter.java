package com.kccitm.api.service.schoolreport;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import com.kccitm.api.service.schoolreport.SchoolDashboard.AbilityRow;
import com.kccitm.api.service.schoolreport.SchoolDashboard.ClassCount;
import com.kccitm.api.service.schoolreport.SchoolDashboard.ClusterRow;
import com.kccitm.api.service.schoolreport.SchoolDashboard.IntelligenceRow;
import com.kccitm.api.service.schoolreport.SchoolDashboard.LabeledPair;
import com.kccitm.api.service.schoolreport.SchoolDashboard.LabeledSeries;
import com.kccitm.api.service.schoolreport.SchoolDashboard.LabeledValue;
import com.kccitm.api.service.schoolreport.SchoolDashboard.StreamRow;
import com.kccitm.api.service.schoolreport.SchoolDashboard.TraitRow;
import com.kccitm.api.service.schoolreport.SchoolDashboard.ValueRow;
import com.kccitm.api.service.schoolreport.SchoolReportService.PasteDataCalculations;
import com.kccitm.api.service.schoolreport.SchoolReportService.PasteDataRow;

/**
 * Renders a {@link SchoolDashboard} as the nine-sheet Navigator360 workbook,
 * matching the layout of {@code signup-c9-html/Navigator360_Dashboard.xlsx}
 * sheet for sheet and cell for cell.
 *
 * <p>Every cell is written as a <b>computed value, not a formula</b>. The
 * exported file is a snapshot of one cohort under one class filter, so editing
 * sheet 1 in Excel will not ripple through to sheets 2..9 the way the hand-run
 * template does — regenerate from the Reports Hub instead.
 */
@Service
public class SchoolDashboardWorkbookWriter {

    private CellStyle titleStyle;
    private CellStyle noteStyle;
    private CellStyle sectionStyle;
    private CellStyle headerStyle;
    private CellStyle labelStyle;
    private CellStyle numberStyle;
    private CellStyle decimalStyle;
    private CellStyle computedStyle;

    /**
     * Builds the workbook.
     *
     * @param dashboard a fully computed dashboard
     * @return the .xlsx bytes
     */
    public byte[] write(SchoolDashboard dashboard) throws IOException {
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            initStyles(workbook);

            writePasteData(workbook, dashboard);
            writeSummary(workbook, dashboard);
            writePersonality(workbook, dashboard);
            writeLearningStyle(workbook, dashboard);
            writeAbilities(workbook, dashboard);
            writeValues(workbook, dashboard);
            writeCareerGap(workbook, dashboard);
            writeByClass(workbook, dashboard);
            writeCharts(workbook, dashboard);

            workbook.write(out);
            return out.toByteArray();
        }
    }

    // ───────────────────────── 1. PASTE DATA ─────────────────────────

    private void writePasteData(XSSFWorkbook workbook, SchoolDashboard dashboard) {
        Sheet sheet = workbook.createSheet("1. PASTE DATA");
        text(sheet, 1, 0, "1. PASTE DATA", titleStyle);
        text(sheet, 2, 0, "One student per row. The grey columns on the right are calculated; "
                + "every other sheet in this workbook is a snapshot of these rows.", noteStyle);

        List<String> headers = SchoolReportService.PASTE_DATA_HEADERS;
        for (int c = 0; c < headers.size(); c++) {
            text(sheet, SchoolReportService.HEADER_ROW, c, headers.get(c), headerStyle);
        }

        int rowNum = SchoolReportService.FIRST_DATA_ROW;
        for (PasteDataRow student : dashboard.rows) {
            if (student == null) {
                rowNum++;
                continue;
            }
            int c = 0;
            text(sheet, rowNum, c++, student.school, null);
            text(sheet, rowNum, c++, student.studentName, null);
            number(sheet, rowNum, c++, student.studentClass, numberStyle);
            text(sheet, rowNum, c++, student.section, null);
            text(sheet, rowNum, c++, student.gender, null);
            c = numbers(sheet, rowNum, c, student.abilities, SchoolReportService.ABILITY_COUNT);
            c = numbers(sheet, rowNum, c, student.intelligences, SchoolReportService.INTELLIGENCE_COUNT);
            c = numbers(sheet, rowNum, c, student.riasec, SchoolReportService.RIASEC_COUNT);
            c = texts(sheet, rowNum, c, student.personalityTop, SchoolReportService.PERSONALITY_TOP_COUNT);
            c = texts(sheet, rowNum, c, student.values, SchoolReportService.VALUE_COUNT);
            c = texts(sheet, rowNum, c, student.careerAspirations, SchoolReportService.CAREER_ASPIRATION_COUNT);
            c = texts(sheet, rowNum, c, student.suitabilityIndex, SchoolReportService.SUITABILITY_INDEX_COUNT);
            c++; // AY spacer

            PasteDataCalculations calc = student.calculations;
            if (calc != null) {
                number(sheet, rowNum, c, calc.matchedAspirations, computedStyle);
                number(sheet, rowNum, c + 1, calc.hasMatch, computedStyle);
                text(sheet, rowNum, c + 2, calc.suitabilityTopStream, computedStyle);
                text(sheet, rowNum, c + 3, calc.topAspirationStream, computedStyle);
                number(sheet, rowNum, c + 4, calc.abilities10Plus, computedStyle);
                number(sheet, rowNum, c + 5, calc.abilities8OrLess, computedStyle);
            }
            rowNum++;
        }

        sheet.createFreezePane(5, SchoolReportService.FIRST_DATA_ROW - 1);
        autoSize(sheet, 5);
    }

    // ────────────────────────── 2. SUMMARY ───────────────────────────

    private void writeSummary(XSSFWorkbook workbook, SchoolDashboard dashboard) {
        Sheet sheet = workbook.createSheet("2. SUMMARY");
        SchoolDashboard.SummarySheet s = dashboard.summary;

        text(sheet, 1, 1, "SCHOOL SUMMARY", titleStyle);
        text(sheet, 2, 1, "Every number on every sheet except '8. BY CLASS' respects the class filter below.",
                noteStyle);
        text(sheet, 3, 3, "min", noteStyle);
        text(sheet, 3, 4, "max", noteStyle);
        text(sheet, 4, 1, "CLASS FILTER", sectionStyle);
        text(sheet, 4, 2, dashboard.filter.label, labelStyle);
        number(sheet, 4, 3, dashboard.filter.min, numberStyle);
        number(sheet, 4, 4, dashboard.filter.max, numberStyle);

        text(sheet, 6, 0, "HEADCOUNT", sectionStyle);
        text(sheet, 7, 1, "Metric", headerStyle);
        text(sheet, 7, 2, "Value", headerStyle);
        metric(sheet, 8, "Students in view", s.studentsInView);
        metric(sheet, 9, "Girls", s.girls);
        metric(sheet, 10, "Boys", s.boys);
        metric(sheet, 11, "Career clarity % — students with at least one aspiration that matches "
                + "their suitability", s.careerClarityPct);
        text(sheet, 12, 1, "Average matched aspirations per student", labelStyle);
        decimal(sheet, 12, 2, s.avgMatchedAspirations);

        text(sheet, 14, 0, "STUDENTS BY CLASS", sectionStyle);
        text(sheet, 15, 1, "Class", headerStyle);
        text(sheet, 15, 2, "Students", headerStyle);
        text(sheet, 15, 3, "% of school", headerStyle);
        int row = 16;
        for (ClassCount classCount : s.studentsByClass) {
            text(sheet, row, 1, classCount.label, labelStyle);
            number(sheet, row, 2, classCount.students, numberStyle);
            number(sheet, row, 3, classCount.pctOfSchool, numberStyle);
            row++;
        }
        text(sheet, row, 1, "Total", headerStyle);
        number(sheet, row, 2, s.totalStudents, headerStyle);

        // The template puts the section heading in column A of the same row the
        // first headline occupies in columns B and C.
        int line = row + 2;
        text(sheet, line, 0, "THE SCHOOL IN ONE LINE", sectionStyle);
        headline(sheet, line, "Dominant personality", s.dominantPersonality);
        headline(sheet, ++line, "Second personality", s.secondPersonality);
        headline(sheet, ++line, "Dominant learning style", s.dominantLearningStyle);
        headline(sheet, ++line, "Weakest learning style", s.weakestLearningStyle);
        headline(sheet, ++line, "Strongest ability", s.strongestAbility);
        headline(sheet, ++line, "Weakest ability", s.weakestAbility);
        headline(sheet, ++line, "Top value", s.topValue);
        headline(sheet, ++line, "Best-fit stream", s.bestFitStream);
        headline(sheet, ++line, "Most-wanted stream", s.mostWantedStream);

        autoSize(sheet, 4);
    }

    private void metric(Sheet sheet, int row, String label, int value) {
        text(sheet, row, 1, label, labelStyle);
        number(sheet, row, 2, value, numberStyle);
    }

    private void headline(Sheet sheet, int row, String label, String value) {
        text(sheet, row, 1, label, labelStyle);
        text(sheet, row, 2, value, null);
    }

    // ──────────────────────── 3. PERSONALITY ─────────────────────────

    private void writePersonality(XSSFWorkbook workbook, SchoolDashboard dashboard) {
        Sheet sheet = workbook.createSheet("3. PERSONALITY");
        SchoolDashboard.PersonalitySheet p = dashboard.personality;

        text(sheet, 1, 0, "3. PERSONALITY", titleStyle);
        text(sheet, 2, 0, "Raw RIASEC average, plus how often each trait lands in a student's "
                + "top one and top three.", noteStyle);
        header(sheet, 5, 1, "Trait (report label)", "Avg raw score", "% as top trait",
                "% in top three", "Students, top trait", "Students, in top three");

        int row = 6;
        for (TraitRow trait : p.traits) {
            text(sheet, row, 1, trait.label, labelStyle);
            decimal(sheet, row, 2, trait.avgRawScore);
            number(sheet, row, 3, trait.pctAsTopTrait, numberStyle);
            number(sheet, row, 4, trait.pctInTopThree, numberStyle);
            number(sheet, row, 5, trait.studentsTopTrait, numberStyle);
            number(sheet, row, 6, trait.studentsInTopThree, numberStyle);
            row++;
        }
        text(sheet, row, 1, "Total", headerStyle);
        number(sheet, row, 3, p.totalTopTraitPct, headerStyle);

        text(sheet, row + 2, 1, "SPREAD — how concentrated the school is", sectionStyle);
        metric(sheet, row + 3, "Highest trait share", p.highestTraitShare);
        metric(sheet, row + 4, "Lowest trait share", p.lowestTraitShare);
        metric(sheet, row + 5, "Spread (highest minus lowest)", p.spread);
        metric(sheet, row + 6, "Traits above 20%", p.traitsAbove20);

        autoSize(sheet, 7);
    }

    // ─────────────────────── 4. LEARNING STYLE ───────────────────────

    private void writeLearningStyle(XSSFWorkbook workbook, SchoolDashboard dashboard) {
        Sheet sheet = workbook.createSheet("4. LEARNING STYLE");
        text(sheet, 1, 0, "4. LEARNING STYLE", titleStyle);
        text(sheet, 2, 0, "Multiple-intelligence profile. 'Strong' is a score of 10 or more "
                + "out of 12; 'low' is 8 or under.", noteStyle);
        header(sheet, 5, 1, "Intelligence", "% strong", "% low", "Avg score",
                "Students strong", "Students low");

        int row = 6;
        for (IntelligenceRow intelligence : dashboard.learningStyle.intelligences) {
            text(sheet, row, 1, intelligence.label, labelStyle);
            number(sheet, row, 2, intelligence.pctStrong, numberStyle);
            number(sheet, row, 3, intelligence.pctLow, numberStyle);
            decimal(sheet, row, 4, intelligence.avgScore);
            number(sheet, row, 5, intelligence.studentsStrong, numberStyle);
            number(sheet, row, 6, intelligence.studentsLow, numberStyle);
            row++;
        }
        autoSize(sheet, 7);
    }

    // ───────────────────────── 5. ABILITIES ──────────────────────────

    private void writeAbilities(XSSFWorkbook workbook, SchoolDashboard dashboard) {
        Sheet sheet = workbook.createSheet("5. ABILITIES");
        text(sheet, 1, 0, "5. ABILITIES", titleStyle);
        text(sheet, 2, 0, "Strong = 10 or more out of 12. Low = 8 or under. The gap column is "
                + "how much bigger the weak group is than the strong group.", noteStyle);
        header(sheet, 5, 1, "Ability", "% strong", "% low", "Gap (low minus strong)",
                "Avg score", "Students strong", "Students low");

        int row = 6;
        for (AbilityRow ability : dashboard.abilities.abilities) {
            text(sheet, row, 1, ability.label, labelStyle);
            number(sheet, row, 2, ability.pctStrong, numberStyle);
            number(sheet, row, 3, ability.pctLow, numberStyle);
            number(sheet, row, 4, ability.gap, numberStyle);
            decimal(sheet, row, 5, ability.avgScore);
            number(sheet, row, 6, ability.studentsStrong, numberStyle);
            number(sheet, row, 7, ability.studentsLow, numberStyle);
            row++;
        }

        row++;
        text(sheet, row, 1, "ABILITY LOAD PER STUDENT", sectionStyle);
        text(sheet, ++row, 1, "Average abilities scored 10+", labelStyle);
        decimal(sheet, row, 2, dashboard.abilities.avgAbilities10Plus);
        text(sheet, ++row, 1, "Average abilities scored 8-", labelStyle);
        decimal(sheet, row, 2, dashboard.abilities.avgAbilities8OrLess);
        text(sheet, ++row, 1, "Students with 5+ weak abilities", labelStyle);
        number(sheet, row, 2, dashboard.abilities.studentsWith5PlusWeak, numberStyle);
        text(sheet, ++row, 1, "… as % of school", labelStyle);
        number(sheet, row, 2, dashboard.abilities.pctWith5PlusWeak, numberStyle);

        autoSize(sheet, 8);
    }

    // ────────────────────────── 6. VALUES ────────────────────────────

    private void writeValues(XSSFWorkbook workbook, SchoolDashboard dashboard) {
        Sheet sheet = workbook.createSheet("6. VALUES");
        text(sheet, 1, 0, "6. VALUES", titleStyle);
        text(sheet, 2, 0, "What students say they want from work. Percentage placing each value "
                + "anywhere in their top five.", noteStyle);
        header(sheet, 5, 1, "Value", "% in top five", "Students", "Rank");

        int row = 6;
        for (ValueRow value : dashboard.values.values) {
            text(sheet, row, 1, value.label, labelStyle);
            number(sheet, row, 2, value.pctInTopFive, numberStyle);
            number(sheet, row, 3, value.students, numberStyle);
            number(sheet, row, 4, value.rank, numberStyle);
            row++;
        }
        autoSize(sheet, 5);
    }

    // ──────────────────────── 7. CAREER GAP ──────────────────────────

    private void writeCareerGap(XSSFWorkbook workbook, SchoolDashboard dashboard) {
        Sheet sheet = workbook.createSheet("7. CAREER GAP");
        text(sheet, 1, 0, "7. CAREER GAP", titleStyle);
        text(sheet, 2, 0, "Where students are suited versus where they want to go. Gap is "
                + "aspiring minus suited — positive means more students want it than fit it.", noteStyle);
        header(sheet, 5, 1, "Stream", "Suited %", "Aspiring %", "Gap",
                "Students suited", "Students aspiring");

        int row = 6;
        for (StreamRow stream : dashboard.careerGap.streams) {
            text(sheet, row, 1, stream.label, labelStyle);
            number(sheet, row, 2, stream.suitedPct, numberStyle);
            number(sheet, row, 3, stream.aspiringPct, numberStyle);
            number(sheet, row, 4, stream.gap, numberStyle);
            number(sheet, row, 5, stream.studentsSuited, numberStyle);
            number(sheet, row, 6, stream.studentsAspiring, numberStyle);
            row++;
        }

        text(sheet, ++row, 1, "BY CAREER CLUSTER", sectionStyle);
        header(sheet, ++row, 1, "Career cluster", "Suited (top 3)", "Aspiring", "Gap",
                "Readiness %", "Stream");
        row++;
        for (ClusterRow cluster : dashboard.careerGap.clusters) {
            text(sheet, row, 1, cluster.label, labelStyle);
            number(sheet, row, 2, cluster.suitedTop3, numberStyle);
            number(sheet, row, 3, cluster.aspiring, numberStyle);
            number(sheet, row, 4, cluster.gap, numberStyle);
            number(sheet, row, 5, cluster.readinessPct, numberStyle);
            text(sheet, row, 6, cluster.stream, null);
            row++;
        }
        text(sheet, row + 1, 1, "Readiness % = of the students who want this cluster, the share "
                + "whose own profile also lists it. Blank means nobody chose it.", noteStyle);

        autoSize(sheet, 7);
    }

    // ───────────────────────── 8. BY CLASS ───────────────────────────

    private void writeByClass(XSSFWorkbook workbook, SchoolDashboard dashboard) {
        Sheet sheet = workbook.createSheet("8. BY CLASS");
        SchoolDashboard.ByClassSheet b = dashboard.byClass;

        text(sheet, 1, 0, "8. BY CLASS", titleStyle);
        text(sheet, 2, 0, "Class-by-class comparison. This sheet ignores the class filter on "
                + "purpose, so you can see the whole school side by side.", noteStyle);

        for (int c = 0; c < b.classes.size(); c++) {
            text(sheet, 4, c + 1, "Class " + b.classes.get(c), headerStyle);
        }
        intRow(sheet, 5, "Students", b.students);
        intRow(sheet, 6, "Career clarity %", b.careerClarityPct);
        intRow(sheet, 7, "Students with 5+ weak abilities", b.fiveOrMoreWeakAbilities);

        int row = 9;
        row = block(sheet, row, "PERSONALITY — % as top trait", b.personalityTopTraitPct);
        row = block(sheet, row, "LEARNING STYLE — % strong", b.learningStyleStrongPct);
        row = block(sheet, row, "ABILITIES — % low (8 or under)", b.abilityLowPct);
        block(sheet, row, "STREAM FIT vs WISH — % of class", b.streamFitVsWish);

        autoSize(sheet, 8);
    }

    private int block(Sheet sheet, int row, String title, List<LabeledSeries> series) {
        text(sheet, row, 0, title, sectionStyle);
        row++;
        for (LabeledSeries entry : series) {
            intRow(sheet, row, entry.label, entry.values);
            row++;
        }
        return row + 1;
    }

    private void intRow(Sheet sheet, int row, String label, List<Integer> values) {
        text(sheet, row, 0, label, labelStyle);
        for (int c = 0; c < values.size(); c++) {
            number(sheet, row, c + 1, values.get(c), numberStyle);
        }
    }

    // ────────────────────────── 9. CHARTS ────────────────────────────

    private void writeCharts(XSSFWorkbook workbook, SchoolDashboard dashboard) {
        Sheet sheet = workbook.createSheet("9. CHARTS");
        SchoolDashboard.ChartsSheet c = dashboard.charts;

        text(sheet, 1, 0, "9. CHARTS", titleStyle);
        text(sheet, 2, 0, "Chart-ready copies of the numbers on sheets 2-7, for the class filter "
                + "shown on sheet 2. Screen-share this tab.", noteStyle);

        int row = 5;
        row = singleSeries(sheet, row, "Personality mix", "% as top trait", c.personalityMix);
        row = singleSeries(sheet, row, "Learning style", "% strong", c.learningStyle);
        row = pairSeries(sheet, row, "Abilities", "Strong", "Low", c.abilities);
        row = singleSeries(sheet, row, "Values", "% in top five", c.values);
        row = pairSeries(sheet, row, "Stream fit vs wish", "Suited", "Aspiring", c.streamFitVsWish);
        singleSeries(sheet, row, "Students by class", "Students", c.studentsByClass);

        autoSize(sheet, 4);
    }

    private int singleSeries(Sheet sheet, int row, String title, String seriesLabel,
            List<LabeledValue> data) {
        text(sheet, row, 1, title, sectionStyle);
        text(sheet, row, 2, seriesLabel, headerStyle);
        row++;
        for (LabeledValue entry : data) {
            text(sheet, row, 1, entry.label, labelStyle);
            number(sheet, row, 2, entry.value, numberStyle);
            row++;
        }
        return row + 1;
    }

    private int pairSeries(Sheet sheet, int row, String title, String firstLabel,
            String secondLabel, List<LabeledPair> data) {
        // Two-series blocks carry the title on its own row, then a header row.
        text(sheet, row, 1, title, sectionStyle);
        row++;
        text(sheet, row, 2, firstLabel, headerStyle);
        text(sheet, row, 3, secondLabel, headerStyle);
        row++;
        for (LabeledPair entry : data) {
            text(sheet, row, 1, entry.label, labelStyle);
            number(sheet, row, 2, entry.first, numberStyle);
            number(sheet, row, 3, entry.second, numberStyle);
            row++;
        }
        return row + 1;
    }

    // ───────────────────────── CELL PLUMBING ─────────────────────────

    /**
     * {@code excelRow} is the workbook's own 1-based row number, so call sites
     * read like the cell references in the template ({@code (25, 1)} is B25).
     * {@code col} is a 0-based column index, 0 = A. POI is 0-based on both, so
     * only the row is shifted here.
     */
    private static Cell cellAt(Sheet sheet, int excelRow, int col) {
        int rowIndex = excelRow - 1;
        Row r = sheet.getRow(rowIndex);
        if (r == null) {
            r = sheet.createRow(rowIndex);
        }
        Cell c = r.getCell(col);
        return c != null ? c : r.createCell(col);
    }

    private void text(Sheet sheet, int row, int col, String value, CellStyle style) {
        Cell cell = cellAt(sheet, row, col);
        cell.setCellValue(value != null ? value : "");
        if (style != null) {
            cell.setCellStyle(style);
        }
    }

    /** A null number leaves the cell genuinely blank, matching the workbook's {@code ""}. */
    private void number(Sheet sheet, int row, int col, Integer value, CellStyle style) {
        if (value == null) {
            return;
        }
        Cell cell = cellAt(sheet, row, col);
        cell.setCellValue(value.doubleValue());
        if (style != null) {
            cell.setCellStyle(style);
        }
    }

    private void decimal(Sheet sheet, int row, int col, double value) {
        Cell cell = cellAt(sheet, row, col);
        cell.setCellValue(value);
        cell.setCellStyle(decimalStyle);
    }

    private void header(Sheet sheet, int row, int startCol, String... titles) {
        for (int i = 0; i < titles.length; i++) {
            text(sheet, row, startCol + i, titles[i], headerStyle);
        }
    }

    private int numbers(Sheet sheet, int row, int startCol, Integer[] values, int count) {
        for (int i = 0; i < count; i++) {
            Integer value = values != null && i < values.length ? values[i] : null;
            number(sheet, row, startCol + i, value, numberStyle);
        }
        return startCol + count;
    }

    private int texts(Sheet sheet, int row, int startCol, String[] values, int count) {
        for (int i = 0; i < count; i++) {
            String value = values != null && i < values.length ? values[i] : null;
            if (value != null && !value.isEmpty()) {
                text(sheet, row, startCol + i, value, null);
            }
        }
        return startCol + count;
    }

    private void autoSize(Sheet sheet, int columns) {
        for (int i = 0; i < columns; i++) {
            sheet.autoSizeColumn(i);
            // autoSizeColumn measures content only; long prose labels would
            // otherwise stretch a column across the screen.
            if (sheet.getColumnWidth(i) > 16000) {
                sheet.setColumnWidth(i, 16000);
            }
        }
    }

    private void initStyles(XSSFWorkbook workbook) {
        Font titleFont = workbook.createFont();
        titleFont.setBold(true);
        titleFont.setFontHeightInPoints((short) 14);
        titleStyle = workbook.createCellStyle();
        titleStyle.setFont(titleFont);

        Font noteFont = workbook.createFont();
        noteFont.setItalic(true);
        noteFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
        noteStyle = workbook.createCellStyle();
        noteStyle.setFont(noteFont);

        Font boldFont = workbook.createFont();
        boldFont.setBold(true);

        sectionStyle = workbook.createCellStyle();
        sectionStyle.setFont(boldFont);

        headerStyle = workbook.createCellStyle();
        headerStyle.setFont(boldFont);
        headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

        labelStyle = workbook.createCellStyle();

        numberStyle = workbook.createCellStyle();
        numberStyle.setAlignment(HorizontalAlignment.RIGHT);

        decimalStyle = workbook.createCellStyle();
        decimalStyle.setAlignment(HorizontalAlignment.RIGHT);
        decimalStyle.setDataFormat(workbook.createDataFormat().getFormat("0.0#"));

        computedStyle = workbook.createCellStyle();
        computedStyle.setAlignment(HorizontalAlignment.RIGHT);
        computedStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        computedStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
    }
}
