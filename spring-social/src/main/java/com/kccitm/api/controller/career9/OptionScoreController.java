package com.kccitm.api.controller.career9;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
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

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.repository.Career9.AssessmentQuestionOptionsRepository;
import com.kccitm.api.repository.Career9.MeasuredQualityTypesRepository;
import com.kccitm.api.repository.Career9.OptionScoreBasedOnMeasuredQualityTypesRepository;

@RestController
@RequestMapping("/api/option-scores")
public class OptionScoreController {

    @Autowired
    private OptionScoreBasedOnMeasuredQualityTypesRepository optionScoreRepository;
    
    @Autowired
    private AssessmentQuestionOptionsRepository optionRepository;
    
    @Autowired
    private MeasuredQualityTypesRepository qualityTypeRepository;

    @GetMapping("/getAll")
    public List<OptionScoreBasedOnMEasuredQualityTypes> getAllOptionScores() {
        return optionScoreRepository.findAll();
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<OptionScoreBasedOnMEasuredQualityTypes> getOptionScoreById(@PathVariable Long id) {
        Optional<OptionScoreBasedOnMEasuredQualityTypes> score = optionScoreRepository.findById(id);
        return score.map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/create")
    public ResponseEntity<OptionScoreBasedOnMEasuredQualityTypes> createOptionScore(@RequestBody OptionScoreBasedOnMEasuredQualityTypes optionScore) {
        try {
            if (optionScore.getQuestion_option() == null || optionScore.getQuestion_option().getOptionId() == null) {
                return ResponseEntity.badRequest().build();
            }
            if (optionScore.getMeasuredQualityType() == null || optionScore.getMeasuredQualityType().getMeasuredQualityTypeId() == null) {
                return ResponseEntity.badRequest().build();
            }

            AssessmentQuestionOptions option = optionRepository.findById(optionScore.getQuestion_option().getOptionId())
                .orElse(null);
            MeasuredQualityTypes qualityType = qualityTypeRepository.findById(optionScore.getMeasuredQualityType().getMeasuredQualityTypeId())
                .orElse(null);

            if (option == null || qualityType == null) {
                return ResponseEntity.badRequest().build();
            }

            optionScore.setQuestion_option(option);
            optionScore.setMeasuredQualityType(qualityType);

            OptionScoreBasedOnMEasuredQualityTypes savedScore = optionScoreRepository.save(optionScore);
            return ResponseEntity.ok(savedScore);
            
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<OptionScoreBasedOnMEasuredQualityTypes> updateOptionScore(@PathVariable Long id, @RequestBody OptionScoreBasedOnMEasuredQualityTypes optionScore) {
        if (!optionScoreRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        try {
            optionScore.setScoreId(id);
            
            if (optionScore.getQuestion_option() != null && optionScore.getQuestion_option().getOptionId() != null) {
                AssessmentQuestionOptions option = optionRepository.findById(optionScore.getQuestion_option().getOptionId())
                    .orElse(null);
                if (option == null) {
                    return ResponseEntity.badRequest().build();
                }
                optionScore.setQuestion_option(option);
            }

            if (optionScore.getMeasuredQualityType() != null && optionScore.getMeasuredQualityType().getMeasuredQualityTypeId() != null) {
                MeasuredQualityTypes qualityType = qualityTypeRepository.findById(optionScore.getMeasuredQualityType().getMeasuredQualityTypeId())
                    .orElse(null);
                if (qualityType == null) {
                    return ResponseEntity.badRequest().build();
                }
                optionScore.setMeasuredQualityType(qualityType);
            }

            OptionScoreBasedOnMEasuredQualityTypes updatedScore = optionScoreRepository.save(optionScore);
            return ResponseEntity.ok(updatedScore);
            
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<String> deleteOptionScore(@PathVariable Long id) {
        if (!optionScoreRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        optionScoreRepository.deleteById(id);
        return ResponseEntity.ok("Option score deleted successfully");
    }

    @GetMapping("/by-option/{optionId}")
    public ResponseEntity<List<OptionScoreBasedOnMEasuredQualityTypes>> getScoresByOption(@PathVariable Long optionId) {
        List<OptionScoreBasedOnMEasuredQualityTypes> scores = optionScoreRepository.findByQuestionOptionAssessmentQuestionOptionId(optionId);
        return ResponseEntity.ok(scores);
    }

    @GetMapping("/by-quality-type/{qualityTypeId}")
    public ResponseEntity<List<OptionScoreBasedOnMEasuredQualityTypes>> getScoresByQualityType(@PathVariable Long qualityTypeId) {
        List<OptionScoreBasedOnMEasuredQualityTypes> scores = optionScoreRepository.findByMeasuredQualityTypeMeasuredQualityTypeId(qualityTypeId);
        return ResponseEntity.ok(scores);
    }

    @GetMapping("/specific")
    public ResponseEntity<OptionScoreBasedOnMEasuredQualityTypes> getSpecificScore(
            @RequestParam Long optionId, 
            @RequestParam Long qualityTypeId) {
        
        OptionScoreBasedOnMEasuredQualityTypes score = optionScoreRepository.findByOptionAndQualityType(optionId, qualityTypeId);
        
        if (score == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(score);
    }

    @PostMapping("/batch-create")
    public ResponseEntity<List<OptionScoreBasedOnMEasuredQualityTypes>> createBatchScores(@RequestBody List<OptionScoreBasedOnMEasuredQualityTypes> scores) {
        try {
            List<OptionScoreBasedOnMEasuredQualityTypes> savedScores = optionScoreRepository.saveAll(scores);
            return ResponseEntity.ok(savedScores);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/by-question/{questionId}")
    public ResponseEntity<List<OptionScoreBasedOnMEasuredQualityTypes>> getScoresByQuestion(@PathVariable Long questionId) {
        List<OptionScoreBasedOnMEasuredQualityTypes> scores = optionScoreRepository.findByQuestionId(questionId);
        return ResponseEntity.ok(scores);
    }

    @GetMapping("/average-score/{qualityTypeId}")
    public ResponseEntity<Double> getAverageScoreByQualityType(@PathVariable Long qualityTypeId) {
        Double average = optionScoreRepository.getAverageScoreByQualityType(qualityTypeId);
        if (average == null) {
            return ResponseEntity.ok(0.0);
        }
        return ResponseEntity.ok(average);
    }
}
