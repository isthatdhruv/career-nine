package com.kccitm.api.controller.career9;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
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
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentQuestions;
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
        // Wire up relationships and clean references before saving
        
        AssessmentQuestions assementQustionObject = assessmentQuestionRepository.save(assessmentQuestions);

        return assementQustionObject.getId() != null ? assementQustionObject : null;
    }

    @PutMapping("/update/{id}")
    // public AssessmentQuestions updateAssessmentQuestion(@PathVariable Long id,
    //         @RequestBody AssessmentQuestions assessmentQuestions) {
    //     AssessmentQuestions existingQuestion = assessmentQuestionRepository.findById(id)
    //             .orElseThrow(() -> new RuntimeException("Question not found with ID: " + id));

    //     existingQuestion.setQuestionText(assessmentQuestions.getQuestionText());
    //     existingQuestion.setQuestionType(assessmentQuestions.getQuestionType());

    //     if (assessmentQuestions.getSection() != null && assessmentQuestions.getSection().getSectionId() != null) {
    //         QuestionSection section = questionSectionRepository
    //                 .findById(assessmentQuestions.getSection().getSectionId()).orElse(null);
    //         if (section != null) {
    //             existingQuestion.setSection(section);
    //         }
    //     }

    //     if (assessmentQuestions.getOptions() != null && !assessmentQuestions.getOptions().isEmpty()) {
    //         if (existingQuestion.getOptions() != null) {
    //             existingQuestion.getOptions().clear();
    //         }

    //         for (AssessmentQuestionOptions option : assessmentQuestions.getOptions()) {
    //             option.setQuestion(existingQuestion);
    //             // Also wire up MQT scores inside options for updates
    //             if (option.getOptionScores() != null) {
    //                 for (OptionScoreBasedOnMEasuredQualityTypes score : option.getOptionScores()) {
    //                     score.setQuestion_option(option);
    //                     if (score.getMeasuredQualityType() != null
    //                             && score.getMeasuredQualityType().getMeasuredQualityTypeId() != null) {
    //                         score.setMeasuredQualityType(new MeasuredQualityTypes(
    //                                 score.getMeasuredQualityType().getMeasuredQualityTypeId()));
    //                     }
    //                 }
    //             }
    //         }
    //         existingQuestion.setOptions(assessmentQuestions.getOptions());
    //     }

    //     AssessmentQuestions saved = assessmentQuestionRepository.save(existingQuestion);

    //     // refresh cache after update
    //     try {
    //         List<AssessmentQuestions> refreshed = fetchAndTransformFromDb();
    //         writeCache(refreshed);
    //     } catch (Exception e) {
    //         logger.warn("Failed to refresh assessment questions cache after update", e);
    //     }

    //     return saved;
    // }

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

}
