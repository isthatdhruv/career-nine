package com.kccitm.api.controller.career9;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.Lead;
import com.kccitm.api.model.career9.LeadType;
import com.kccitm.api.model.career9.OdooSyncStatus;
import com.kccitm.api.repository.Career9.LeadRepository;
import com.kccitm.api.service.OdooLeadService;

@RestController
@RequestMapping("/leads")
public class LeadController {

    private static final Logger logger = LoggerFactory.getLogger(LeadController.class);

    @Autowired
    private LeadRepository leadRepository;

    @Autowired
    private OdooLeadService odooLeadService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * PUBLIC endpoint — accepts lead form submissions from external landing pages.
     * Flat JSON body: core fields (fullName, email, phone, leadType, source) +
     * any extra fields which get stored in the extras JSON column.
     */
    // @CrossOrigin(origins = "*", maxAge = 3600)
    @PostMapping("/capture")
    public ResponseEntity<?> captureLead(@RequestBody Map<String, Object> payload) {
        try {
            // Extract core fields
            String fullName = (String) payload.get("fullName");
            String email = (String) payload.get("email");
            String phone = (String) payload.get("phone");
            String leadTypeStr = (String) payload.get("leadType");
            String source = (String) payload.get("source");

            // Validate required fields
            if (fullName == null || fullName.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "fullName is required"));
            }
            if (email == null || email.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "email is required"));
            }
            if (leadTypeStr == null || leadTypeStr.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "leadType is required (SCHOOL, PARENT, or STUDENT)"));
            }

            // Parse lead type
            LeadType leadType;
            try {
                leadType = LeadType.valueOf(leadTypeStr.toUpperCase());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(
                        Map.of("error", "Invalid leadType. Must be one of: SCHOOL, PARENT, STUDENT"));
            }

            // Build extras JSON from remaining fields
            Map<String, Object> extras = new HashMap<>(payload);
            extras.remove("fullName");
            extras.remove("email");
            extras.remove("phone");
            extras.remove("leadType");
            extras.remove("source");

            String extrasJson = extras.isEmpty() ? null : objectMapper.writeValueAsString(extras);

            // Build and save the Lead entity
            Lead lead = new Lead();
            lead.setFullName(fullName.trim());
            lead.setEmail(email.trim());
            lead.setPhone(phone != null ? phone.trim() : null);
            lead.setLeadType(leadType);
            lead.setSource(source != null ? source.trim() : null);
            lead.setExtras(extrasJson);
            lead.setOdooSyncStatus(OdooSyncStatus.PENDING);

            Lead savedLead = leadRepository.save(lead);

            // Fire-and-forget Odoo sync (runs on @Async thread)
            odooLeadService.syncLeadToOdoo(savedLead);

            logger.info("Lead captured: id={}, type={}, email={}", savedLead.getId(), leadType, email);

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "status", "success",
                    "leadId", savedLead.getId(),
                    "message", "Lead captured successfully"
            ));

        } catch (Exception e) {
            logger.error("Error capturing lead: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error processing lead submission"));
        }
    }

    @GetMapping("/getAll")
    public List<Lead> getAllLeads() {
        return leadRepository.findAll();
    }
}
