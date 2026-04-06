package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.repository.Career9.AssessmentQuestionOptionsRepository;
import com.kccitm.api.repository.Career9.MeasuredQualityTypesRepository;
import com.kccitm.api.repository.Career9.OptionScoreBasedOnMeasuredQualityTypesRepository;

@RestController
@RequestMapping("/option-scores")
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
        OptionScoreBasedOnMEasuredQualityTypes score = optionScoreRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("OptionScore", "id", id));
        return ResponseEntity.ok(score);
    }

    @PostMapping("/create")
    public ResponseEntity<?> createOptionScores(@RequestBody List<OptionScoreBasedOnMEasuredQualityTypes> scores) {
        int skipped = 0;
        List<OptionScoreBasedOnMEasuredQualityTypes> toSave = new ArrayList<>();

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

            // Dedup guard: skip if this (option, mqt) pair already exists
            Long optId = score.getQuestion_option().getOptionId();
            Long mqtId = score.getMeasuredQualityType().getMeasuredQualityTypeId();
            List<OptionScoreBasedOnMEasuredQualityTypes> existing = optionScoreRepository.findByOptionIdAndMqtId(optId, mqtId);
            if (!existing.isEmpty()) {
                skipped++;
                continue;
            }
            toSave.add(score);
        }
        optionScoreRepository.saveAll(toSave);
        return ResponseEntity.ok(Map.of("saved", toSave.size(), "skippedDuplicates", skipped));
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
            throw new ResourceNotFoundException("OptionScore", "id", id);
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

    /**
     * POST /option-scores/cleanup-duplicates
     *
     * Scans all option scores, finds (option_id, mqt_id) pairs with duplicates,
     * keeps the first row (lowest scoreId) and deletes the rest.
     */
    @PostMapping("/cleanup-duplicates")
    @Transactional
    public ResponseEntity<?> cleanupDuplicates() {
        List<OptionScoreBasedOnMEasuredQualityTypes> all = optionScoreRepository.findAll();

        // Group by (optionId, mqtId)
        Map<String, List<OptionScoreBasedOnMEasuredQualityTypes>> grouped = new HashMap<>();
        for (OptionScoreBasedOnMEasuredQualityTypes os : all) {
            if (os.getQuestion_option() == null || os.getMeasuredQualityType() == null) continue;
            String key = os.getQuestion_option().getOptionId() + "_" + os.getMeasuredQualityType().getMeasuredQualityTypeId();
            grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(os);
        }

        int duplicatePairs = 0;
        int deletedRows = 0;
        List<Long> deletedIds = new ArrayList<>();

        for (Map.Entry<String, List<OptionScoreBasedOnMEasuredQualityTypes>> entry : grouped.entrySet()) {
            List<OptionScoreBasedOnMEasuredQualityTypes> rows = entry.getValue();
            if (rows.size() <= 1) continue;

            duplicatePairs++;
            // Sort by scoreId descending — keep newest (highest scoreId), delete older ones
            rows.sort((a, b) -> Long.compare(b.getScoreId(), a.getScoreId()));
            for (int i = 1; i < rows.size(); i++) {
                deletedIds.add(rows.get(i).getScoreId());
                optionScoreRepository.delete(rows.get(i));
                deletedRows++;
            }
        }

        return ResponseEntity.ok(Map.of(
                "duplicatePairs", duplicatePairs,
                "deletedRows", deletedRows,
                "kept", "newest scoreId per (option, mqt) pair"
        ));
    }
}
