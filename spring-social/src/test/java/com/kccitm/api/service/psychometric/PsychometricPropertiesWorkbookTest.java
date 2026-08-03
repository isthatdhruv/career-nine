package com.kccitm.api.service.psychometric;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Random;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import com.kccitm.api.service.psychometric.PsychometricDataset.StudentRecord;

/**
 * Exercises the psychometric export against the bundled template with a
 * synthetic 400-student cohort. The shipped workbook is raw-data-only
 * ({@code buildWorkbook}); a second test keeps the currently-disabled
 * statistical fillers compiling and correct should they be re-enabled.
 */
class PsychometricPropertiesWorkbookTest {

    @Test
    void buildsRawDataOnlyWorkbook() throws Exception {
        PsychometricDataset ds = syntheticCohort(400);
        PsychometricPropertiesExportService service = new PsychometricPropertiesExportService();

        try (InputStream in = template(); XSSFWorkbook wb = new XSSFWorkbook(in)) {
            service.buildWorkbook(wb, ds);

            // Only the raw data sheet survives
            assertEquals(1, wb.getNumberOfSheets());
            Sheet raw = wb.getSheetAt(0);
            assertEquals("Psychometric properties of Navi", raw.getSheetName());

            // Header row intact, one row per student beneath it
            assertEquals("SCHOOL NAME", raw.getRow(0).getCell(0).getStringCellValue());
            assertEquals("Student A0", raw.getRow(1).getCell(1).getStringCellValue());
            assertEquals("Student A399", raw.getRow(400).getCell(1).getStringCellValue());
            assertTrue(raw.getRow(401) == null || raw.getRow(401).getCell(1) == null
                    || raw.getRow(401).getCell(1).getCellType() == CellType.BLANK);
            assertEquals("Keep", raw.getRow(1).getCell(27).getStringCellValue());
            // Last populated column block: suitability_index_9 (col 171)
            assertNotNull(raw.getRow(1).getCell(170).getStringCellValue());

            Path out = Path.of("target", "psychometric-test.xlsx");
            Files.createDirectories(out.getParent());
            try (FileOutputStream fos = new FileOutputStream(out.toFile())) {
                wb.write(fos);
            }
        }
    }

    /**
     * The statistical sheets are pruned from the shipped export, but their
     * fillers stay in the codebase for re-enablement — keep them working.
     */
    @Test
    void disabledStatisticalFillersStillFillTheirSheets() throws Exception {
        PsychometricDataset ds = syntheticCohort(400);
        PsychometricPropertiesExportService service = new PsychometricPropertiesExportService();

        try (InputStream in = template(); XSSFWorkbook wb = new XSSFWorkbook(in)) {
            service.fillRawData(wb, ds);
            service.fillPsychometricAnalysis(wb, ds);
            service.fillItemAnalysis(wb, ds);
            service.fillNorms(wb, ds);
            service.fillPredictive(wb, ds);
            PsychometricAdvancedSheets.fillIrt(wb, ds);
            PsychometricAdvancedSheets.fillCfaRiasec(wb, ds);
            PsychometricAdvancedSheets.fillCfaGradeWise(wb, ds);
            PsychometricAdvancedSheets.fillCfaAbility(wb, ds);
            PsychometricAdvancedSheets.fillCfaMi(wb, ds);
            PsychometricAdvancedSheets.fillEngineeringPatterns(wb, ds);
            PsychometricAdvancedSheets.fillPsychometricStudy(wb, ds);

            Sheet pa = wb.getSheet("Psychometric Analysis");
            for (int col = 2; col <= 4; col++) {
                assertNumeric(pa, 12, col);
            }
            Sheet ia = wb.getSheet("Item Analysis");
            assertEquals("Naturalistic 3", ia.getRow(378).getCell(1).getStringCellValue());
            Sheet irt = wb.getSheet("IRT Analysis by Grade");
            assertEquals("R1", irt.getRow(1).getCell(2).getStringCellValue());
            assertEquals("Naturalistic 3", irt.getRow(324).getCell(2).getStringCellValue());
            Sheet cfar = findSheet(wb, "RIASEC Item Analysis");
            assertEquals(54, (int) cfar.getRow(102).getCell(1).getNumericCellValue());
            Sheet norms = wb.getSheet("Sheet1");
            assertNumeric(norms, 66, 9);
            Sheet eng = wb.getSheet("Engineering Patterns");
            double engN = eng.getRow(5).getCell(1).getNumericCellValue();
            double nonN = eng.getRow(5).getCell(2).getNumericCellValue();
            assertEquals(400, (int) (engN + nonN));
            Sheet ps = wb.getSheet("Psychometric Study");
            assertEquals("N = 400 valid students | 34 career categories | 9 suitability indices per student",
                    ps.getRow(1).getCell(0).getStringCellValue());
        }
    }

