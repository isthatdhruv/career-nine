package com.kccitm.api.controller.career9;

import java.util.List;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.Career;
import com.kccitm.api.model.career9.MeasuredQualities;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.repository.Career9.AssessmentQuestionRepository;
import com.kccitm.api.repository.Career9.CareerRepository;
import com.kccitm.api.repository.Career9.MeasuredQualitiesRepository;
import com.kccitm.api.repository.Career9.MeasuredQualityTypesRepository;
import com.kccitm.api.repository.Career9.OptionScoreBasedOnMeasuredQualityTypesRepository;

@RestController
@RequestMapping("/measured-quality-types")
public class MeasuredQualityTypesController {
    @Autowired
    private OptionScoreBasedOnMeasuredQualityTypesRepository optionScoreRepo;
    
    @Autowired
    private MeasuredQualityTypesRepository measuredQualityTypesRepository;
    
    @Autowired
    private CareerRepository careerRepository;
    
    @Autowired
    private AssessmentQuestionRepository assessmentQuestionRepository;
    
    @Autowired
    private MeasuredQualitiesRepository measuredQualitiesRepository;

    @Cacheable("measuredQualityTypes")
    @GetMapping("/getAll")
    public List<MeasuredQualityTypes> getAllMeasuredQualityTypes() {
        return measuredQualityTypesRepository.findAll();
    }

    @GetMapping("/get/{id}")
    public MeasuredQualityTypes getMeasuredQualityTypesById(@PathVariable Long id) {
        return measuredQualityTypesRepository.findById(id).orElse(null);
    }

    @CacheEvict(value = "measuredQualityTypes", allEntries = true)
    @PostMapping("/create")
    public MeasuredQualityTypes createMeasuredQualityTypes(@RequestBody MeasuredQualityTypes measuredQualityTypes) {
        return measuredQualityTypesRepository.save(measuredQualityTypes);
    }
    @CacheEvict(value = "measuredQualityTypes", allEntries = true)
    @PutMapping("/update/{id}")
    public MeasuredQualityTypes updateMeasuredQualityTypes(@PathVariable Long id, @RequestBody MeasuredQualityTypes measuredQualityTypes) {
        MeasuredQualityTypes existingType = measuredQualityTypesRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("MeasuredQualityType not found"));

        // Only update simple fields, not relationships
        existingType.setMeasuredQualityTypeName(measuredQualityTypes.getMeasuredQualityTypeName());
        existingType.setMeasuredQualityTypeDescription(measuredQualityTypes.getMeasuredQualityTypeDescription());
        existingType.setMeasuredQualityTypeDisplayName(measuredQualityTypes.getMeasuredQualityTypeDisplayName());
        // Do NOT update careers or assessmentQuestions here

        return measuredQualityTypesRepository.save(existingType);
    }
    @CacheEvict(value = "measuredQualityTypes", allEntries = true)
    @DeleteMapping("/delete/{id}")
    public ResponseEntity<String> deleteMeasuredQualityTypes(@PathVariable Long id) {
        MeasuredQualityTypes type = measuredQualityTypesRepository.findById(id).orElse(null);
        if (type == null) {
            return ResponseEntity.notFound().build();
        }
        // Nullify measuredQualityType in all related OptionScoreBasedOnMEasuredQualityTypes
        if (type.getOptionScores() != null) {
            for (var score : type.getOptionScores()) {
                score.setMeasuredQualityType(type);
                optionScoreRepo.save(score);
            }
        }
        measuredQualityTypesRepository.deleteById(id);
        return ResponseEntity.ok("MeasuredQualityType deleted. All mappings removed, no score entries deleted.");
    }
    
    // Many-to-Many relationship management endpoints
    
    // Career relationships
    @PostMapping("/{typeId}/careers/{careerId}")
    public ResponseEntity<String> addCareerToMeasuredQualityType(@PathVariable Long typeId, @PathVariable Long careerId) {
        MeasuredQualityTypes measurementType = measuredQualityTypesRepository.findById(typeId).orElse(null);
        Career career = careerRepository.findById(careerId).orElse(null);
        
        if (measurementType == null || career == null) {
            return ResponseEntity.badRequest().body("MeasuredQualityType or Career not found");
        }
        
        measurementType.addCareer(career);
        measuredQualityTypesRepository.save(measurementType);
        
        return ResponseEntity.ok("Career successfully associated with MeasuredQualityType");
    }
    
    @DeleteMapping("/{typeId}/careers/{careerId}")
    public ResponseEntity<String> removeCareerFromMeasuredQualityType(@PathVariable Long typeId, @PathVariable Long careerId) {
        MeasuredQualityTypes measurementType = measuredQualityTypesRepository.findById(typeId).orElse(null);
        Career career = careerRepository.findById(careerId).orElse(null);
        
        if (measurementType == null || career == null) {
            return ResponseEntity.badRequest().body("MeasuredQualityType or Career not found");
        }
        
        measurementType.removeCareer(career);
        measuredQualityTypesRepository.save(measurementType);
        
        return ResponseEntity.ok("Career successfully removed from MeasuredQualityType");
    }
    
    @GetMapping("/{typeId}/careers")
    public ResponseEntity<Set<Career>> getMeasuredQualityTypeCareers(@PathVariable Long typeId) {
        MeasuredQualityTypes measurementType = measuredQualityTypesRepository.findById(typeId).orElse(null);
        
        if (measurementType == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(measurementType.getCareers());
    }
    
    // One-to-Many relationship: MeasuredQualities to MeasuredQualityTypes
    @PutMapping("/{typeId}/assign-quality/{qualityId}")
    public ResponseEntity<String> assignMeasuredQualityTypeToQuality(@PathVariable Long typeId, @PathVariable Long qualityId) {
        MeasuredQualityTypes MQType = measuredQualityTypesRepository.findById(typeId).orElse(null);
        MeasuredQualities mQuality = measuredQualitiesRepository.findById(qualityId).orElse(null);

        if (MQType == null) {
            return ResponseEntity.status(404).body("MeasuredQualityType not found");
        }
        if (mQuality == null) {
            return ResponseEntity.status(404).body("MeasuredQuality not found");
        }

        MQType.setMeasuredQuality(mQuality);
        measuredQualityTypesRepository.save(MQType);

        return ResponseEntity.ok("MeasuredQualityType successfully assigned to MeasuredQuality");
    }
    
    @PutMapping("/{typeId}/remove-quality")
    public ResponseEntity<String> removeMeasuredQualityTypeFromQuality(@PathVariable Long typeId) {
        MeasuredQualityTypes measurementType = measuredQualityTypesRepository.findById(typeId).orElse(null);
        
        if (measurementType == null) {
            return ResponseEntity.badRequest().body("MeasuredQualityType not found");
        }
        
        // Remove the association (set to null)
        measurementType.setMeasuredQuality(null);
        measuredQualityTypesRepository.save(measurementType);
        
        return ResponseEntity.ok("MeasuredQualityType successfully removed from MeasuredQuality");
    }
}