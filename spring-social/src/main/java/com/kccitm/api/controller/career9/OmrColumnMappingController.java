package com.kccitm.api.controller.career9;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.kccitm.api.model.career9.OmrColumnMapping;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.repository.Career9.OmrColumnMappingRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;

@RestController
@RequestMapping("/omr-column-mapping")
public class OmrColumnMappingController {

    @Autowired
    private OmrColumnMappingRepository repository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @GetMapping("/getAll")
    public ResponseEntity<?> getAllMappings() {
        List<OmrColumnMapping> mappings = repository.findAll();
        List<Map<String, Object>> result = new java.util.ArrayList<>();

        for (OmrColumnMapping m : mappings) {
            Map<String, Object> item = new java.util.HashMap<>();
            item.put("id", m.getId());
            item.put("assessmentId", m.getAssessmentId());
            item.put("instituteId", m.getInstituteId());
            item.put("questionnaireId", m.getQuestionnaireId());
            item.put("mappingName", m.getMappingName());
            item.put("createdAt", m.getCreatedAt());
            item.put("updatedAt", m.getUpdatedAt());

            // Resolve assessment name and questionnaire name
            try {
                Optional<AssessmentTable> assessment = assessmentTableRepository.findById(m.getAssessmentId());
                if (assessment.isPresent()) {
                    item.put("assessmentName", assessment.get().getAssessmentName());
                    if (assessment.get().getQuestionnaire() != null) {
                        item.put("questionnaireName", assessment.get().getQuestionnaire().getName());
                    }
                }
            } catch (Exception e) {
                // ignore
            }

            // Count mapped fields from JSON
            try {
                com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
                Map<String, String> parsed = om.readValue(m.getMappingJson(), Map.class);
                item.put("mappedFieldsCount", parsed.size());
            } catch (Exception e) {
                item.put("mappedFieldsCount", 0);
            }

            result.add(item);
        }

        return ResponseEntity.ok(result);
    }

    @GetMapping("/get/{assessmentId}/{instituteId}")
    public ResponseEntity<?> getMapping(
            @PathVariable Long assessmentId,
            @PathVariable Long instituteId) {
        Optional<OmrColumnMapping> mapping = repository.findByAssessmentIdAndInstituteId(assessmentId, instituteId);
        if (mapping.isPresent()) {
            return ResponseEntity.ok(mapping.get());
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/get-by-assessment/{assessmentId}")
    public ResponseEntity<List<OmrColumnMapping>> getByAssessment(@PathVariable Long assessmentId) {
        return ResponseEntity.ok(repository.findByAssessmentId(assessmentId));
    }

    @GetMapping("/get-by-questionnaire/{questionnaireId}")
    public ResponseEntity<?> getByQuestionnaire(@PathVariable Long questionnaireId) {
        Optional<OmrColumnMapping> mapping = repository.findFirstByQuestionnaireIdOrderByUpdatedAtDesc(questionnaireId);
        if (mapping.isPresent()) {
            return ResponseEntity.ok(mapping.get());
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/save")
    public ResponseEntity<?> saveMapping(@RequestBody Map<String, Object> body) {
        Long assessmentId = Long.valueOf(body.get("assessmentId").toString());
        Long instituteId = Long.valueOf(body.get("instituteId").toString());
        String mappingJson = body.get("mappingJson").toString();
        String mappingName = body.containsKey("mappingName") ? body.get("mappingName").toString() : null;
        Long questionnaireId = body.containsKey("questionnaireId") ? Long.valueOf(body.get("questionnaireId").toString()) : null;

        String now = LocalDateTime.now().toString();

        Optional<OmrColumnMapping> existing = repository.findByAssessmentIdAndInstituteId(assessmentId, instituteId);

        OmrColumnMapping mapping;
        if (existing.isPresent()) {
            mapping = existing.get();
            mapping.setMappingJson(mappingJson);
            mapping.setUpdatedAt(now);
            if (mappingName != null) mapping.setMappingName(mappingName);
            if (questionnaireId != null) mapping.setQuestionnaireId(questionnaireId);
        } else {
            mapping = new OmrColumnMapping(assessmentId, instituteId, mappingName, mappingJson);
            mapping.setQuestionnaireId(questionnaireId);
            mapping.setCreatedAt(now);
            mapping.setUpdatedAt(now);
        }

        OmrColumnMapping saved = repository.save(mapping);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> deleteMapping(@PathVariable Long id) {
        repository.deleteById(id);
        return ResponseEntity.ok().build();
    }
}
