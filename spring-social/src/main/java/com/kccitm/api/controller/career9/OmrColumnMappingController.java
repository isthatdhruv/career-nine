package com.kccitm.api.controller.career9;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.kccitm.api.model.career9.OmrColumnMapping;
import com.kccitm.api.repository.Career9.OmrColumnMappingRepository;

@RestController
@RequestMapping("/omr-column-mapping")
public class OmrColumnMappingController {

    @Autowired
    private OmrColumnMappingRepository repository;

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

    @PostMapping("/save")
    public ResponseEntity<?> saveMapping(@RequestBody Map<String, Object> body) {
        Long assessmentId = Long.valueOf(body.get("assessmentId").toString());
        Long instituteId = Long.valueOf(body.get("instituteId").toString());
        String mappingJson = body.get("mappingJson").toString();
        String mappingName = body.containsKey("mappingName") ? body.get("mappingName").toString() : null;

        String now = LocalDateTime.now().toString();

        Optional<OmrColumnMapping> existing = repository.findByAssessmentIdAndInstituteId(assessmentId, instituteId);

        OmrColumnMapping mapping;
        if (existing.isPresent()) {
            mapping = existing.get();
            mapping.setMappingJson(mappingJson);
            mapping.setUpdatedAt(now);
            if (mappingName != null) mapping.setMappingName(mappingName);
        } else {
            mapping = new OmrColumnMapping(assessmentId, instituteId, mappingName, mappingJson);
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
