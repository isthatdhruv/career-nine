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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.Lead;
import com.kccitm.api.model.career9.LeadType;
import com.kccitm.api.model.career9.OdooSyncStatus;
import com.kccitm.api.repository.Career9.LeadRepository;
import com.kccitm.api.service.OdooLeadService;
import com.kccitm.api.service.SmtpEmailService;

@RestController
@RequestMapping("/leads")
public class LeadController {

    private static final Logger logger = LoggerFactory.getLogger(LeadController.class);

    @Autowired
    private LeadRepository leadRepository;

    @Autowired
    private OdooLeadService odooLeadService;

    @Autowired
    private SmtpEmailService gmailApiEmailService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * PUBLIC endpoint — accepts lead form submissions from external landing pages.
     */
    // @CrossOrigin(origins = "*", maxAge = 3600)
    @PostMapping("/capture")
    public ResponseEntity<?> captureLead(@RequestBody Map<String, Object> payload) {
        try {
            String fullName = (String) payload.get("fullName");
            String email = (String) payload.get("email");
            String phone = (String) payload.get("phone");
            String leadTypeStr = (String) payload.get("leadType");
            String source = (String) payload.get("source");
            String designation = (String) payload.get("designation");
            String schoolName = (String) payload.get("schoolName");
            String city = (String) payload.get("city");
            String cbseAffiliationNo = (String) payload.get("cbseAffiliationNo");
            String totalStudents = (String) payload.get("totalStudents");
            String classesOffered = (String) payload.get("classesOffered");

            if (fullName == null || fullName.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "fullName is required"));
            }
            if (email == null || email.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "email is required"));
            }
            if (leadTypeStr == null || leadTypeStr.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "leadType is required (SCHOOL, PARENT, or STUDENT)"));
            }

            LeadType leadType;
            try {
                leadType = LeadType.valueOf(leadTypeStr.toUpperCase());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(
                        Map.of("error", "Invalid leadType. Must be one of: SCHOOL, PARENT, STUDENT"));
            }

            // Remaining fields go to extras JSON
            Map<String, Object> extras = new HashMap<>(payload);
            extras.remove("fullName");
            extras.remove("email");
            extras.remove("phone");
            extras.remove("leadType");
            extras.remove("source");
            extras.remove("designation");
            extras.remove("schoolName");
            extras.remove("city");
            extras.remove("cbseAffiliationNo");
            extras.remove("totalStudents");
            extras.remove("classesOffered");

            String extrasJson = extras.isEmpty() ? null : objectMapper.writeValueAsString(extras);

            Lead lead = new Lead();
            lead.setFullName(fullName.trim());
            lead.setEmail(email.trim());
            lead.setPhone(phone != null ? phone.trim() : null);
            lead.setLeadType(leadType);
            lead.setSource(source != null ? source.trim() : null);
            lead.setDesignation(designation != null ? designation.trim() : null);
            lead.setSchoolName(schoolName != null ? schoolName.trim() : null);
            lead.setCity(city != null ? city.trim() : null);
            lead.setCbseAffiliationNo(cbseAffiliationNo != null ? cbseAffiliationNo.trim() : null);
            lead.setTotalStudents(totalStudents != null ? totalStudents.trim() : null);
            lead.setClassesOffered(classesOffered != null ? classesOffered.trim() : null);
            lead.setExtras(extrasJson);
            lead.setOdooSyncStatus(OdooSyncStatus.PENDING);

            Lead savedLead = leadRepository.save(lead);

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

    /**
     * Email leads export as attachment using Gmail API.
     * Accepts multipart: to (comma-separated emails), subject, body, file (Excel).
     */
    @PostMapping("/email-export")
    public ResponseEntity<?> emailExport(
            @RequestParam("to") String to,
            @RequestParam("subject") String subject,
            @RequestParam("body") String body,
            @RequestParam("file") MultipartFile file) {
        try {
            byte[] fileBytes = file.getBytes();
            String fileName = file.getOriginalFilename();
            String contentType = file.getContentType();

            // Send to each recipient synchronously
            for (String email : to.split(",")) {
                String trimmed = email.trim();
                if (!trimmed.isEmpty()) {
                    gmailApiEmailService.sendEmailWithAttachment(
                            trimmed, subject, body, fileName, fileBytes, contentType);
                }
            }

            logger.info("Leads email sent via Gmail API to {}", to);
            return ResponseEntity.ok(Map.of("status", "success", "message", "Email sent successfully"));

        } catch (Exception e) {
            logger.error("Error sending leads email: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", "Failed to send email: " + e.getMessage()));
        }
    }
}
