package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.AssessmentDemographicMapping;
import com.kccitm.api.model.career9.DemographicFieldDefinition;
import com.kccitm.api.repository.Career9.AssessmentDemographicMappingRepository;
import com.kccitm.api.repository.Career9.DemographicFieldDefinitionRepository;

@RestController
@RequestMapping("/assessment-demographics")
public class AssessmentDemographicMappingController {

    @Autowired
    private AssessmentDemographicMappingRepository mappingRepository;

    @Autowired
    private DemographicFieldDefinitionRepository fieldDefinitionRepository;

    @GetMapping("/getByAssessment/{assessmentId}")
    public List<AssessmentDemographicMapping> getByAssessment(@PathVariable Long assessmentId) {
        return mappingRepository.findByAssessmentIdOrderByDisplayOrderAsc(assessmentId);
    }

    @PostMapping("/save")
    @Transactional
    public ResponseEntity<?> save(@RequestBody Map<String, Object> request) {
        try {
            Long assessmentId = Long.valueOf(request.get("assessmentId").toString());

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> fields = (List<Map<String, Object>>) request.get("fields");

            // Delete existing mappings for this assessment
            mappingRepository.deleteByAssessmentId(assessmentId);

            // Create new mappings
            List<AssessmentDemographicMapping> savedMappings = new ArrayList<>();
            if (fields != null) {
                for (Map<String, Object> fieldMap : fields) {
                    Long fieldId = Long.valueOf(fieldMap.get("fieldId").toString());
                    DemographicFieldDefinition fieldDef = fieldDefinitionRepository.findById(fieldId)
                            .orElse(null);

                    if (fieldDef == null) continue;

                    AssessmentDemographicMapping mapping = new AssessmentDemographicMapping();
                    mapping.setAssessmentId(assessmentId);
                    mapping.setFieldDefinition(fieldDef);
                    mapping.setIsMandatory(
                            fieldMap.get("isMandatory") != null
                                    ? Boolean.valueOf(fieldMap.get("isMandatory").toString())
                                    : true);
                    mapping.setDisplayOrder(
                            fieldMap.get("displayOrder") != null
                                    ? Integer.valueOf(fieldMap.get("displayOrder").toString())
                                    : 0);
                    mapping.setCustomLabel(
                            fieldMap.get("customLabel") != null
                                    ? fieldMap.get("customLabel").toString()
                                    : null);

                    savedMappings.add(mappingRepository.save(mapping));
                }
            }

            return ResponseEntity.ok(savedMappings);
        } catch (Exception e) {
            System.err.println("Error saving demographic mappings: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body("Failed to save demographic mappings: " + e.getMessage());
        }
    }

    @DeleteMapping("/remove/{assessmentId}/{fieldId}")
    @Transactional
    public ResponseEntity<String> remove(@PathVariable Long assessmentId, @PathVariable Long fieldId) {
        mappingRepository.deleteByAssessmentIdAndFieldDefinitionFieldId(assessmentId, fieldId);
        return ResponseEntity.ok("Mapping removed successfully");
    }
}
