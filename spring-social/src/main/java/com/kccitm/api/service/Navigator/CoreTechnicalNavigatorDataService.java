package com.kccitm.api.service.Navigator;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Core Technical Navigator Data Service
 *
 * Computes Phase 0 intermediary scores (raw MI, aptitude, RIASEC, SOI, values,
 * career aspirations) for selected students and exports them as Excel.
 */
@Service
public class CoreTechnicalNavigatorDataService {

    private static final Logger logger = LoggerFactory.getLogger(CoreTechnicalNavigatorDataService.class);

    @Autowired
    private NavigatorReportGenerationService reportGenerationService;

    // Column order matches the user's reference Excel exactly
    private static final String[] EXCEL_HEADERS = {
        "Student Name", "Class",
        // 8 MI scores
        "Bodily-Kinesthetic", "Interpersonal", "Intrapersonal", "Linguistic",
        "Logical-Mathematical", "Musical", "Spatial-Visual", "Naturalistic",
        // 10 Aptitude scores
        "Speed and accuracy", "Computational", "Creativity/Artistic",
        "Language/Communication", "Technical", "Decision making & problem solving",
        "Finger dexterity", "Form perception", "Logical reasoning", "Motor movement",
        // 6 RIASEC
        "R", "I", "A", "S", "E", "C",
        // SOI 1-5
        "SOI 1", "SOI 2", "SOI 3", "SOI 4", "SOI 5",
        // Values 1-5
        "Value 1", "Value 2", "Value 3", "Value 4", "Value 5",
        // Career Aspirations 1-4
        "Career Aspiration 1", "Career Aspiration 2", "Career Aspiration 3", "Career Aspiration 4"
    };

    // MI key order (must match EXCEL_HEADERS)
    private static final String[] MI_KEYS = {
        "Bodily-Kinesthetic", "Interpersonal", "Intrapersonal", "Linguistic",
        "Logical-Mathematical", "Musical", "Visual-Spatial", "Naturalistic"
    };

    // Aptitude key order (must match EXCEL_HEADERS)
    private static final String[] APTITUDE_KEYS = {
        "Speed and accuracy", "Computational", "Creativity/Artistic",
        "Language/Communication", "Technical", "Decision making & problem solving",
        "Finger dexterity", "Form perception", "Logical reasoning", "Motor movement"
    };

    private static final String[] RIASEC_KEYS = {"R", "I", "A", "S", "E", "C"};

    // ═══════════════════════ PUBLIC API ═══════════════════════

    public static class PipelineResult {
        public final byte[] excelBytes;
        public final int generated;
        public final List<PipelineError> errors;

        public PipelineResult(byte[] excelBytes, int generated, List<PipelineError> errors) {
            this.excelBytes = excelBytes;
            this.generated = generated;
            this.errors = errors;
        }
    }

    public static class PipelineError {
        public final Long userStudentId;
        public final String reason;

        public PipelineError(Long userStudentId, String reason) {
            this.userStudentId = userStudentId;
            this.reason = reason;
        }
    }

    /**
     * Compute Phase 0 intermediary scores for each student and return as Excel.
     */
    public PipelineResult generateAndExport(Long assessmentId, List<Long> userStudentIds) {
        logger.info("CoreTechnicalNavigatorDataService: computing intermediary scores for assessment={}, students={}",
                assessmentId, userStudentIds.size());

        List<NavigatorReportGenerationService.IntermediaryScores> results = new ArrayList<>();
        List<PipelineError> errors = new ArrayList<>();

        for (Long studentId : userStudentIds) {
            try {
                NavigatorReportGenerationService.IntermediaryScores scores =
                        reportGenerationService.computeIntermediaryScores(studentId, assessmentId);
                if (scores != null) {
                    results.add(scores);
                } else {
                    errors.add(new PipelineError(studentId, "No completed assessment found"));
                }
            } catch (Exception e) {
                logger.error("Scoring failed for student {}: {}", studentId, e.getMessage());
                errors.add(new PipelineError(studentId, e.getMessage()));
            }
        }

        logger.info("Scoring complete: {} generated, {} errors", results.size(), errors.size());

        byte[] excelBytes = buildExcel(results);
        return new PipelineResult(excelBytes, results.size(), errors);
    }

    // ═══════════════════════ EXCEL BUILDER ═══════════════════════

    private byte[] buildExcel(List<NavigatorReportGenerationService.IntermediaryScores> rows) {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Navigator Data");

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < EXCEL_HEADERS.length; i++) {
                headerRow.createCell(i).setCellValue(EXCEL_HEADERS[i]);
                headerRow.getCell(i).setCellStyle(headerStyle);
            }

            int rowIdx = 1;
            for (NavigatorReportGenerationService.IntermediaryScores s : rows) {
                Row row = sheet.createRow(rowIdx++);
                int col = 0;

                // Basic info
                row.createCell(col++).setCellValue(safe(s.studentName));
                row.createCell(col++).setCellValue(safe(s.studentClass));

                // 8 MI scores
                for (String key : MI_KEYS) {
                    row.createCell(col++).setCellValue(intVal(s.miScores, key));
                }

                // 10 Aptitude scores
                for (String key : APTITUDE_KEYS) {
                    row.createCell(col++).setCellValue(intVal(s.aptitudeScores, key));
                }

                // 6 RIASEC scores
                for (String key : RIASEC_KEYS) {
                    row.createCell(col++).setCellValue(intVal(s.riasecScores, key));
                }

                // SOI 1-5
                for (int i = 0; i < 5; i++) {
                    row.createCell(col++).setCellValue(
                            i < s.selectedSOIs.size() ? s.selectedSOIs.get(i) : "");
                }

                // Values 1-5
                for (int i = 0; i < 5; i++) {
                    row.createCell(col++).setCellValue(
                            i < s.selectedValues.size() ? s.selectedValues.get(i) : "");
                }

                // Career Aspirations 1-4
                for (int i = 0; i < 4; i++) {
                    row.createCell(col++).setCellValue(
                            i < s.selectedCareerAsps.size() ? s.selectedCareerAsps.get(i) : "");
                }
            }

            for (int i = 0; i < EXCEL_HEADERS.length; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            logger.error("Failed to build Excel: {}", e.getMessage());
            throw new RuntimeException("Excel generation failed", e);
        }
    }

    private String safe(String val) {
        return val != null ? val : "";
    }

    private int intVal(Map<String, Integer> map, String key) {
        Integer v = map != null ? map.get(key) : null;
        return v != null ? v : 0;
    }
}
