package com.kccitm.api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Manual integration check against the local dev database: runs the "Generate
 * Data Excel" export for a real Navigator assessment and reports how the
 * response-quality screen behaved on real answers. Run explicitly with:
 *
 * <pre>mvnw test -Dtest=DataExcelResponseQualityLocalIT -Ddataexcel.it=true
 *     -Ddataexcel.assessmentId=18</pre>
 */
@SpringBootTest
@ActiveProfiles("dev")
@EnabledIfSystemProperty(named = "dataexcel.it", matches = "true")
class DataExcelResponseQualityLocalIT {

    @Autowired
    private AssessmentDataExcelExportService service;

    @Test
    void exportsRealAssessmentWithFlags() throws Exception {
        long assessmentId = Long.getLong("dataexcel.assessmentId", 18L);
        byte[] bytes = service.exportStudentData(assessmentId, null);
        assertNotNull(bytes);
        Path out = Path.of("target", "data-excel-real-" + assessmentId + ".xlsx");
        Files.write(out, bytes);
        System.out.println("WROTE " + out.toAbsolutePath() + " (" + bytes.length + " bytes)");

        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            Sheet data = wb.getSheetAt(0);
            Sheet rq = wb.getSheet(ResponseQualitySheetWriter.SHEET_NAME);
            assertNotNull(rq, "Navigator assessment should get a Response Quality sheet");

            int verdictCol = -1;
            Row header = data.getRow(0);
            for (int c = 0; c < header.getLastCellNum(); c++) {
                Cell cell = header.getCell(c);
                if (cell != null && "Response Quality".equals(cell.getStringCellValue())) verdictCol = c;
            }
            assertTrue(verdictCol >= 0, "data sheet must carry the verdict column");

            int students = 0, exclude = 0;
            int[] perFlag = new int[4];
            String[] names = {"Scatter", "Distance", "Straightlining", "Extremeness"};
            for (int r = 3; r <= rq.getLastRowNum() + 1; r++) {
                Row row = rq.getRow(r - 1);
                if (row == null) continue;
                Cell verdict = row.getCell(ResponseQualitySheetWriter.COL_VERDICT - 1);
                if (verdict == null || verdict.getCellType() != CellType.FORMULA) continue;
                students++;
                if ("EXCLUDE".equals(verdict.getStringCellValue())) exclude++;
                String flags = row.getCell(ResponseQualitySheetWriter.COL_FLAGS - 1).getStringCellValue();
                for (int f = 0; f < names.length; f++) {
                    if (flags.contains(names[f])) perFlag[f]++;
                }
            }
            assertTrue(students > 0, "no scored rows");
            System.out.println("STUDENTS=" + students + " EXCLUDE=" + exclude
                    + " (" + Math.round(100.0 * exclude / students) + "%)");
            for (int f = 0; f < names.length; f++) {
                System.out.println("  " + names[f] + "=" + perFlag[f]
                        + " (" + Math.round(100.0 * perFlag[f] / students) + "%)");
            }
            // Row alignment: the data sheet has one row per student, the quality
            // sheet the same students from row 3.
            assertEquals(data.getLastRowNum(), rq.getLastRowNum() - 1);
        }
    }

    @Test
    void betAssessmentGetsNoQualitySheet() throws Exception {
        long assessmentId = Long.getLong("dataexcel.betAssessmentId", 5L);
        byte[] bytes = service.exportStudentData(assessmentId, null);
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            assertEquals(null, wb.getSheet(ResponseQualitySheetWriter.SHEET_NAME),
                    "non-Navigator assessment must not get the quality sheet");
        }
    }
}
