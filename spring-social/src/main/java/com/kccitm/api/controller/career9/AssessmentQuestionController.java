package com.kccitm.api.controller.career9;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentQuestions;
import com.kccitm.api.model.career9.GameTable;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.QuestionSection;
import com.kccitm.api.repository.Career9.AssessmentQuestionRepository;
import com.kccitm.api.repository.Career9.MeasuredQualityTypesRepository;
import com.kccitm.api.repository.Career9.QuestionSectionRepository;

@RestController
@RequestMapping("/assessment-questions")
public class AssessmentQuestionController {

    private final Logger logger = LoggerFactory.getLogger(AssessmentQuestionController.class);

    private static final Path CACHE_DIR = Paths.get("cache");
    private static final Path CACHE_FILE = CACHE_DIR.resolve("assessment_questions.json");

    @Autowired
    private AssessmentQuestionRepository assessmentQuestionRepository;

    @Autowired
    private QuestionSectionRepository questionSectionRepository;

    @Autowired
    private MeasuredQualityTypesRepository measuredQualityTypesRepository;

    private Optional<List<AssessmentQuestions>> readCache() {
        try {
            if (Files.exists(CACHE_FILE) && Files.size(CACHE_FILE) > 0) {
                ObjectMapper mapper = new ObjectMapper();
                List<AssessmentQuestions> cached = mapper.readValue(CACHE_FILE.toFile(),
                        new TypeReference<List<AssessmentQuestions>>() {
                        });
                return Optional.ofNullable(cached);
            }
        } catch (IOException e) {
            logger.error("Error reading assessment questions cache file", e);
        }
        return Optional.empty();
    }

    private void writeCache(List<AssessmentQuestions> data) {
        System.out.println(CACHE_DIR);
        System.out.println(CACHE_FILE);
        try {
            if (!Files.exists(CACHE_DIR)) {
                Files.createDirectories(CACHE_DIR);
            }
            ObjectMapper mapper = new ObjectMapper();
            mapper.writerWithDefaultPrettyPrinter().writeValue(CACHE_FILE.toFile(), data);
        } catch (IOException e) {
            logger.error("Error writing assessment questions cache file", e);
        }
    }

    private List<AssessmentQuestions> fetchAndTransformFromDb() {
        List<AssessmentQuestions> assementQuestionsObject = assessmentQuestionRepository.findByIsDeletedFalseOrIsDeletedIsNull();
        // assementQuestionsObject.iterator().forEachRemaining(assmentQuestion -> {
        //     assmentQuestion.getOptions().iterator().forEachRemaining(option -> {
        //         option.getOptionScores().iterator().forEachRemaining(score -> {
        //             score.setMeasuredQualityType(
        //                     new MeasuredQualityTypes(score.getMeasuredQualityType().getMeasuredQualityTypeId()));
        //             score.setQuestion_option(new AssessmentQuestionOptions(score.getQuestion_option().getOptionId()));
        //         });
        //     });
        // });
        return assementQuestionsObject;
    }

    // When called: return cached JSON if present, otherwise fetch from DB, cache it
    // and return.
    @GetMapping("/getAll")
    public List<AssessmentQuestions> getAllAssessmentQuestions() {
       
        List<AssessmentQuestions> fromDb = fetchAndTransformFromDb();

        return fromDb;
    }

    @GetMapping("/get/{id}")
    public AssessmentQuestions getAssessmentQuestionById(@PathVariable Long id) {
        return assessmentQuestionRepository.findById(id).orElse(null);
    }
    @GetMapping("/getAllList")
    public List<AssessmentQuestions> findAllQuestionsProjection() {
       
        List<AssessmentQuestions> fromDb = assessmentQuestionRepository.findAllQuestionsProjection();

        return fromDb;
    }

    

