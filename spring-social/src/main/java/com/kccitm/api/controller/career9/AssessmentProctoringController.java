package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.servlet.http.HttpServletResponse;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.AssessmentProctoringQuestionLog;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.AssessmentProctoringQuestionLogRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.service.AssessmentSessionService;
import com.kccitm.api.service.ProctoringProcessorService;

@RestController
@RequestMapping("/assessment-proctoring")
public class AssessmentProctoringController {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentProctoringController.class);
    private static final int EXCEL_CELL_LIMIT = 32767;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private AssessmentProctoringQuestionLogRepository questionLogRepository;

    @Autowired
    private QuestionnaireQuestionRepository questionnaireQuestionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AssessmentSessionService assessmentSessionService;

    @Autowired
    private ProctoringProcessorService proctoringProcessorService;

    @SuppressWarnings("unchecked")
    @PostMapping(value = "/save", headers = "Accept=application/json")
    public ResponseEntity<?> saveProctoringData(@RequestBody Map<String, Object> payload) {
        try {
            Long userStudentId = ((Number) payload.get("userStudentId")).longValue();
            Long assessmentId = ((Number) payload.get("assessmentId")).longValue();

            List<Map<String, Object>> perQuestionData =
                    (List<Map<String, Object>>) payload.get("perQuestionData");

            if (perQuestionData == null || perQuestionData.isEmpty()) {
                return ResponseEntity.badRequest().body("No per-question data provided");
            }

            // Save to Redis and process async
            assessmentSessionService.saveProctoringData(userStudentId, assessmentId, payload);
            proctoringProcessorService.processAsync(userStudentId, assessmentId);

            return ResponseEntity.ok(Map.of("status", "accepted"));

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error saving proctoring data: " + e.getMessage());
        }
    }

    @GetMapping(value = "/getByStudent/{studentId}", headers = "Accept=application/json")
    public ResponseEntity<?> getByStudent(@PathVariable Long studentId) {
        List<AssessmentProctoringQuestionLog> logs = questionLogRepository
                .findByUserStudentUserStudentId(studentId);
        return ResponseEntity.ok(logs);
    }

    @GetMapping(value = "/getByAssessment/{assessmentId}", headers = "Accept=application/json")
    public ResponseEntity<?> getByAssessment(@PathVariable Long assessmentId) {
        List<AssessmentProctoringQuestionLog> logs = questionLogRepository
                .findByAssessmentId(assessmentId);
        return ResponseEntity.ok(logs);
    }

    @GetMapping(value = "/get/{studentId}/{assessmentId}", headers = "Accept=application/json")
    public ResponseEntity<?> getByStudentAndAssessment(
            @PathVariable Long studentId, @PathVariable Long assessmentId) {
        List<AssessmentProctoringQuestionLog> logs = questionLogRepository
                .findByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId);
        return ResponseEntity.ok(logs);
    }

    @PostMapping(value = "/getBulkProctoringData", headers = "Accept=application/json")
    public ResponseEntity<?> getBulkProctoringData(
            @RequestBody List<Map<String, Long>> pairs) {
        try {
            List<Map<String, Object>> result = new ArrayList<>();

            for (Map<String, Long> pair : pairs) {
                Long userStudentId = pair.get("userStudentId");
                Long assessmentId = pair.get("assessmentId");
                if (userStudentId == null || assessmentId == null) continue;

                List<AssessmentProctoringQuestionLog> logs = questionLogRepository
                        .findByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId);

                for (AssessmentProctoringQuestionLog log : logs) {
                    Map<String, Object> row = new HashMap<>();
                    row.put("proctoringLogId", log.getProctoringLogId());
                    row.put("userStudentId", userStudentId);
                    row.put("studentName", log.getUserStudent() != null && log.getUserStudent().getStudentInfo() != null
                            ? log.getUserStudent().getStudentInfo().getName() : "");
                    row.put("assessmentId", assessmentId);
                    row.put("assessmentName", log.getAssessment() != null ? log.getAssessment().getAssessmentName() : "");
                    row.put("questionnaireQuestionId", log.getQuestionnaireQuestion() != null
                            ? log.getQuestionnaireQuestion().getQuestionnaireQuestionId() : null);
                    row.put("questionText", log.getQuestionnaireQuestion() != null && log.getQuestionnaireQuestion().getQuestion() != null
                            ? log.getQuestionnaireQuestion().getQuestion().getQuestionText() : "");
                    row.put("screenWidth", log.getScreenWidth());
                    row.put("screenHeight", log.getScreenHeight());
                    // Include raw JSON fields for proctoring (gaze, rects, mouse clicks, eye gaze)
                    row.put("questionRectJson", log.getQuestionRectJson());
                    row.put("optionsRectJson", log.getOptionsRectJson());
                    row.put("gazePointsJson", log.getGazePointsJson());
                    row.put("mouseClicksJson", log.getMouseClicksJson());
                    row.put("eyeGazePointsJson", log.getEyeGazePointsJson());
                    row.put("timeSpentMs", log.getTimeSpentMs());
                    row.put("questionStartTime", log.getQuestionStartTime());
                    row.put("questionEndTime", log.getQuestionEndTime());
                    row.put("mouseClickCount", log.getMouseClickCount());
                    row.put("maxFacesDetected", log.getMaxFacesDetected());
                    row.put("avgFacesDetected", log.getAvgFacesDetected());
                    row.put("headAwayCount", log.getHeadAwayCount());
                    row.put("tabSwitchCount", log.getTabSwitchCount());
                    row.put("createdAt", log.getCreatedAt() != null ? log.getCreatedAt().toString() : "");
                    result.add(row);
                }
            }

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error fetching bulk proctoring data: " + e.getMessage());
        }
    }

    /**
     * Export proctoring data as Excel (.xlsx) file.
     * Generated server-side using Apache POI SXSSFWorkbook (streaming, low memory).
     * JSON fields are preprocessed into aggregated summary stats (counts, averages)
     * instead of raw JSON — no cell ever exceeds Excel's 32767 char limit.
     */
    @PostMapping(value = "/export-excel")
    public void exportExcel(@RequestBody List<Map<String, Long>> pairs,
                            HttpServletResponse response) {
        SXSSFWorkbook workbook = new SXSSFWorkbook(100);
        try {
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader("Content-Disposition", "attachment; filename=Proctoring_Data.xlsx");

            Sheet sheet = workbook.createSheet("Proctoring Data");

            // ── Header style ──
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            // ── Column headers — JSON fields replaced with aggregated stats ──
            String[] headers = {
                "S.No", "Proctoring Log ID", "Student Name", "User ID",
                "Assessment", "Question ID", "Question",
                "Time Spent (ms)", "Question Start Time", "Question End Time",
                "Mouse Click Count", "Max Faces", "Avg Faces",
                "Head Away Count", "Tab Switches", "Screen Width", "Screen Height",
                "Created At",
                // Question Rect aggregated
                "Q Rect X", "Q Rect Y", "Q Rect Width", "Q Rect Height",
                // Options Rect aggregated
                "Option Count",
                // Gaze Points aggregated
                "Gaze Point Count", "Avg Gaze X", "Avg Gaze Y",
                // Mouse Clicks aggregated
                "Avg Click X", "Avg Click Y",
                // Eye Gaze Points aggregated
                "Eye Gaze Point Count", "Avg Eye Gaze X", "Avg Eye Gaze Y"
            };

            // ── Write headers ──
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // ── Extract unique IDs and build valid pairs set ──
            Set<Long> studentIdSet = new HashSet<>();
            Set<Long> assessmentIdSet = new HashSet<>();
            Set<String> validPairs = new HashSet<>();
            for (Map<String, Long> pair : pairs) {
                Long uid = pair.get("userStudentId");
                Long aid = pair.get("assessmentId");
                if (uid == null || aid == null) continue;
                studentIdSet.add(uid);
                assessmentIdSet.add(aid);
                validPairs.add(uid + "_" + aid);
            }

            // ── Single batch query ──
            List<AssessmentProctoringQuestionLog> allLogs = studentIdSet.isEmpty()
                    ? new ArrayList<>()
                    : questionLogRepository.findByStudentIdsAndAssessmentIds(
                            new ArrayList<>(studentIdSet), new ArrayList<>(assessmentIdSet));

            int sno = 1;
            int rowNum = 1;
            for (AssessmentProctoringQuestionLog log : allLogs) {
                Long uid = log.getUserStudent() != null ? log.getUserStudent().getUserStudentId() : null;
                Long aid = log.getAssessment() != null ? log.getAssessment().getId() : null;
                if (uid == null || aid == null || !validPairs.contains(uid + "_" + aid)) continue;

                String studentName = log.getUserStudent().getStudentInfo() != null
                        ? log.getUserStudent().getStudentInfo().getName() : "";
                String assessmentName = log.getAssessment().getAssessmentName() != null
                        ? log.getAssessment().getAssessmentName() : "";
                Long qqId = log.getQuestionnaireQuestion() != null
                        ? log.getQuestionnaireQuestion().getQuestionnaireQuestionId() : null;
                String questionText = log.getQuestionnaireQuestion() != null
                        && log.getQuestionnaireQuestion().getQuestion() != null
                        ? log.getQuestionnaireQuestion().getQuestion().getQuestionText() : "";

                // ── Preprocess JSON fields into summary stats ──
                double[] qRect = parseRect(log.getQuestionRectJson());       // [x, y, width, height]
                int optionCount = countJsonArrayElements(log.getOptionsRectJson());
                double[] gazeSummary = summarizePoints(log.getGazePointsJson());   // [count, avgX, avgY]
                double[] clickSummary = summarizePoints(log.getMouseClicksJson()); // [count, avgX, avgY]
                double[] eyeGazeSummary = summarizePoints(log.getEyeGazePointsJson()); // [count, avgX, avgY]

                Row row = sheet.createRow(rowNum++);
                int col = 0;

                // Fixed columns
                row.createCell(col++).setCellValue(sno++);
                setCellValue(row.createCell(col++), log.getProctoringLogId());
                row.createCell(col++).setCellValue(studentName);
                setCellValue(row.createCell(col++), uid);
                row.createCell(col++).setCellValue(assessmentName);
                setCellValue(row.createCell(col++), qqId);
                row.createCell(col++).setCellValue(questionText);
                setCellValue(row.createCell(col++), log.getTimeSpentMs());
                setCellValue(row.createCell(col++), log.getQuestionStartTime());
                setCellValue(row.createCell(col++), log.getQuestionEndTime());
                setCellValue(row.createCell(col++), log.getMouseClickCount());
                setCellValue(row.createCell(col++), log.getMaxFacesDetected());
                setCellValue(row.createCell(col++), log.getAvgFacesDetected());
                setCellValue(row.createCell(col++), log.getHeadAwayCount());
                setCellValue(row.createCell(col++), log.getTabSwitchCount());
                setCellValue(row.createCell(col++), log.getScreenWidth());
                setCellValue(row.createCell(col++), log.getScreenHeight());
                row.createCell(col++).setCellValue(
                        log.getCreatedAt() != null ? log.getCreatedAt().toString() : "");

                // Question Rect stats
                row.createCell(col++).setCellValue(qRect[0]); // x
                row.createCell(col++).setCellValue(qRect[1]); // y
                row.createCell(col++).setCellValue(qRect[2]); // width
                row.createCell(col++).setCellValue(qRect[3]); // height

                // Option count
                row.createCell(col++).setCellValue(optionCount);

                // Gaze Points stats
                row.createCell(col++).setCellValue((int) gazeSummary[0]); // count
                row.createCell(col++).setCellValue(Math.round(gazeSummary[1] * 100.0) / 100.0); // avgX
                row.createCell(col++).setCellValue(Math.round(gazeSummary[2] * 100.0) / 100.0); // avgY

                // Mouse Clicks stats
                row.createCell(col++).setCellValue(Math.round(clickSummary[1] * 100.0) / 100.0); // avgX
                row.createCell(col++).setCellValue(Math.round(clickSummary[2] * 100.0) / 100.0); // avgY

                // Eye Gaze Points stats
                row.createCell(col++).setCellValue((int) eyeGazeSummary[0]); // count
                row.createCell(col++).setCellValue(Math.round(eyeGazeSummary[1] * 100.0) / 100.0); // avgX
                row.createCell(col++).setCellValue(Math.round(eyeGazeSummary[2] * 100.0) / 100.0); // avgY
            }

            // ── Write to response ──
            workbook.write(response.getOutputStream());
            response.getOutputStream().flush();

            logger.info("Proctoring Excel exported: {} rows", rowNum - 1);

        } catch (Exception e) {
            logger.error("Error exporting proctoring Excel: {}", e.getMessage(), e);
            try {
                response.setStatus(500);
                response.setContentType("application/json");
                response.getWriter().write("{\"error\": \"Failed to export Excel: " +
                        e.getMessage().replace("\"", "'") + "\"}");
            } catch (Exception ignored) {}
        } finally {
            workbook.dispose();
        }
    }

    // ─── JSON preprocessing helpers ─────────────────────────────────────

    /**
     * Parse a rect JSON like {"x":10,"y":20,"width":300,"height":50} into [x, y, width, height].
     * Returns [0,0,0,0] on any error.
     */
    private double[] parseRect(String json) {
        double[] result = {0, 0, 0, 0};
        if (json == null || json.isEmpty()) return result;
        try {
            com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(json);
            result[0] = node.path("x").asDouble(node.path("left").asDouble(0));
            result[1] = node.path("y").asDouble(node.path("top").asDouble(0));
            result[2] = node.path("width").asDouble(0);
            result[3] = node.path("height").asDouble(0);
        } catch (Exception ignored) {}
        return result;
    }

    /**
     * Count elements in a JSON array string. Returns 0 on error.
     */
    private int countJsonArrayElements(String json) {
        if (json == null || json.isEmpty()) return 0;
        try {
            com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(json);
            return node.isArray() ? node.size() : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    /**
     * Summarize an array of point objects [{x:..., y:...}, ...] into [count, avgX, avgY].
     * Supports keys: x/y, screenX/screenY, clientX/clientY.
     * Returns [0, 0, 0] on error or empty.
     */
    private double[] summarizePoints(String json) {
        double[] result = {0, 0, 0};
        if (json == null || json.isEmpty()) return result;
        try {
            com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(json);
            if (!node.isArray() || node.size() == 0) return result;

            double sumX = 0, sumY = 0;
            int count = node.size();
            for (com.fasterxml.jackson.databind.JsonNode pt : node) {
                double x = pt.path("x").asDouble(
                        pt.path("screenX").asDouble(pt.path("clientX").asDouble(0)));
                double y = pt.path("y").asDouble(
                        pt.path("screenY").asDouble(pt.path("clientY").asDouble(0)));
                sumX += x;
                sumY += y;
            }
            result[0] = count;
            result[1] = count > 0 ? sumX / count : 0;
            result[2] = count > 0 ? sumY / count : 0;
        } catch (Exception ignored) {}
        return result;
    }

    private void setCellValue(Cell cell, Object value) {
        if (value == null) {
            cell.setCellValue("");
        } else if (value instanceof Number) {
            cell.setCellValue(((Number) value).doubleValue());
        } else {
            String str = value.toString();
            if (str.length() > EXCEL_CELL_LIMIT) {
                str = str.substring(0, EXCEL_CELL_LIMIT);
            }
            cell.setCellValue(str);
        }
    }

    private String safe(String s) {
        return s != null ? s : "";
    }
}