    private InputStream template() {
        InputStream in = getClass()
                .getResourceAsStream("/psychometric-template/psychometric-properties-template.xlsx");
        assertNotNull(in, "template resource must be on the classpath");
        return in;
    }

    private static void assertNumeric(Sheet sheet, int row1, int col1) {
        Row row = sheet.getRow(row1 - 1);
        assertNotNull(row, "row " + row1 + " on " + sheet.getSheetName());
        Cell cell = row.getCell(col1 - 1);
        assertNotNull(cell, "cell r" + row1 + "c" + col1 + " on " + sheet.getSheetName());
        assertEquals(CellType.NUMERIC, cell.getCellType(),
                "cell r" + row1 + "c" + col1 + " on " + sheet.getSheetName());
    }

    private static Sheet findSheet(XSSFWorkbook wb, String part) {
        for (int i = 0; i < wb.getNumberOfSheets(); i++) {
            if (wb.getSheetName(i).contains(part)) return wb.getSheetAt(i);
        }
        throw new AssertionError("no sheet containing " + part);
    }

    /** Deterministic cohort with plausible answer distributions. */
    private static PsychometricDataset syntheticCohort(int n) {
        Random rnd = new Random(42);
        PsychometricDataset ds = new PsychometricDataset();
        String[] careers = {"Engineering and Technology", "Science and Mathematics",
                "Law Studies", "Architecture", "Banking and Finance", "Sports",
                "Computer Science, IT and Allied Fields", "Paramedical", "Logical reasoning"};

        for (int i = 0; i < n; i++) {
            StudentRecord r = new StudentRecord();
            r.school = "Synthetic School";
            r.name = "Student A" + i;
            r.studentClass = 6 + rnd.nextInt(7);
            r.band = PsychometricDataset.bandOf(r.studentClass);

            double trait = rnd.nextGaussian();
            r.riasecItems = new Integer[54];
            for (int q = 0; q < 54; q++) {
                r.riasecItems[q] = rnd.nextDouble() < 0.995
                        ? (rnd.nextGaussian() + trait > -0.6 ? 2 : 1) : null;
            }
            r.aptitudeItems = new Integer[30];
            for (int q = 0; q < 30; q++) {
                r.aptitudeItems[q] = rnd.nextDouble() < 0.99
                        ? Math.max(1, Math.min(4, (int) Math.round(2.8 + trait * 0.7 + rnd.nextGaussian())))
                        : null;
            }
            r.miItems = new Integer[24];
            for (int q = 0; q < 24; q++) {
                r.miItems[q] = rnd.nextDouble() < 0.98
                        ? Math.max(1, Math.min(4, (int) Math.round(2.9 + trait * 0.6 + rnd.nextGaussian())))
                        : null;
            }

            for (int s = 0; s < 6; s++) {
                int t = 0;
                for (int q = s; q < 54; q += 6) t += r.riasecItems[q] != null ? r.riasecItems[q] : 1;
                r.riasecTotals[s] = t;
            }
            for (int s = 0; s < 10; s++) {
                int t = 0;
                for (int q = s; q < 30; q += 10) t += r.aptitudeItems[q] != null ? r.aptitudeItems[q] : 0;
                r.abilityTotals[s] = t;
            }
            for (int s = 0; s < 8; s++) {
                int t = 0;
                for (int q = s * 3; q < s * 3 + 3; q++) t += r.miItems[q] != null ? r.miItems[q] : 0;
                r.miTotals[s] = t;
            }

            r.personalityTop[0] = PsychometricDataset.RIASEC_FULL_NAMES[rnd.nextInt(6)];
            r.personalityTop[1] = PsychometricDataset.RIASEC_FULL_NAMES[rnd.nextInt(6)];
            r.personalityTop[2] = PsychometricDataset.RIASEC_FULL_NAMES[rnd.nextInt(6)];
            r.intelligenceTop[0] = PsychometricDataset.MI_NAMES[rnd.nextInt(8)];
            r.abilityTop[0] = PsychometricDataset.ABILITY_NAMES[rnd.nextInt(10)];
            for (int s = 0; s < 9; s++) {
                r.suitabilityIndex[s] = careers[rnd.nextInt(careers.length)];
            }
            ds.records.add(r);
        }
        return ds;
    }
}
