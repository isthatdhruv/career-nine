package com.kccitm.api.controller.career9.counselling;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellorAssessmentAssignment;
import com.kccitm.api.repository.Career9.counselling.CounsellorAssessmentAssignmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;

/**
 * Counselling Phase 4 — admin CRUD for assigning counsellors to assessments.
 * Counsellors create their own slots; admins decide which counsellor handles which
 * assessment. The booking flow ({@code /counselling/slots}) filters offered slots to
 * the counsellors assigned to the student's assessment.
 */
@RestController
@RequestMapping("/api/counsellor-assessment")
public class CounsellorAssessmentAssignmentController {

    private static final Logger logger = LoggerFactory.getLogger(CounsellorAssessmentAssignmentController.class);

    @Autowired
    private CounsellorAssessmentAssignmentRepository assignmentRepository;

    @Autowired
    private CounsellorRepository counsellorRepository;

    @PreAuthorize("@auth.allows('counsellor.read')")
    @GetMapping("/by-assessment/{assessmentId}")
    public ResponseEntity<List<CounsellorAssessmentAssignment>> byAssessment(@PathVariable Long assessmentId) {
        return ResponseEntity.ok(assignmentRepository.findByAssessmentId(assessmentId));
    }

    @PreAuthorize("@auth.allows('counsellor.read')")
    @GetMapping("/by-counsellor/{counsellorId}")
    public ResponseEntity<List<CounsellorAssessmentAssignment>> byCounsellor(@PathVariable Long counsellorId) {
        return ResponseEntity.ok(assignmentRepository.findByCounsellorId(counsellorId));
    }

    /**
     * Assign a counsellor to an assessment. Idempotent: if the pair already exists it is
     * re-activated rather than duplicated (the unique constraint would otherwise reject it).
     * Body: { counsellorId, assessmentId, assignedBy? }
     */
    @PreAuthorize("@auth.allows('counsellor.update')")
    @PostMapping("/assign")
    public ResponseEntity<?> assign(@RequestBody Map<String, Object> body) {
        Long counsellorId = toLong(body.get("counsellorId"));
        Long assessmentId = toLong(body.get("assessmentId"));
        Long assignedBy = toLong(body.get("assignedBy"));
        if (counsellorId == null || assessmentId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "counsellorId and assessmentId are required"));
        }
        Optional<Counsellor> cOpt = counsellorRepository.findById(counsellorId);
        if (!cOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Counsellor not found"));
        }

        // Reactivate an existing (possibly deactivated) pair instead of duplicating it.
        CounsellorAssessmentAssignment existing = assignmentRepository.findByAssessmentId(assessmentId).stream()
                .filter(a -> a.getCounsellor() != null && counsellorId.equals(a.getCounsellor().getId()))
                .findFirst().orElse(null);
        if (existing != null) {
            existing.setIsActive(true);
            return ResponseEntity.ok(assignmentRepository.save(existing));
        }

        CounsellorAssessmentAssignment a = new CounsellorAssessmentAssignment();
        a.setCounsellor(cOpt.get());
        a.setAssessmentId(assessmentId);
        a.setIsActive(true);
        a.setAssignedBy(assignedBy);
        CounsellorAssessmentAssignment saved = assignmentRepository.save(a);
        logger.info("Assigned counsellor {} to assessment {}", counsellorId, assessmentId);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PreAuthorize("@auth.allows('counsellor.update')")
    @PutMapping("/toggle/{id}")
    public ResponseEntity<?> toggle(@PathVariable Long id) {
        Optional<CounsellorAssessmentAssignment> opt = assignmentRepository.findById(id);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        CounsellorAssessmentAssignment a = opt.get();
        a.setIsActive(!Boolean.TRUE.equals(a.getIsActive()));
        return ResponseEntity.ok(assignmentRepository.save(a));
    }

    @PreAuthorize("@auth.allows('counsellor.update')")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!assignmentRepository.existsById(id)) return ResponseEntity.notFound().build();
        assignmentRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("deleted", id));
    }

    private static Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).longValue();
        try { return Long.valueOf(o.toString()); } catch (NumberFormatException e) { return null; }
    }
}
