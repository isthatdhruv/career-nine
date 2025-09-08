package com.kccitm.api.controller.career9;

import java.util.List;
import java.util.Set;

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

import com.kccitm.api.model.career9.AssessmentQuestions;
import com.kccitm.api.model.career9.Career;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.repository.Career9.AssessmentQuestionRepository;
import com.kccitm.api.repository.Career9.CareerRepository;
import com.kccitm.api.repository.Career9.MeasuredQualitiesRepository;
import com.kccitm.api.repository.Career9.MeasuredQualityTypesRepository;

@RestController
@RequestMapping("/api/measured-quality-types")
public class MeasuredQualityTypesController {
    
    @Autowired
    private MeasuredQualityTypesRepository measuredQualityTypesRepository;
    
    @Autowired
    private CareerRepository careerRepository;
    
    @Autowired
    private AssessmentQuestionRepository assessmentQuestionRepository;
    
    @Autowired
    private MeasuredQualitiesRepository measuredQualitiesRepository;

    @GetMapping("/getAll")
    public List<MeasuredQualityTypes> getAllMeasuredQualityTypes() {
        return measuredQualityTypesRepository.findAll();
    }

    @GetMapping("/get/{id}")
    public MeasuredQualityTypes getMeasuredQualityTypesById(@PathVariable Long id) {
        return measuredQualityTypesRepository.findById(id).orElse(null);
    }

    @PostMapping("/create")
    public MeasuredQualityTypes createMeasuredQualityTypes(@RequestBody MeasuredQualityTypes measuredQualityTypes) {
        return measuredQualityTypesRepository.save(measuredQualityTypes);
    }
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
    @DeleteMapping("/delete/{id}")
    public void deleteMeasuredQualityTypes(@PathVariable Long id) {
        measuredQualityTypesRepository.deleteById(id);
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
    
    // AssessmentQuestion relationships
    @PostMapping("/{typeId}/assessment-questions/{questionId}")
    public ResponseEntity<String> addAssessmentQuestionToMeasuredQualityType(@PathVariable Long typeId, @PathVariable Long questionId) {
        MeasuredQualityTypes measurementType = measuredQualityTypesRepository.findById(typeId).orElse(null);
        AssessmentQuestions question = assessmentQuestionRepository.findById(questionId).orElse(null);
        
        if (measurementType == null || question == null) {
            return ResponseEntity.badRequest().body("MeasuredQualityType or AssessmentQuestion not found");
        }
        
        measurementType.addAssessmentQuestion(question);
        measuredQualityTypesRepository.save(measurementType);
        
        return ResponseEntity.ok("AssessmentQuestion successfully associated with MeasuredQualityType");
    }
    
    @DeleteMapping("/{typeId}/assessment-questions/{questionId}")
    public ResponseEntity<String> removeAssessmentQuestionFromMeasuredQualityType(@PathVariable Long typeId, @PathVariable Long questionId) {
        MeasuredQualityTypes measurementType = measuredQualityTypesRepository.findById(typeId).orElse(null);
        AssessmentQuestions question = assessmentQuestionRepository.findById(questionId).orElse(null);
        
        if (measurementType == null || question == null) {
            return ResponseEntity.badRequest().body("MeasuredQualityType or AssessmentQuestion not found");
        }
        
        measurementType.removeAssessmentQuestion(question);
        measuredQualityTypesRepository.save(measurementType);
        
        return ResponseEntity.ok("AssessmentQuestion successfully removed from MeasuredQualityType");
    }
    
    @GetMapping("/{typeId}/assessment-questions")
    public ResponseEntity<Set<AssessmentQuestions>> getMeasuredQualityTypeQuestions(@PathVariable Long typeId) {
        MeasuredQualityTypes measurementType = measuredQualityTypesRepository.findById(typeId).orElse(null);
        
        if (measurementType == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(measurementType.getAssessmentQuestions());
    }
    
    // One-to-Many relationship: MeasuredQualities to MeasuredQualityTypes
    @PutMapping("/{typeId}/assign-quality/{qualityId}")
    public ResponseEntity<String> assignMeasuredQualityTypeToQuality(@PathVariable Long typeId, @PathVariable Long qualityId) {
        MeasuredQualityTypes measurementType = measuredQualityTypesRepository.findById(typeId).orElse(null);
        
        if (measurementType == null) {
            return ResponseEntity.badRequest().body("MeasuredQualityType not found");
        }
        
        // Check if the quality exists
        if (!measuredQualitiesRepository.existsById(qualityId)) {
            return ResponseEntity.badRequest().body("MeasuredQuality not found");
        }
        
        // Set the foreign key
        measurementType.setFk_measured_qualities(qualityId);
        measuredQualityTypesRepository.save(measurementType);
        
        return ResponseEntity.ok("MeasuredQualityType successfully assigned to MeasuredQuality");
    }
    
    @PutMapping("/{typeId}/remove-quality")
    public ResponseEntity<String> removeMeasuredQualityTypeFromQuality(@PathVariable Long typeId) {
        MeasuredQualityTypes measurementType = measuredQualityTypesRepository.findById(typeId).orElse(null);
        
        if (measurementType == null) {
            return ResponseEntity.badRequest().body("MeasuredQualityType not found");
        }
        
        // Remove the association (set foreign key to null)
        measurementType.setFk_measured_qualities(null);
        measuredQualityTypesRepository.save(measurementType);
        
        return ResponseEntity.ok("MeasuredQualityType successfully removed from MeasuredQuality");
    }
   

}