    @PostMapping(value = "/create", consumes = "application/json")
    public AssessmentQuestions createAssessmentQuestion(@RequestBody AssessmentQuestions assessmentQuestions)
            throws Exception {
        // Wire up relationships before saving

        // Validate and set section relationship
        if (assessmentQuestions.getSection() != null && assessmentQuestions.getSection().getSectionId() != null) {
            QuestionSection section = questionSectionRepository
                    .findById(assessmentQuestions.getSection().getSectionId()).orElse(null);
            if (section != null) {
                assessmentQuestions.setSection(section);
            }
        }

        // Wire up options and their scores
        if (assessmentQuestions.getOptions() != null && !assessmentQuestions.getOptions().isEmpty()) {
            for (AssessmentQuestionOptions option : assessmentQuestions.getOptions()) {
                // Wire the back-reference from option to question
                option.setQuestion(assessmentQuestions);

                // Wire up measured quality type scores for each option
                if (option.getOptionScores() != null) {
                    for (OptionScoreBasedOnMEasuredQualityTypes score : option.getOptionScores()) {
                        // Set the back-reference from score to option
                        score.setQuestion_option(option);

                        // Use ID-only reference for MeasuredQualityType
                        if (score.getMeasuredQualityType() != null
                                && score.getMeasuredQualityType().getMeasuredQualityTypeId() != null) {
                            score.setMeasuredQualityType(new MeasuredQualityTypes(
                                    score.getMeasuredQualityType().getMeasuredQualityTypeId()));
                        }
                    }
                }
            }
        }

        AssessmentQuestions assementQustionObject = assessmentQuestionRepository.save(assessmentQuestions);

        // Refresh cache after create
        try {
            List<AssessmentQuestions> refreshed = fetchAndTransformFromDb();
            writeCache(refreshed);
        } catch (Exception e) {
            logger.warn("Failed to refresh assessment questions cache after create", e);
        }

        return assementQustionObject.getId() != null ? assementQustionObject : null;
    }

