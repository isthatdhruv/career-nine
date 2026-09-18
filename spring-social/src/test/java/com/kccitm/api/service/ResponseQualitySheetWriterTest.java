package com.kccitm.api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.FileOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.CellValue;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import com.kccitm.api.service.ResponseQualitySheetWriter.StudentItems;

class ResponseQualitySheetWriterTest {

    private static final int DATA_COLS = 20;

    /**
     * A consistent respondent: one trait per RIASEC scale drives the Yes/No
     * answers, and the cognitive marks spread over all four options around an
     * ability level — so the scatter stays below 1.03 and no single option
     * dominates.
     */
    private static StudentItems genuine(long id, Random rnd) {
        double[] trait = new double[6];
        for (int s = 0; s < 6; s++) trait[s] = rnd.nextGaussian() * 2;
        Integer[] p = new Integer[54];
        for (int q = 0; q < 54; q++) p[q] = trait[q % 6] + rnd.nextGaussian() * 0.5 > 0 ? 2 : 1;
        double ability = 2.5 + rnd.nextGaussian() * 0.4;
        Integer[] a = new Integer[30];
        for (int q = 0; q < 30; q++) a[q] = mark(ability, rnd);
        Integer[] m = new Integer[24];
        for (int q = 0; q < 24; q++) m[q] = mark(ability, rnd);
        return new StudentItems(id, "Genuine " + id, p, a, m);
    }

    private static int mark(double ability, Random rnd) {
        return Math.max(1, Math.min(4, (int) Math.round(ability + rnd.nextGaussian() * 0.75)));
    }

    private static StudentItems randomClicker(long id, Random rnd) {
        Integer[] p = new Integer[54];
        for (int q = 0; q < 54; q++) p[q] = rnd.nextBoolean() ? 2 : 1;
        Integer[] a = new Integer[30];
        for (int q = 0; q < 30; q++) a[q] = 1 + rnd.nextInt(4);
        Integer[] m = new Integer[24];
        for (int q = 0; q < 24; q++) m[q] = 1 + rnd.nextInt(4);
        return new StudentItems(id, "Random " + id, p, a, m);
    }

    private static StudentItems constant(long id, int cognitive, int personality) {
        Integer[] p = new Integer[54];
        Arrays.fill(p, personality);
        Integer[] a = new Integer[30];
        Arrays.fill(a, cognitive);
        Integer[] m = new Integer[24];
        Arrays.fill(m, cognitive);
        return new StudentItems(id, "Constant " + id, p, a, m);
    }

    /** Data sheet shaped like the real export: header row 0, one student per row from row 1. */
    private static Sheet dataSheet(XSSFWorkbook wb, List<StudentItems> students) {
        Sheet sheet = wb.createSheet("Assessment Data");
        Row header = sheet.createRow(0);
        for (int c = 0; c < DATA_COLS; c++) header.createCell(c).setCellValue("H" + c);
        for (int i = 0; i < students.size(); i++) {
            Row row = sheet.createRow(1 + i);
            row.createCell(0).setCellValue(students.get(i).userStudentId);
            row.createCell(1).setCellValue(students.get(i).name);
        }
        return sheet;
    }

    private static Cell cell(Sheet sheet, int col1, int row1) {
        Row row = sheet.getRow(row1 - 1);
        assertNotNull(row, "row " + row1);
        Cell c = row.getCell(col1 - 1);
        assertNotNull(c, "cell " + ResponseQualitySheetWriter.ref(col1, row1));
        return c;
    }

