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
    private MeasuredQualityTypesRepository measuredQualityTypesRepository;

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
    public ResponseEntity<?> createOptionScores(@RequestBody List<OptionScoreBasedOnMEasuredQualityTypes> scores) {
        for (OptionScoreBasedOnMEasuredQualityTypes score : scores) {
            // Set option entity
            if (score.getQuestion_option() != null && score.getQuestion_option().getOptionId() != null) {
                AssessmentQuestionOptions option = optionRepository.findById(score.getQuestion_option().getOptionId()).orElse(null);
                score.setQuestion_option(option);
            } else {
                return ResponseEntity.badRequest().body("Missing optionId for a score entry");
            }
            // Set measured quality type entity
            if (score.getMeasuredQualityType() != null && score.getMeasuredQualityType().getMeasuredQualityTypeId() != null) {
                MeasuredQualityTypes mqt = measuredQualityTypesRepository.findById(score.getMeasuredQualityType().getMeasuredQualityTypeId()).orElse(null);
                score.setMeasuredQualityType(mqt);
            } else {
                return ResponseEntity.badRequest().body("Missing measuredQualityTypeId for a score entry");
            }
        }
        optionScoreRepository.saveAll(scores);
        return ResponseEntity.ok("Saved all option scores");
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<OptionScoreBasedOnMEasuredQualityTypes> updateOptionScore(@PathVariable Long id, @RequestBody OptionScoreBasedOnMEasuredQualityTypes optionScore) {
        try {
            optionScore.setScoreId(id);
            // Set option entity
            if (optionScore.getQuestion_option() != null && optionScore.getQuestion_option().getOptionId() != null) {
                AssessmentQuestionOptions option = optionRepository.findById(optionScore.getQuestion_option().getOptionId()).orElse(null);
                optionScore.setQuestion_option(option);
            } else {
                return ResponseEntity.badRequest().build();
            }
            // Set measured quality type entity
            if (optionScore.getMeasuredQualityType() != null && optionScore.getMeasuredQualityType().getMeasuredQualityTypeId() != null) {
                MeasuredQualityTypes mqt = measuredQualityTypesRepository.findById(optionScore.getMeasuredQualityType().getMeasuredQualityTypeId()).orElse(null);
                optionScore.setMeasuredQualityType(mqt);
            } else {
                return ResponseEntity.badRequest().build();
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

    // @GetMapping("/by-option/{optionId}")
    // public ResponseEntity<List<OptionScoreBasedOnMEasuredQualityTypes>> getScoresByOption(@PathVariable Long optionId) {
    //     List<OptionScoreBasedOnMEasuredQualityTypes> scores = optionScoreRepository.findByQuestionOptionAssessmentQuestionOptionId(optionId);
    //     return ResponseEntity.ok(scores);
    // }

    // @GetMapping("/by-quality-type/{qualityTypeId}")
    // public ResponseEntity<List<OptionScoreBasedOnMEasuredQualityTypes>> getScoresByQualityType(@PathVariable Long qualityTypeId) {
    //     List<OptionScoreBasedOnMEasuredQualityTypes> scores = optionScoreRepository.findByMeasuredQualityTypeMeasuredQualityTypeId(qualityTypeId);
    //     return ResponseEntity.ok(scores);
    // }

    // @GetMapping("/specific")
    // public ResponseEntity<OptionScoreBasedOnMEasuredQualityTypes> getSpecificScore(
    //         @RequestParam Long optionId, 
    //         @RequestParam Long qualityTypeId) {
        
    //     OptionScoreBasedOnMEasuredQualityTypes score = optionScoreRepository.findByOptionAndQualityType(optionId, qualityTypeId);
        
    //     if (score == null) {
    //         return ResponseEntity.notFound().build();
    //     }
        
    //     return ResponseEntity.ok(score);
    // }

    // Removed redundant batch-create endpoint. Use /create for batch creation.

    

   
}
