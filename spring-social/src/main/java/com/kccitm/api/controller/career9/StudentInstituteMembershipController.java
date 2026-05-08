package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.UserStudentInstituteHistory;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.Career9.UserStudentInstituteHistoryRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.service.b2c.StudentInstituteMembershipService;

/**
 * Admin endpoints for managing the many-to-many relationship between students
 * and institutes. The student's primary institute lives on user_student;
 * additional memberships and per-institute drops live in
 * user_student_institute_history.
 */
@RestController
public class StudentInstituteMembershipController {

    @Autowired private StudentInstituteMembershipService membershipService;
    @Autowired private UserStudentInstituteHistoryRepository historyRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private InstituteDetailRepository instituteDetailRepository;

    /** Lists every institute this student is or was associated with, plus drop state. */
    @GetMapping("/user-student/{id}/institutes")
    public ResponseEntity<?> listMemberships(@PathVariable Long id) {
        Optional<UserStudent> usOpt = userStudentRepository.findById(id);
        if (!usOpt.isPresent()) return ResponseEntity.notFound().build();
        UserStudent us = usOpt.get();
        Integer primaryCode = us.getInstitute() != null ? us.getInstitute().getInstituteCode() : null;

        List<UserStudentInstituteHistory> rows = historyRepository.findByUserStudentIdOrderByAddedAtDesc(id);
        List<Map<String, Object>> out = new ArrayList<>();
        for (UserStudentInstituteHistory r : rows) {
            Map<String, Object> dto = new HashMap<>();
            dto.put("instituteCode", r.getInstituteCode());
            InstituteDetail inst = instituteDetailRepository.findById(r.getInstituteCode().intValue());
            dto.put("instituteName", inst != null ? inst.getInstituteName() : null);
            dto.put("campaignId", r.getCampaignId());
            dto.put("source", r.getSource());
            dto.put("addedAt", r.getAddedAt());
            dto.put("isDropped", r.getIsDropped());
            dto.put("droppedAt", r.getDroppedAt());
            dto.put("droppedReason", r.getDroppedReason());
            dto.put("isPrimary", primaryCode != null && primaryCode.equals(r.getInstituteCode()));
            out.add(dto);
        }
        return ResponseEntity.ok(out);
    }

    /** Adds a new membership row (un-dropped) for a student. Source = 'admin-add'. */
    @PostMapping("/user-student/{id}/institute")
    public ResponseEntity<?> addMembership(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Integer instituteCode = toInt(body.get("instituteCode"));
        if (instituteCode == null) return ResponseEntity.badRequest().body("instituteCode is required");
        if (!userStudentRepository.findById(id).isPresent()) return ResponseEntity.notFound().build();
        if (instituteDetailRepository.findById(instituteCode.intValue()) == null) {
            return ResponseEntity.badRequest().body("Institute does not exist");
        }
        UserStudentInstituteHistory row = membershipService.upsertMembership(
                id, instituteCode, null, "admin-add");
        return ResponseEntity.ok(row);
    }

    @PostMapping("/user-student/{id}/institute/{instituteCode}/drop")
    public ResponseEntity<?> drop(@PathVariable Long id,
                                  @PathVariable Integer instituteCode,
                                  @RequestBody(required = false) Map<String, Object> body) {
        String reason = body != null && body.get("reason") != null ? body.get("reason").toString() : null;
        try {
            return ResponseEntity.ok(membershipService.dropMembership(id, instituteCode, reason));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    @PostMapping("/user-student/{id}/institute/{instituteCode}/undrop")
    public ResponseEntity<?> undrop(@PathVariable Long id, @PathVariable Integer instituteCode) {
        try {
            return ResponseEntity.ok(membershipService.undropMembership(id, instituteCode));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    @PostMapping("/user-student/{id}/institute/{instituteCode}/set-primary")
    public ResponseEntity<?> setPrimary(@PathVariable Long id, @PathVariable Integer instituteCode) {
        try {
            membershipService.setPrimary(id, instituteCode);
            return ResponseEntity.ok(Map.of("status", "ok"));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    /**
     * Institute-side view: every student associated with an institute, with
     * drop state. Filtering by includeDropped lets the admin show or hide
     * dropped memberships.
     */
    @GetMapping("/institute-detail/{instituteCode}/students")
    public ResponseEntity<?> studentsForInstitute(@PathVariable Integer instituteCode,
                                                  @RequestParam(defaultValue = "false") boolean includeDropped) {
        List<UserStudentInstituteHistory> rows = includeDropped
                ? historyRepository.findByInstituteCode(instituteCode)
                : historyRepository.findByInstituteCodeAndIsDroppedFalse(instituteCode);

        List<Map<String, Object>> out = new ArrayList<>();
        for (UserStudentInstituteHistory r : rows) {
            Map<String, Object> dto = new HashMap<>();
            dto.put("userStudentId", r.getUserStudentId());
            Optional<UserStudent> usOpt = userStudentRepository.findById(r.getUserStudentId());
            if (usOpt.isPresent()) {
                StudentInfo si = usOpt.get().getStudentInfo();
                if (si != null) {
                    dto.put("name", si.getName());
                    dto.put("email", si.getEmail());
                    dto.put("phone", si.getPhoneNumber());
                }
                Integer primaryCode = usOpt.get().getInstitute() != null
                        ? usOpt.get().getInstitute().getInstituteCode() : null;
                dto.put("isPrimary", primaryCode != null && primaryCode.equals(instituteCode));
            }
            dto.put("source", r.getSource());
            dto.put("addedAt", r.getAddedAt());
            dto.put("isDropped", r.getIsDropped());
            dto.put("droppedAt", r.getDroppedAt());
            out.add(dto);
        }
        return ResponseEntity.ok(out);
    }

    private static Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.parseInt(o.toString()); } catch (NumberFormatException e) { return null; }
    }
}
