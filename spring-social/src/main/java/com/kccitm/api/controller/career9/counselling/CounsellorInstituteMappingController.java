package com.kccitm.api.controller.career9.counselling;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.counselling.CounsellorInstituteMapping;
import com.kccitm.api.service.counselling.CounsellorInstituteMappingService;

/**
 * Admin endpoints for managing counsellor-to-institute allocations.
 *
 * POST   /allocate              — Allocate a counsellor to an institute
 * DELETE /deallocate/{id}       — Deactivate a mapping
 * GET    /getAll                — List all mappings
 * GET    /by-institute/{code}   — Counsellors for an institute
 * GET    /by-counsellor/{id}    — Institutes for a counsellor
 */
@RestController
@RequestMapping("/api/counsellor-institute")
public class CounsellorInstituteMappingController {

    private static final Logger logger = LoggerFactory.getLogger(CounsellorInstituteMappingController.class);

    @Autowired
    private CounsellorInstituteMappingService mappingService;

    /**
     * POST /api/counsellor-institute/allocate
     * Body: { counsellorId, instituteCode, assignedBy, notes? }
     */
    @PostMapping("/allocate")
    public ResponseEntity<?> allocate(@RequestBody Map<String, Object> body) {
        Long counsellorId = ((Number) body.get("counsellorId")).longValue();
        Integer instituteCode = ((Number) body.get("instituteCode")).intValue();
        Long assignedBy = body.get("assignedBy") != null ? ((Number) body.get("assignedBy")).longValue() : null;
        String notes = (String) body.get("notes");

        try {
            CounsellorInstituteMapping mapping = mappingService.allocate(counsellorId, instituteCode, assignedBy, notes);
            return ResponseEntity.status(HttpStatus.CREATED).body(mapping);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * DELETE /api/counsellor-institute/deallocate/{id}
     */
    @DeleteMapping("/deallocate/{id}")
    public ResponseEntity<?> deallocate(@PathVariable Long id) {
        try {
            CounsellorInstituteMapping mapping = mappingService.deallocate(id);
            return ResponseEntity.ok(mapping);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * GET /api/counsellor-institute/getAll
     */
    @GetMapping("/getAll")
    public ResponseEntity<List<CounsellorInstituteMapping>> getAll() {
        return ResponseEntity.ok(mappingService.getAll());
    }

    /**
     * GET /api/counsellor-institute/by-institute/{instituteCode}
     */
    @GetMapping("/by-institute/{instituteCode}")
    public ResponseEntity<List<CounsellorInstituteMapping>> getByInstitute(@PathVariable Integer instituteCode) {
        return ResponseEntity.ok(mappingService.getCounsellorsForInstitute(instituteCode));
    }

    /**
     * GET /api/counsellor-institute/by-counsellor/{counsellorId}
     */
    @GetMapping("/by-counsellor/{counsellorId}")
    public ResponseEntity<List<CounsellorInstituteMapping>> getByCounsellor(@PathVariable Long counsellorId) {
        return ResponseEntity.ok(mappingService.getInstitutesForCounsellor(counsellorId));
    }
}
