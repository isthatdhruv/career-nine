package com.kccitm.api.controller.career9.counselling;

import java.util.ArrayList;
import java.util.HashMap;
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
import com.kccitm.api.model.career9.counselling.CounsellingRequest;
import com.kccitm.api.model.career9.counselling.CounsellorAssessmentAssignment;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingRequestRepository;
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

    @Autowired(required = false)
    private CounsellingRequestRepository counsellingRequestRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

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
     * Assignment rows for a counsellor enriched with the assessment name — the
     * counsellor portal dashboard lists "assessments I counsel for", and the raw
     * assignment rows only carry the assessment id.
     */
    @PreAuthorize("@auth.allows('counsellor.read')")
    @GetMapping("/by-counsellor/{counsellorId}/detailed")
    public ResponseEntity<List<Map<String, Object>>> byCounsellorDetailed(@PathVariable Long counsellorId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (CounsellorAssessmentAssignment a : assignmentRepository.findByCounsellorId(counsellorId)) {
            Map<String, Object> row = new HashMap<>();
            row.put("id", a.getId());
            row.put("assessmentId", a.getAssessmentId());
            row.put("isActive", a.getIsActive());
            assessmentTableRepository.findById(a.getAssessmentId())
                    .ifPresent(t -> row.put("assessmentName", t.getAssessmentName()));
            out.add(row);
        }
        return ResponseEntity.ok(out);
    }

    /**
     * Assessment ids that have counselling toggled on in at least one active tier
     * (B2B mapping tier, school tier, or B2C campaign pricing tier). The assignment
     * page uses this to only offer assessments where counselling is actually part of
     * the package — assigning a counsellor to any other assessment would be a no-op
     * for students.
     */
    @PreAuthorize("@auth.allows('counsellor.read')")
    @GetMapping("/counselling-enabled-assessments")
    public ResponseEntity<List<Long>> counsellingEnabledAssessments() {
        return ResponseEntity.ok(assignmentRepository.findCounsellingEnabledAssessmentIds());
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
            CounsellorAssessmentAssignment saved = assignmentRepository.save(existing);
            closePendingRequests(assessmentId);
            return ResponseEntity.ok(saved);
        }

        CounsellorAssessmentAssignment a = new CounsellorAssessmentAssignment();
        a.setCounsellor(cOpt.get());
        a.setAssessmentId(assessmentId);
        a.setIsActive(true);
        a.setAssignedBy(assignedBy);
        CounsellorAssessmentAssignment saved = assignmentRepository.save(a);
        logger.info("Assigned counsellor {} to assessment {}", counsellorId, assessmentId);
        closePendingRequests(assessmentId);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /**
     * A counsellor is now mapped to this assessment, so any students who'd been
     * "forwarded to Career-9" waiting on one can book. Flip their PENDING requests
     * to ASSIGNED so they drop off the admin's pending list.
     */
    private void closePendingRequests(Long assessmentId) {
        if (counsellingRequestRepository == null) return;
        for (CounsellingRequest cr : counsellingRequestRepository.findByAssessmentIdAndStatus(assessmentId, "PENDING")) {
            cr.setStatus("ASSIGNED");
            counsellingRequestRepository.save(cr);
        }
    }

    /**
     * Students waiting on a counsellor — assessments that have counselling in the
     * package but no counsellor mapped yet. Lets the admin see who to assign for.
     */
    @PreAuthorize("@auth.allows('counsellor.read')")
    @GetMapping("/pending-requests")
    public ResponseEntity<List<Map<String, Object>>> pendingRequests() {
        List<Map<String, Object>> out = new ArrayList<>();
        if (counsellingRequestRepository == null) return ResponseEntity.ok(out);
        for (CounsellingRequest r : counsellingRequestRepository.findByStatusOrderByCreatedAtDesc("PENDING")) {
            Map<String, Object> row = new HashMap<>();
            row.put("id", r.getId());
            row.put("userStudentId", r.getUserStudentId());
            row.put("assessmentId", r.getAssessmentId());
            row.put("instituteCode", r.getInstituteCode());
            row.put("createdAt", r.getCreatedAt());
            assessmentTableRepository.findById(r.getAssessmentId())
                    .ifPresent(a -> row.put("assessmentName", a.getAssessmentName()));
            userStudentRepository.findById(r.getUserStudentId()).ifPresent(us -> {
                if (us.getStudentInfo() != null) {
                    row.put("studentName", us.getStudentInfo().getName());
                    row.put("studentEmail", us.getStudentInfo().getEmail());
                    row.put("studentPhone", us.getStudentInfo().getPhoneNumber());
                }
                if (us.getInstitute() != null) {
                    row.put("instituteName", us.getInstitute().getInstituteName());
                }
            });
            out.add(row);
        }
        return ResponseEntity.ok(out);
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
