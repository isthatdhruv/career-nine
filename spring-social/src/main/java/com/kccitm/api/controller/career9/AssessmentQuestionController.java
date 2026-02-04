package com.kccitm.api.controller.career9;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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

}