    @Test
    void layoutFormulasAndCachedValues() throws Exception {
        Random rnd = new Random(5);
        List<StudentItems> students = new ArrayList<>();
        for (int i = 0; i < 100; i++) students.add(genuine(1000 + i, rnd));
        int firstRandom = students.size();
        for (int i = 0; i < 30; i++) students.add(randomClicker(2000 + i, rnd));
        int constantIdx = students.size();
        students.add(constant(3000, 2, 2));

        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet data = dataSheet(wb, students);
            ResponseQualitySheetWriter.write(wb, data, DATA_COLS, students);

            Sheet rq = wb.getSheet("Response Quality");
            assertNotNull(rq);
            int lastRow = 3 + students.size() - 1;

            // The analyst's column letters: personality B..BC, cognitive BD..DE, formulas from DG.
            assertEquals("B", ResponseQualitySheetWriter.colName(ResponseQualitySheetWriter.COL_PERSONALITY_FIRST));
            assertEquals("BC", ResponseQualitySheetWriter.colName(ResponseQualitySheetWriter.COL_PERSONALITY_FIRST + 53));
            assertEquals("BD", ResponseQualitySheetWriter.colName(ResponseQualitySheetWriter.COL_COGNITIVE_FIRST));
            assertEquals("DE", ResponseQualitySheetWriter.colName(ResponseQualitySheetWriter.COL_COGNITIVE_FIRST + 53));
            assertEquals("DG", ResponseQualitySheetWriter.colName(ResponseQualitySheetWriter.COL_SCATTER));
            assertEquals("DK", ResponseQualitySheetWriter.colName(ResponseQualitySheetWriter.COL_VERDICT));

            // Helper row of item averages above the cognitive items
            assertEquals("IFERROR(AVERAGE(BD$3:BD$" + lastRow + "),0)", cell(rq, 56, 2).getCellFormula());
            assertEquals("Item average (helper row)", cell(rq, 1, 2).getStringCellValue());

            // Row 3 = first student: the four indices, verdict, flags, odd/even, CORREL
            assertEquals("IFERROR(STDEV(BD3:DE3),0)", cell(rq, 111, 3).getCellFormula());
            assertEquals("SUMPRODUCT((BD3:DE3-BD$2:DE$2)^2)/54", cell(rq, 112, 3).getCellFormula());
            assertEquals("MAX(COUNTIF(BD3:DE3,1),COUNTIF(BD3:DE3,2),COUNTIF(BD3:DE3,3),COUNTIF(BD3:DE3,4))",
                    cell(rq, 113, 3).getCellFormula());
            assertEquals("COUNTIF(B3:BC3,2)/54", cell(rq, 114, 3).getCellFormula());
            assertEquals("IF((DG3>=1.03)+(DH3>PERCENTILE(DH$3:DH$" + lastRow + ",0.95))+(DI3>24)"
                    + "+(OR(DJ3<0.15,DJ3>0.85))>=2,\"EXCLUDE\",\"OK\")", cell(rq, 115, 3).getCellFormula());
            assertTrue(cell(rq, 116, 3).getCellFormula().startsWith("TRIM(IF(DG3>=1.03,\"Scatter \",\"\")"));
            // R scale odd items are questions 1,13,25,37,49 → B, N, Z, AL, AX
            assertEquals("IFERROR(AVERAGE(B3,N3,Z3,AL3,AX3),\"\")", cell(rq, 117, 3).getCellFormula());
            // R scale even items are questions 7,19,31,43 → H, T, AF, AR
            assertEquals("IFERROR(AVERAGE(H3,T3,AF3,AR3),\"\")", cell(rq, 123, 3).getCellFormula());
            assertEquals("IFERROR(CORREL(DM3:DR3,DS3:DX3),\"\")", cell(rq, 129, 3).getCellFormula());

            // Cached values. Scatter separates the two groups cleanly, which is
            // what the analyst calls the main index. Straightlining does not: on
            // a four-mark scale an ordinary respondent's modal mark often passes
            // 24 of 54, so that index fires for a majority here and the two-flag
            // rule is what keeps them in. The genuine assertion is therefore on
            // the verdict, not on that flag.
            int genuineExcluded = 0;
            for (int i = 0; i < firstRandom; i++) {
                assertTrue(!cell(rq, 116, 3 + i).getStringCellValue().contains("Scatter"));
                if ("EXCLUDE".equals(cell(rq, 115, 3 + i).getStringCellValue())) genuineExcluded++;
            }
            assertTrue(genuineExcluded <= firstRandom * 0.15, "genuine excluded " + genuineExcluded);
            // Random clickers: the sample SD of 54 uniform 1-4 marks sits at
            // 1.118 with a spread of about 0.11, so the 1.03 cut-off catches most
            // of them but not every one — assert the group, not each student.
            int randomScattered = 0;
            for (int i = firstRandom; i < constantIdx; i++) {
                if (cell(rq, 111, 3 + i).getNumericCellValue() >= 1.03) randomScattered++;
            }
            assertTrue(randomScattered >= (constantIdx - firstRandom) * 0.7,
                    "random scattered " + randomScattered + " of " + (constantIdx - firstRandom));
            // The analyst's extra index: real respondents above 0.4, random near 0.
            // A student who answered every item the same way has constant odd and
            // even means, so CORREL is undefined and the cell holds "" — those are
            // left out of the average rather than counted as zero.
            double genuineR = meanCorrel(rq, 3, firstRandom);
            double randomR = meanCorrel(rq, 3 + firstRandom, constantIdx - firstRandom);
            assertTrue(genuineR > 0.4, "genuine mean r " + genuineR);
            assertTrue(Math.abs(randomR) < 0.4, "random mean r " + randomR);
            int cr = 3 + constantIdx;
            assertEquals(0.0, cell(rq, 111, cr).getNumericCellValue(), 1e-9);
            assertEquals(54, (int) cell(rq, 113, cr).getNumericCellValue());
            assertEquals(1.0, cell(rq, 114, cr).getNumericCellValue(), 1e-9);
            assertEquals("EXCLUDE", cell(rq, 115, cr).getStringCellValue());
            // Not "Distance": that index is cohort-relative, and with 30 random
            // clickers in the cohort the 95th-percentile cut-off sits above this row.
            assertEquals("Straightlining Extremeness", cell(rq, 116, cr).getStringCellValue());
            assertEquals("", cell(rq, 129, cr).getStringCellValue()); // CORREL undefined → ""

            // Echoed onto the data sheet, rows aligned (data row 1+i ↔ quality row 3+i)
            Row dh = data.getRow(0);
            assertEquals("Response Quality", dh.getCell(DATA_COLS).getStringCellValue());
            assertEquals("Response Quality Flags", dh.getCell(DATA_COLS + 1).getStringCellValue());
            Cell echo = data.getRow(1 + constantIdx).getCell(DATA_COLS);
            assertEquals(CellType.FORMULA, echo.getCellType());
            assertEquals("'Response Quality'!DK" + cr, echo.getCellFormula());
            assertEquals("EXCLUDE", echo.getStringCellValue());
            assertTrue(wb.getForceFormulaRecalculation());

            // POI's own engine agrees with the cached values wherever it can
            // evaluate the formula (SUMPRODUCT array arithmetic may not be supported).
            FormulaEvaluator ev = wb.getCreationHelper().createFormulaEvaluator();
            assertEquals(0.0, evalNum(ev, cell(rq, 111, cr)), 1e-9);
            assertEquals(54.0, evalNum(ev, cell(rq, 113, cr)), 1e-9);
            assertEquals(1.0, evalNum(ev, cell(rq, 114, cr)), 1e-9);
            Double firstScatter = evalNum(ev, cell(rq, 111, 3));
            assertNotNull(firstScatter);
            assertEquals(cell(rq, 111, 3).getNumericCellValue(), firstScatter, 1e-9);
            Double firstDistance = evalNum(ev, cell(rq, 112, 3));
            if (firstDistance != null) {
                assertEquals(cell(rq, 112, 3).getNumericCellValue(), firstDistance, 1e-9);
            }
            Double firstR = evalNum(ev, cell(rq, 129, 3));
            if (firstR != null) {
                assertEquals(cell(rq, 129, 3).getNumericCellValue(), firstR, 1e-9);
            }

            Path out = Path.of("target", "response-quality-test.xlsx");
            Files.createDirectories(out.getParent());
            try (FileOutputStream fos = new FileOutputStream(out.toFile())) {
                wb.write(fos);
            }
        }
    }

    @Test
    void blanksFollowExcelSemantics() throws Exception {
        // Student 0 skipped every MI item and all of RIASEC; student 1 is complete.
        StudentItems partial = new StudentItems(1, "Partial",
                new Integer[54], fill(30, 3), new Integer[24]);
        StudentItems full = constant(2, 3, 1);
        List<StudentItems> students = Arrays.asList(partial, full);

        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet data = dataSheet(wb, students);
            ResponseQualitySheetWriter.write(wb, data, DATA_COLS, students);
            Sheet rq = wb.getSheet("Response Quality");

            // Unanswered items are blank cells, not zeros
            assertNull(rq.getRow(2).getCell(ResponseQualitySheetWriter.COL_COGNITIVE_FIRST + 30 - 1));
            // STDEV ignores blanks: 30 identical answers → 0
            assertEquals(0.0, cell(rq, 111, 3).getNumericCellValue(), 1e-9);
            // SUMPRODUCT treats blanks as 0: MI averages are 3 (only "full" answered), so
            // 24 blanks contribute (0-3)^2 each → 24*9/54 = 4
            assertEquals(4.0, cell(rq, 112, 3).getNumericCellValue(), 1e-9);
            assertEquals(30, (int) cell(rq, 113, 3).getNumericCellValue());
            // No personality answers: 0 Yes of 54 → flagged extreme (as the formula would)
            assertEquals(0.0, cell(rq, 114, 3).getNumericCellValue(), 1e-9);
            assertTrue(cell(rq, 116, 3).getStringCellValue().contains("Extremeness"));
            assertEquals("", cell(rq, 117, 3).getStringCellValue()); // odd mean undefined → ""
            assertEquals("", cell(rq, 129, 3).getStringCellValue());
        }
    }

    /** Mean of the odd-even CORREL column over {@code count} rows, skipping the blank ("") ones. */
    private static double meanCorrel(Sheet rq, int firstRow, int count) {
        double sum = 0;
        int n = 0;
        for (int i = 0; i < count; i++) {
            Cell c = cell(rq, ResponseQualitySheetWriter.COL_ODD_EVEN_R, firstRow + i);
            if (c.getCellType() == CellType.FORMULA
                    ? c.getCachedFormulaResultType() == CellType.NUMERIC
                    : c.getCellType() == CellType.NUMERIC) {
                sum += c.getNumericCellValue();
                n++;
            }
        }
        assertTrue(n >= count * 0.9, "only " + n + " of " + count + " rows had a defined r");
        return sum / n;
    }

    private static Integer[] fill(int n, int v) {
        Integer[] a = new Integer[n];
        Arrays.fill(a, v);
        return a;
    }

    private static Double evalNum(FormulaEvaluator ev, Cell c) {
        try {
            CellValue v = ev.evaluate(c);
            return v != null && v.getCellType() == CellType.NUMERIC ? v.getNumberValue() : null;
        } catch (RuntimeException e) {
            return null;
        }
    }
}
