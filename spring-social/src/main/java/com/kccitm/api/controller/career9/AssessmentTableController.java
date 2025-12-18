package com.kccitm.api.controller.career9;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.kccitm.api.repository.Career9.AssessmentTableRepository;
// import com.kccitm.api.entity.career9.AssessmentTable;

import com.kccitm.api.model.career9.AssessmentTable;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/assessments")
public class AssessmentTableController {

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;
    
    @GetMapping("/getAll")
    public ResponseEntity<List<AssessmentTable>> getAllAssessments() {
        List<AssessmentTable> assessments = assessmentTableRepository.findAll();
        return ResponseEntity.ok(assessments);
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<AssessmentTable> getAssessmentById(@PathVariable Long id) {
        Optional<AssessmentTable> assessment = assessmentTableRepository.findById(id);
        return assessment.map(ResponseEntity::ok)
                        .orElse(ResponseEntity.notFound().build());
    }
    
    @PostMapping("/create")
    public ResponseEntity<AssessmentTable> createAssessment(@RequestBody AssessmentTable assessment) {
        AssessmentTable savedAssessment = assessmentTableRepository.save(assessment);
        return ResponseEntity.ok(savedAssessment);
    }
    
    @PutMapping("/{id}")
    public ResponseEntity<AssessmentTable> updateAssessment(@PathVariable Long id, @RequestBody AssessmentTable assessment) {
        if (!assessmentTableRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        assessment.setId(id);
        AssessmentTable updatedAssessment = assessmentTableRepository.save(assessment);
        return ResponseEntity.ok(updatedAssessment);
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAssessment(@PathVariable Long id) {
        if (!assessmentTableRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        assessmentTableRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
    
    // Get assessment by institute
    @GetMapping("/by-institute/{instituteId}")
    public ResponseEntity<AssessmentTable> getAssessmentByInstitute(@PathVariable Long instituteId) {
        Optional<AssessmentTable> assessment = assessmentTableRepository.findByInstituteId(instituteId);
        return assessment.map(ResponseEntity::ok)
                        .orElse(ResponseEntity.notFound().build());
    }
    
    // Get assessment by tool
    @GetMapping("/by-tool/{toolId}")
    public ResponseEntity<AssessmentTable> getAssessmentByTool(@PathVariable Long toolId) {
        Optional<AssessmentTable> assessment = assessmentTableRepository.findByToolId(toolId);
        return assessment.map(ResponseEntity::ok)
                        .orElse(ResponseEntity.notFound().build());
    }
}