    /**
     * Update an existing assessment question
     *
     * This endpoint updates an existing question and all its related data.
     * It handles the complete replacement of options and their scores.
     *
     * Key behaviors:
     * - Finds existing question by ID (throws exception if not found)
     * - Updates question fields (text, type, section, maxOptionsAllowed)
     * - Clears all existing options (CASCADE deletes their scores automatically)
     * - Adds new/updated options from the request
     * - Wires up all relationships (question->option->score->measuredQualityType)
     * - Refreshes cache after successful update
     *
     * @param id The ID of the question to update
     * @param assessmentQuestions The updated question data
     * @return The saved question with all relationships
     */
    @PutMapping("/update/{id}")
    public AssessmentQuestions updateAssessmentQuestion(@PathVariable Long id,
            @RequestBody AssessmentQuestions assessmentQuestions) {

        // Step 1: Find existing question (throws exception if not found)
        AssessmentQuestions existingQuestion = assessmentQuestionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Question not found with ID: " + id));

        // Step 2: Update basic question fields
        existingQuestion.setQuestionText(assessmentQuestions.getQuestionText());
        existingQuestion.setQuestionType(assessmentQuestions.getQuestionType());
        existingQuestion.setMaxOptionsAllowed(assessmentQuestions.getMaxOptionsAllowed());

        // Step 3: Update section relationship (validate section exists first)
        if (assessmentQuestions.getSection() != null && assessmentQuestions.getSection().getSectionId() != null) {
            QuestionSection section = questionSectionRepository
                    .findById(assessmentQuestions.getSection().getSectionId()).orElse(null);
            if (section != null) {
                existingQuestion.setSection(section);
            }
        }

        // Step 4: Replace options - clear existing and add new ones
        // IMPORTANT: With orphanRemoval=true, we must modify the existing collection
        // in place (clear + addAll), never replace the reference with setOptions()
        if (existingQuestion.getOptions() != null) {
            existingQuestion.getOptions().clear();
        }

        if (assessmentQuestions.getOptions() != null && !assessmentQuestions.getOptions().isEmpty()) {
            // Wire up new options and their scores
            for (AssessmentQuestionOptions option : assessmentQuestions.getOptions()) {
                option.setQuestion(existingQuestion);

                if (option.getOptionScores() != null) {
                    for (OptionScoreBasedOnMEasuredQualityTypes score : option.getOptionScores()) {
                        score.setQuestion_option(option);

                        if (score.getMeasuredQualityType() != null
                                && score.getMeasuredQualityType().getMeasuredQualityTypeId() != null) {
                            score.setMeasuredQualityType(new MeasuredQualityTypes(
                                    score.getMeasuredQualityType().getMeasuredQualityTypeId()));
                        }
                    }
                }
            }

            // Add all new options to the existing (now empty) collection
            existingQuestion.getOptions().addAll(assessmentQuestions.getOptions());
        }

        // Step 5: Save the updated question (cascade saves options and scores)
        AssessmentQuestions saved = assessmentQuestionRepository.save(existingQuestion);

        // Step 6: Refresh cache after update to keep it in sync
        try {
            List<AssessmentQuestions> refreshed = fetchAndTransformFromDb();
            writeCache(refreshed);
        } catch (Exception e) {
            logger.warn("Failed to refresh assessment questions cache after update", e);
        }

        return saved;
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<String> deleteAssessmentQuestion(@PathVariable Long id) {
        // Soft delete: set isDeleted flag instead of removing from database
        AssessmentQuestions question = assessmentQuestionRepository.findById(id)
                .orElse(null);
        if (question == null) {
            return ResponseEntity.notFound().build();
        }
        question.setIsDeleted(true);
        assessmentQuestionRepository.save(question);

        // refresh cache after soft delete
        try {
            List<AssessmentQuestions> refreshed = fetchAndTransformFromDb();
            writeCache(refreshed);
        } catch (Exception e) {
            logger.warn("Failed to refresh assessment questions cache after delete", e);
        }

        return ResponseEntity.ok("AssessmentQuestion soft-deleted successfully.");
    }

    @GetMapping("/deleted")
    public List<AssessmentQuestions> getDeletedQuestions() {
        return assessmentQuestionRepository.findByIsDeletedTrue();
    }

    @PutMapping("/restore/{id}")
    public ResponseEntity<String> restoreAssessmentQuestion(@PathVariable Long id) {
        AssessmentQuestions question = assessmentQuestionRepository.findById(id)
                .orElse(null);
        if (question == null) {
            return ResponseEntity.notFound().build();
        }
        question.setIsDeleted(false);
        assessmentQuestionRepository.save(question);

        // refresh cache after restore
        try {
            List<AssessmentQuestions> refreshed = fetchAndTransformFromDb();
            writeCache(refreshed);
        } catch (Exception e) {
            logger.warn("Failed to refresh assessment questions cache after restore", e);
        }

        return ResponseEntity.ok("AssessmentQuestion restored successfully.");
    }

    @DeleteMapping("/permanent-delete/{id}")
    public ResponseEntity<String> permanentlyDeleteAssessmentQuestion(@PathVariable Long id) {
        assessmentQuestionRepository.deleteById(id);

        return ResponseEntity.ok("AssessmentQuestion permanently deleted.");
    }

    // Many-to-Many relationship management endpoints for MeasuredQualityTypes

    /**
     * Export all assessment questions to Excel format
     *
     * This endpoint generates an Excel file containing all assessment questions with their:
     * - Question details (ID, text, type, max options allowed)
     * - Section information
     * - All options for each question
     * - Measured quality type scores for each option
     *
     * The Excel format is designed to support both export and import operations,
     * allowing users to add new questions in the same format and re-import them.
     *
     * @return ResponseEntity containing the Excel file as byte array
     * @throws Exception if Excel generation fails
     */
    @GetMapping("/export-excel")
    public ResponseEntity<byte[]> exportQuestionsToExcel() throws Exception {
        logger.info("Starting Excel export for assessment questions");

        // Fetch all questions with their complete data (options, sections, scores)
        List<AssessmentQuestions> questions = fetchAndTransformFromDb();

        // Create a new Excel workbook and sheet
        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("Assessment Questions");

        // Create header cell style with bold font and colored background
        CellStyle headerStyle = workbook.createCellStyle();
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerFont.setColor(IndexedColors.WHITE.getIndex());
        headerStyle.setFont(headerFont);
        headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        headerStyle.setBorderBottom(BorderStyle.THIN);
        headerStyle.setBorderTop(BorderStyle.THIN);
        headerStyle.setBorderRight(BorderStyle.THIN);
        headerStyle.setBorderLeft(BorderStyle.THIN);

        // Determine max number of options across all questions (minimum 6 to match template)
        int maxOptions = 6;
        for (AssessmentQuestions q : questions) {
            if (q.getOptions() != null && q.getOptions().size() > maxOptions) {
                maxOptions = q.getOptions().size();
            }
        }

        // Create header row with all column titles
        Row headerRow = sheet.createRow(0);
        int colNum = 0;

        // Define base columns (matching upload template format)
        String[] baseHeaders = {
            "Question Text",
            "Question Type",
            "Section ID",
            "Max Options Allowed"
        };

        // Add base headers to the sheet
        for (String header : baseHeaders) {
            Cell cell = headerRow.createCell(colNum++);
            cell.setCellValue(header);
            cell.setCellStyle(headerStyle);
        }

        // Add option headers: Option N Text, Option N Description, Option N MQTs
        for (int i = 1; i <= maxOptions; i++) {
            Cell textCell = headerRow.createCell(colNum++);
            textCell.setCellValue("Option " + i + " Text");
            textCell.setCellStyle(headerStyle);

            Cell descCell = headerRow.createCell(colNum++);
            descCell.setCellValue("Option " + i + " Description");
            descCell.setCellStyle(headerStyle);

            Cell mqtCell = headerRow.createCell(colNum++);
            mqtCell.setCellValue("Option " + i + " MQTs");
            mqtCell.setCellStyle(headerStyle);
        }

        // Populate data rows - one row per question (horizontal format)
        int rowNum = 1;

        for (AssessmentQuestions question : questions) {
            Row row = sheet.createRow(rowNum++);
            colNum = 0;

            // Question details
            row.createCell(colNum++).setCellValue(question.getQuestionText() != null ? question.getQuestionText() : "");
            row.createCell(colNum++).setCellValue(question.getQuestionType() != null ? question.getQuestionType() : "");

            QuestionSection section = question.getSection();
            row.createCell(colNum++).setCellValue(section != null ? section.getSectionId().toString() : "");
            row.createCell(colNum++).setCellValue(question.getMaxOptionsAllowed());

            // Options spread horizontally
            List<AssessmentQuestionOptions> options = question.getOptions();
            for (int i = 0; i < maxOptions; i++) {
                if (options != null && i < options.size()) {
                    AssessmentQuestionOptions opt = options.get(i);

                    // Option Text
                    row.createCell(colNum++).setCellValue(opt.getOptionText() != null ? opt.getOptionText() : "");

                    // Option Description
                    row.createCell(colNum++).setCellValue(opt.getOptionDescription() != null ? opt.getOptionDescription() : "");

                    // MQT scores as "MQTName:Score,MQTName:Score"
                    StringBuilder mqtStr = new StringBuilder();
                    List<OptionScoreBasedOnMEasuredQualityTypes> scores = opt.getOptionScores();
                    if (scores != null && !scores.isEmpty()) {
                        for (int j = 0; j < scores.size(); j++) {
                            OptionScoreBasedOnMEasuredQualityTypes score = scores.get(j);
                            if (score.getMeasuredQualityType() != null) {
                                if (mqtStr.length() > 0) mqtStr.append(",");
                                mqtStr.append(score.getMeasuredQualityType().getMeasuredQualityTypeName())
                                      .append(":")
                                      .append(score.getScore() != null ? score.getScore() : 0);
                            }
                        }
                    }
                    row.createCell(colNum++).setCellValue(mqtStr.toString());
                } else {
                    // Empty option columns
                    row.createCell(colNum++).setCellValue("");
                    row.createCell(colNum++).setCellValue("");
                    row.createCell(colNum++).setCellValue("");
                }
            }
        }

        // Auto-size all columns for better readability
        for (int i = 0; i < headerRow.getLastCellNum(); i++) {
            sheet.autoSizeColumn(i);
        }

        // Write the workbook to a byte array output stream
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        workbook.write(outputStream);
        workbook.close();

        // Convert output stream to byte array
        byte[] excelBytes = outputStream.toByteArray();

        // Set HTTP headers for file download
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.setContentDispositionFormData("attachment", "assessment_questions_" + System.currentTimeMillis() + ".xlsx");

        logger.info("Excel export completed successfully with {} questions", questions.size());

        // Return the Excel file as a downloadable response
        return ResponseEntity.ok()
                .headers(headers)
                .body(excelBytes);
    }

    /**
     * Import assessment questions from Excel file
     *
     * This endpoint handles bulk import of assessment questions from an Excel file.
     * It intelligently handles both creating new questions and updating existing ones
     * based on the presence of Question IDs in the Excel file.
     *
     * Import logic:
     * - If Question ID is present in Excel → Update existing question
     * - If Question ID is null/empty → Create new question
     * - Options are completely replaced (old options are deleted via cascade)
     * - Each question is processed independently (failures don't stop other imports)
     *
     * Excel format must match the export format with columns:
     * Question ID, Question Text, Type, Section ID, Max Options, Option ID,
     * Option Text, Description, Is Correct, Is Game, Game ID, MQT columns...
     *
     * @param file Excel file (.xlsx format) containing questions to import
     * @return Import result with success/failure counts and error messages
     * @throws Exception if file reading or parsing fails
     */
    @PostMapping("/import-excel")
    public ResponseEntity<Map<String, Object>> importQuestionsFromExcel(
            @RequestParam("file") MultipartFile file) throws Exception {

        logger.info("Starting Excel import for assessment questions");

        // Validation: Check if file is empty
        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                .body(Map.of("error", "File is empty"));
        }

        // Parse Excel file using Apache POI
        Workbook workbook = new XSSFWorkbook(file.getInputStream());
        Sheet sheet = workbook.getSheetAt(0);

        // Step 1: Build column index map from header row
        Row headerRow = sheet.getRow(0);
        Map<String, Integer> columnIndexMap = new HashMap<>();

        for (int i = 0; i < headerRow.getLastCellNum(); i++) {
            Cell cell = headerRow.getCell(i);
            if (cell != null) {
                columnIndexMap.put(cell.getStringCellValue(), i);
            }
        }

        // Step 2: Get all MeasuredQualityTypes for MQT name resolution
        List<MeasuredQualityTypes> allMQTs = measuredQualityTypesRepository.findAll();
        Map<String, Long> mqtNameToIdMap = allMQTs.stream()
            .collect(Collectors.toMap(
                mqt -> mqt.getMeasuredQualityTypeName().toLowerCase(),
                MeasuredQualityTypes::getMeasuredQualityTypeId
            ));

        // Step 3: Determine how many option columns exist
        int maxOptions = 0;
        for (int i = 1; i <= 20; i++) {
            if (columnIndexMap.containsKey("Option " + i + " Text")) {
                maxOptions = i;
            } else {
                break;
            }
        }

        // Step 4: Process each row as a complete question (horizontal format)
        int successCount = 0;
        int failedCount = 0;
        List<String> errors = new ArrayList<>();

        for (int rowIdx = 1; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
            Row row = sheet.getRow(rowIdx);
            if (row == null) continue;

            Integer qtIdx = columnIndexMap.get("Question Text");
            if (qtIdx == null) continue;

            String questionText = getCellValueAsString(row.getCell(qtIdx));
            if (questionText == null || questionText.trim().isEmpty()) continue;

            try {
                AssessmentQuestions question = new AssessmentQuestions();
                question.setQuestionText(questionText);

                Integer qtypeIdx = columnIndexMap.get("Question Type");
                if (qtypeIdx != null) {
                    question.setQuestionType(getCellValueAsString(row.getCell(qtypeIdx)));
                }

                // Max Options Allowed
                Integer maxOptsIdx = columnIndexMap.get("Max Options Allowed");
                if (maxOptsIdx != null) {
                    Cell maxOptsCell = row.getCell(maxOptsIdx);
                    if (maxOptsCell != null && maxOptsCell.getCellType() != CellType.BLANK) {
                        question.setMaxOptionsAllowed((int) maxOptsCell.getNumericCellValue());
                    }
                }

                // Section
                Integer sectionIdx = columnIndexMap.get("Section ID");
                if (sectionIdx != null) {
                    Cell sectionCell = row.getCell(sectionIdx);
                    if (sectionCell != null && sectionCell.getCellType() != CellType.BLANK) {
                        Long sectionId = Long.parseLong(getCellValueAsString(sectionCell));
                        QuestionSection section = questionSectionRepository.findById(sectionId)
                            .orElseThrow(() -> new RuntimeException("Section not found: " + sectionId));
                        question.setSection(section);
                    }
                }

                // Parse options from horizontal columns (Option N Text, Option N Description, Option N MQTs)
                List<AssessmentQuestionOptions> options = new ArrayList<>();
                for (int i = 1; i <= maxOptions; i++) {
                    Integer optTextIdx = columnIndexMap.get("Option " + i + " Text");
                    if (optTextIdx == null) break;

                    String optText = getCellValueAsString(row.getCell(optTextIdx));
                    if (optText == null || optText.trim().isEmpty()) continue;

                    AssessmentQuestionOptions option = new AssessmentQuestionOptions();
                    option.setOptionText(optText);

                    // Option Description
                    Integer optDescIdx = columnIndexMap.get("Option " + i + " Description");
                    if (optDescIdx != null) {
                        option.setOptionDescription(getCellValueAsString(row.getCell(optDescIdx)));
                    }

                    option.setCorrect(false);
                    option.setIsGame(false);

                    // Parse MQT scores from "MQTName:Score,MQTName:Score" format
                    Integer optMqtIdx = columnIndexMap.get("Option " + i + " MQTs");
                    List<OptionScoreBasedOnMEasuredQualityTypes> scores = new ArrayList<>();
                    if (optMqtIdx != null) {
                        String mqtString = getCellValueAsString(row.getCell(optMqtIdx));
                        if (mqtString != null && !mqtString.trim().isEmpty()) {
                            String[] pairs = mqtString.split(",");
                            for (String pair : pairs) {
                                String[] parts = pair.split(":");
                                if (parts.length == 2) {
                                    String mqtName = parts[0].trim().toLowerCase();
                                    Long mqtId = mqtNameToIdMap.get(mqtName);
                                    if (mqtId != null) {
                                        OptionScoreBasedOnMEasuredQualityTypes score =
                                            new OptionScoreBasedOnMEasuredQualityTypes();
                                        score.setScore((int) Double.parseDouble(parts[1].trim()));
                                        score.setQuestion_option(option);
                                        score.setMeasuredQualityType(new MeasuredQualityTypes(mqtId));
                                        scores.add(score);
                                    }
                                }
                            }
                        }
                    }

                    option.setOptionScores(scores);
                    option.setQuestion(question);
                    options.add(option);
                }

                question.setOptions(options);

                // Create the question
                createAssessmentQuestion(question);
                successCount++;
            } catch (Exception e) {
                failedCount++;
                errors.add("Row " + rowIdx + " '" + questionText.substring(0, Math.min(50, questionText.length())) + "': " + e.getMessage());
                logger.error("Failed to import row " + rowIdx, e);
            }
        }

        workbook.close();

        // Step 5: Refresh cache after import to sync with database
        try {
            List<AssessmentQuestions> refreshed = fetchAndTransformFromDb();
            writeCache(refreshed);
        } catch (Exception e) {
            logger.warn("Failed to refresh cache after import", e);
        }

        logger.info("Excel import completed: {} success, {} failed", successCount, failedCount);

        // Step 6: Return result summary to frontend
        Map<String, Object> result = new HashMap<>();
        result.put("success", successCount);
        result.put("failed", failedCount);
        result.put("errors", errors);

        return ResponseEntity.ok(result);
    }

    /**
     * Helper method: Safely extract cell value as string
     *
     * Handles different cell types (STRING, NUMERIC, BOOLEAN, BLANK)
     * and converts them to string representation.
     *
     * @param cell The Excel cell to read
     * @return String value of the cell, or empty string if null/blank
     */
    private String getCellValueAsString(Cell cell) {
        if (cell == null) return "";

        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue();
            case NUMERIC:
                // Convert numeric to long to avoid decimal points for IDs
                return String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case BLANK:
                return "";
            default:
                return "";
        }
    }

}
