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
        List<AssessmentQuestions> assementQuestionsObject = assessmentQuestionRepository.findAll();
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
        existingQuestion.setmaxAllowedOptions(assessmentQuestions.getmaxOptionsAllowed());

        // Step 3: Update section relationship (validate section exists first)
        if (assessmentQuestions.getSection() != null && assessmentQuestions.getSection().getSectionId() != null) {
            QuestionSection section = questionSectionRepository
                    .findById(assessmentQuestions.getSection().getSectionId()).orElse(null);
            if (section != null) {
                existingQuestion.setSection(section);
            }
        }

        // Step 4: Replace options - this is critical for handling option deletions
        if (assessmentQuestions.getOptions() != null && !assessmentQuestions.getOptions().isEmpty()) {
            // Clear all existing options first
            // This triggers CASCADE delete for associated scores automatically
            if (existingQuestion.getOptions() != null) {
                existingQuestion.getOptions().clear();
            }

            // Add new/updated options from the request
            for (AssessmentQuestionOptions option : assessmentQuestions.getOptions()) {
                // Wire the back-reference from option to question
                option.setQuestion(existingQuestion);

                // Wire up measured quality type scores for each option
                if (option.getOptionScores() != null) {
                    for (OptionScoreBasedOnMEasuredQualityTypes score : option.getOptionScores()) {
                        // Set the back-reference from score to option
                        score.setQuestion_option(option);

                        // Important: Use ID-only reference for MeasuredQualityType
                        // This prevents lazy loading issues and keeps the reference minimal
                        if (score.getMeasuredQualityType() != null
                                && score.getMeasuredQualityType().getMeasuredQualityTypeId() != null) {
                            score.setMeasuredQualityType(new MeasuredQualityTypes(
                                    score.getMeasuredQualityType().getMeasuredQualityTypeId()));
                        }
                    }
                }
            }

            // Set the new options list on the existing question
            existingQuestion.setOptions(assessmentQuestions.getOptions());
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
        assessmentQuestionRepository.deleteById(id);

        // refresh cache after delete
        try {
            List<AssessmentQuestions> refreshed = fetchAndTransformFromDb();
            writeCache(refreshed);
        } catch (Exception e) {
            logger.warn("Failed to refresh assessment questions cache after delete", e);
        }

        return ResponseEntity.ok("AssessmentQuestion and all related options/relationships deleted successfully.");
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

        // Fetch all measured quality types to create dynamic columns
        List<MeasuredQualityTypes> allMeasuredQualityTypes = measuredQualityTypesRepository.findAll();

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

        // Create header row with all column titles
        Row headerRow = sheet.createRow(0);
        int colNum = 0;

        // Define base columns (question and option information)
        String[] baseHeaders = {
            "Question ID",
            "Question Text",
            "Question Type",
            "Section ID",
            "Section Name",
            "Max Options Allowed",
            "Option ID",
            "Option Text",
            "Option Description",
            "Is Correct",
            "Is Game",
            "Game ID"
        };

        // Add base headers to the sheet
        for (String header : baseHeaders) {
            Cell cell = headerRow.createCell(colNum++);
            cell.setCellValue(header);
            cell.setCellStyle(headerStyle);
        }

        // Create a map to store measured quality type column indices
        // This map helps us know which column corresponds to which quality type
        Map<Long, Integer> mqtColumnMap = new HashMap<>();

        // Add dynamic columns for each measured quality type
        // Each quality type gets its own column for scores
        for (MeasuredQualityTypes mqt : allMeasuredQualityTypes) {
            Cell cell = headerRow.createCell(colNum);
            cell.setCellValue("MQT: " + mqt.getMeasuredQualityTypeName());
            cell.setCellStyle(headerStyle);

            // Store the column index for this quality type
            mqtColumnMap.put(mqt.getMeasuredQualityTypeId(), colNum);
            colNum++;
        }

        // Populate data rows
        int rowNum = 1;

        // Iterate through all questions
        for (AssessmentQuestions question : questions) {
            // Get question's section information
            QuestionSection section = question.getSection();
            String sectionId = section != null ? section.getSectionId().toString() : "";
            String sectionName = section != null ? section.getSectionName() : "";

            // Get all options for this question
            List<AssessmentQuestionOptions> options = question.getOptions();

            // If question has no options, still create one row to show the question
            if (options == null || options.isEmpty()) {
                Row row = sheet.createRow(rowNum++);
                colNum = 0;

                // Fill in question details
                row.createCell(colNum++).setCellValue(question.getQuestionId());
                row.createCell(colNum++).setCellValue(question.getQuestionText() != null ? question.getQuestionText() : "");
                row.createCell(colNum++).setCellValue(question.getQuestionType() != null ? question.getQuestionType() : "");
                row.createCell(colNum++).setCellValue(sectionId);
                row.createCell(colNum++).setCellValue(sectionName);
                row.createCell(colNum++).setCellValue(question.getmaxOptionsAllowed());

                // Leave option columns empty
                for (int i = 0; i < 6; i++) {
                    row.createCell(colNum++).setCellValue("");
                }
            } else {
                // Create a row for each option of the question
                for (AssessmentQuestionOptions option : options) {
                    Row row = sheet.createRow(rowNum++);
                    colNum = 0;

                    // Fill in question details (repeated for each option row)
                    row.createCell(colNum++).setCellValue(question.getQuestionId());
                    row.createCell(colNum++).setCellValue(question.getQuestionText() != null ? question.getQuestionText() : "");
                    row.createCell(colNum++).setCellValue(question.getQuestionType() != null ? question.getQuestionType() : "");
                    row.createCell(colNum++).setCellValue(sectionId);
                    row.createCell(colNum++).setCellValue(sectionName);
                    row.createCell(colNum++).setCellValue(question.getmaxOptionsAllowed());

                    // Fill in option details
                    row.createCell(colNum++).setCellValue(option.getOptionId());
                    row.createCell(colNum++).setCellValue(option.getOptionText() != null ? option.getOptionText() : "");
                    row.createCell(colNum++).setCellValue(option.getOptionDescription() != null ? option.getOptionDescription() : "");
                    row.createCell(colNum++).setCellValue(option.isCorrect() ? "Yes" : "No");
                    row.createCell(colNum++).setCellValue(option.getIsGame() != null && option.getIsGame() ? "Yes" : "No");

                    // Add game ID if option is linked to a game
                    if (option.getIsGame() != null && option.getIsGame() && option.getGame() != null) {
                        row.createCell(colNum++).setCellValue(option.getGame().getGameId());
                    } else {
                        row.createCell(colNum++).setCellValue("");
                    }

                    // Fill in measured quality type scores for this option
                    // Initialize all MQT columns with empty values first
                    for (int i = 0; i < allMeasuredQualityTypes.size(); i++) {
                        row.createCell(colNum + i).setCellValue("");
                    }

                    // Now fill in the actual scores for this option
                    List<OptionScoreBasedOnMEasuredQualityTypes> scores = option.getOptionScores();
                    if (scores != null && !scores.isEmpty()) {
                        for (OptionScoreBasedOnMEasuredQualityTypes score : scores) {
                            if (score.getMeasuredQualityType() != null) {
                                Long mqtId = score.getMeasuredQualityType().getMeasuredQualityTypeId();
                                Integer columnIndex = mqtColumnMap.get(mqtId);

                                // Set the score value in the appropriate column
                                if (columnIndex != null) {
                                    Cell scoreCell = row.getCell(columnIndex);
                                    if (scoreCell == null) {
                                        scoreCell = row.createCell(columnIndex);
                                    }
                                    scoreCell.setCellValue(score.getScore() != null ? score.getScore() : 0);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Auto-size all columns for better readability
        for (int i = 0; i < colNum; i++) {
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
        // This maps column names to their index positions
        Row headerRow = sheet.getRow(0);
        Map<String, Integer> columnIndexMap = new HashMap<>();

        for (int i = 0; i < headerRow.getLastCellNum(); i++) {
            Cell cell = headerRow.getCell(i);
            if (cell != null) {
                columnIndexMap.put(cell.getStringCellValue(), i);
            }
        }

        // Step 2: Get all MeasuredQualityTypes for dynamic column mapping
        // The Excel has dynamic columns like "MQT: Analytical Thinking"
        List<MeasuredQualityTypes> allMQTs = measuredQualityTypesRepository.findAll();
        Map<String, Long> mqtNameToIdMap = allMQTs.stream()
            .collect(Collectors.toMap(
                mqt -> "MQT: " + mqt.getMeasuredQualityTypeName(),
                MeasuredQualityTypes::getMeasuredQualityTypeId
            ));

        // Step 3: Group rows by Question ID
        // Questions with same ID belong together (one row per option)
        Map<Long, List<Row>> questionRowsMap = new LinkedHashMap<>();
        List<Row> newQuestionRows = new ArrayList<>();

        for (int rowIdx = 1; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
            Row row = sheet.getRow(rowIdx);
            if (row == null) continue;

            // Get Question ID cell to determine if this is create or update
            Cell questionIdCell = row.getCell(columnIndexMap.get("Question ID"));

            if (questionIdCell == null || questionIdCell.getCellType() == CellType.BLANK) {
                // New question (no ID) → will be created
                newQuestionRows.add(row);
            } else {
                // Existing question (has ID) → will be updated
                Long questionId = (long) questionIdCell.getNumericCellValue();
                questionRowsMap.computeIfAbsent(questionId, k -> new ArrayList<>()).add(row);
            }
        }

        workbook.close();

        // Step 4: Process imports and track results
        int successCount = 0;
        int failedCount = 0;
        List<String> errors = new ArrayList<>();

        // Process existing questions (updates)
        for (Map.Entry<Long, List<Row>> entry : questionRowsMap.entrySet()) {
            try {
                // Parse question data from Excel rows
                AssessmentQuestions question = parseQuestionFromRows(
                    entry.getValue(),
                    columnIndexMap,
                    mqtNameToIdMap
                );
                question.setQuestionId(entry.getKey());

                // Call update endpoint logic to save changes
                updateAssessmentQuestion(entry.getKey(), question);
                successCount++;
            } catch (Exception e) {
                failedCount++;
                errors.add("Question ID " + entry.getKey() + ": " + e.getMessage());
                logger.error("Failed to import question " + entry.getKey(), e);
            }
        }

        // Process new questions (creates)
        if (!newQuestionRows.isEmpty()) {
            List<Row> currentQuestionRows = new ArrayList<>();
            String currentQuestionText = null;

            // Group rows by question text (since no ID to group by)
            for (Row row : newQuestionRows) {
                String questionText = getCellValueAsString(
                    row.getCell(columnIndexMap.get("Question Text"))
                );

                // When question text changes, process the previous question
                if (currentQuestionText != null && !currentQuestionText.equals(questionText)) {
                    // Process previous question
                    try {
                        AssessmentQuestions question = parseQuestionFromRows(
                            currentQuestionRows,
                            columnIndexMap,
                            mqtNameToIdMap
                        );
                        createAssessmentQuestion(question);
                        successCount++;
                    } catch (Exception e) {
                        failedCount++;
                        errors.add("New question '" + currentQuestionText + "': " + e.getMessage());
                    }
                    currentQuestionRows.clear();
                }

                currentQuestionText = questionText;
                currentQuestionRows.add(row);
            }

            // Process the last question in the list
            if (!currentQuestionRows.isEmpty()) {
                try {
                    AssessmentQuestions question = parseQuestionFromRows(
                        currentQuestionRows,
                        columnIndexMap,
                        mqtNameToIdMap
                    );
                    createAssessmentQuestion(question);
                    successCount++;
                } catch (Exception e) {
                    failedCount++;
                    errors.add("New question '" + currentQuestionText + "': " + e.getMessage());
                }
            }
        }

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
     * Helper method: Parse AssessmentQuestions object from Excel rows
     *
     * Multiple rows can belong to the same question (one row per option).
     * This method parses all rows for a single question and constructs
     * the complete question object with all options and their scores.
     *
     * @param rows All Excel rows belonging to this question
     * @param colMap Column name to index mapping
     * @param mqtMap MeasuredQualityType name to ID mapping
     * @return Parsed AssessmentQuestions object with all relationships
     */
    private AssessmentQuestions parseQuestionFromRows(
            List<Row> rows,
            Map<String, Integer> colMap,
            Map<String, Long> mqtMap) {

        if (rows.isEmpty()) {
            throw new IllegalArgumentException("No rows provided for parsing");
        }

        // First row contains question details (same across all rows for this question)
        Row firstRow = rows.get(0);

        // Create and populate question object
        AssessmentQuestions question = new AssessmentQuestions();
        question.setQuestionText(getCellValueAsString(firstRow.getCell(colMap.get("Question Text"))));
        question.setQuestionType(getCellValueAsString(firstRow.getCell(colMap.get("Question Type"))));

        // Parse Max Options Allowed
        Cell maxOptionsCell = firstRow.getCell(colMap.get("Max Options Allowed"));
        if (maxOptionsCell != null && maxOptionsCell.getCellType() != CellType.BLANK) {
            question.setmaxAllowedOptions((int) maxOptionsCell.getNumericCellValue());
        }

        // Parse Section - must exist in database
        Cell sectionIdCell = firstRow.getCell(colMap.get("Section ID"));
        if (sectionIdCell != null && sectionIdCell.getCellType() != CellType.BLANK) {
            Long sectionId = (long) sectionIdCell.getNumericCellValue();
            QuestionSection section = questionSectionRepository.findById(sectionId)
                .orElseThrow(() -> new RuntimeException("Section not found: " + sectionId));
            question.setSection(section);
        }

        // Parse options - one option per row
        List<AssessmentQuestionOptions> options = new ArrayList<>();

        for (Row row : rows) {
            // Check if this row has option data
            Cell optionTextCell = row.getCell(colMap.get("Option Text"));
            if (optionTextCell == null || optionTextCell.getCellType() == CellType.BLANK) {
                continue;  // Skip rows without option data
            }

            // Create and populate option object
            AssessmentQuestionOptions option = new AssessmentQuestionOptions();

            // Option ID (for updates - will be null for new options)
            Cell optionIdCell = row.getCell(colMap.get("Option ID"));
            if (optionIdCell != null && optionIdCell.getCellType() != CellType.BLANK) {
                option.setOptionId((long) optionIdCell.getNumericCellValue());
            }

            option.setOptionText(getCellValueAsString(optionTextCell));
            option.setOptionDescription(getCellValueAsString(row.getCell(colMap.get("Option Description"))));

            // Parse Is Correct (accepts "Yes", "yes", "True", "true")
            String isCorrect = getCellValueAsString(row.getCell(colMap.get("Is Correct")));
            option.setCorrect("Yes".equalsIgnoreCase(isCorrect) || "true".equalsIgnoreCase(isCorrect));

            // Parse Is Game
            String isGame = getCellValueAsString(row.getCell(colMap.get("Is Game")));
            option.setIsGame("Yes".equalsIgnoreCase(isGame) || "true".equalsIgnoreCase(isGame));

            // Parse Game ID if option is linked to a game
            if (option.getIsGame() != null && option.getIsGame()) {
                Cell gameIdCell = row.getCell(colMap.get("Game ID"));
                if (gameIdCell != null && gameIdCell.getCellType() != CellType.BLANK) {
                    Long gameId = (long) gameIdCell.getNumericCellValue();
                    GameTable game = new GameTable();
                    game.setGameId(gameId);
                    option.setGame(game);
                }
            }

            // Parse MQT scores from dynamic columns
            List<OptionScoreBasedOnMEasuredQualityTypes> scores = new ArrayList<>();

            for (Map.Entry<String, Long> mqtEntry : mqtMap.entrySet()) {
                Integer colIdx = colMap.get(mqtEntry.getKey());
                if (colIdx == null) continue;

                Cell scoreCell = row.getCell(colIdx);
                if (scoreCell != null && scoreCell.getCellType() != CellType.BLANK) {
                    // Create score object
                    OptionScoreBasedOnMEasuredQualityTypes score =
                        new OptionScoreBasedOnMEasuredQualityTypes();

                    score.setScore((int) scoreCell.getNumericCellValue());
                    score.setQuestion_option(option);
                    score.setMeasuredQualityType(new MeasuredQualityTypes(mqtEntry.getValue()));

                    scores.add(score);
                }
            }

            // Wire up relationships
            option.setOptionScores(scores);
            option.setQuestion(question);
            options.add(option);
        }

        question.setOptions(options);
        return question;
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
