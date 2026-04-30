package com.kccitm.api.controller.career9.b2c;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.transaction.annotation.Transactional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.b2c.Campaign;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentMapping;
import com.kccitm.api.model.career9.b2c.ServiceDeliveryLog;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignRepository;
import com.kccitm.api.repository.Career9.b2c.ServiceDeliveryLogRepository;
import com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.service.b2c.EntitlementService;

@RestController
@RequestMapping("/entitlement")
public class EntitlementController {

    @Autowired private EntitlementService entitlementService;
    @Autowired private StudentEntitlementRepository entitlementRepository;
    @Autowired private ServiceDeliveryLogRepository serviceDeliveryLogRepository;
    @Autowired private CampaignRepository campaignRepository;
    @Autowired private CampaignAssessmentMappingRepository campaignAssessmentMappingRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StudentInfoRepository studentInfoRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    /**
     * PUBLIC: Path B step 1 — student takes the free assessment from a campaign landing page.
     * Body: { campaignId, assessmentId, name, email, phone?, dob (dd-MM-yyyy)? }
     * Creates UserStudent + StudentAssessmentMapping + pending StudentEntitlement.
     * Returns { entitlementId, accessToken, userStudentId, assessmentStartUrl } so the
     * student-facing site can deep-link into the assessment.
     */
    @PostMapping("/start-free-trial")
    @Transactional
    public ResponseEntity<?> startFreeTrial(@RequestBody Map<String, Object> body) {
        Long campaignId = body.get("campaignId") != null ? Long.valueOf(body.get("campaignId").toString()) : null;
        Long assessmentId = body.get("assessmentId") != null ? Long.valueOf(body.get("assessmentId").toString()) : null;
        String name = (String) body.get("name");
        String email = (String) body.get("email");
        String phone = (String) body.get("phone");
        String dobStr = (String) body.get("dob");

        if (campaignId == null || assessmentId == null) {
            return ResponseEntity.badRequest().body("campaignId and assessmentId are required");
        }
        if (name == null || email == null) {
            return ResponseEntity.badRequest().body("name and email are required");
        }

        Optional<Campaign> campaignOpt = campaignRepository.findById(campaignId);
        if (!campaignOpt.isPresent() || Boolean.TRUE.equals(campaignOpt.get().getIsDeleted())
                || !Boolean.TRUE.equals(campaignOpt.get().getIsActive())) {
            return ResponseEntity.badRequest().body("Campaign not found or inactive");
        }
        Optional<CampaignAssessmentMapping> mappingOpt = campaignAssessmentMappingRepository
                .findByCampaignIdAndAssessmentIdAndIsDeletedFalse(campaignId, assessmentId);
        if (!mappingOpt.isPresent()) {
            return ResponseEntity.badRequest().body("Assessment not part of this campaign");
        }

        Date dob;
        try {
            dob = dobStr != null && !dobStr.isEmpty() ? new SimpleDateFormat("dd-MM-yyyy").parse(dobStr) : new Date();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Invalid dob format. Use dd-MM-yyyy");
        }

        // Find-or-create student by email (B2C scope: no instituteCode)
        UserStudent userStudent = null;
        List<StudentInfo> existing = studentInfoRepository.findByEmail(email);
        if (existing != null && !existing.isEmpty()) {
            List<UserStudent> us = userStudentRepository.findByStudentInfoId(existing.get(0).getId());
            if (!us.isEmpty()) userStudent = us.get(0);
        }
        if (userStudent == null) {
            User user = new User((int) (Math.random() * 100000), dob);
            user.setName(name);
            user.setEmail(email);
            user.setPhone(phone);
            user = userRepository.save(user);

            StudentInfo info = new StudentInfo();
            info.setName(name);
            info.setEmail(email);
            info.setStudentDob(dob);
            info.setPhoneNumber(phone);
            info.setUser(user);
            info = studentInfoRepository.save(info);

            userStudent = new UserStudent(user, info, null);
            userStudent = userStudentRepository.save(userStudent);
        }

        // Ensure assessment mapping exists
        Optional<StudentAssessmentMapping> samOpt = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudent.getUserStudentId(), assessmentId);
        if (!samOpt.isPresent()) {
            studentAssessmentMappingRepository.save(
                    new StudentAssessmentMapping(userStudent.getUserStudentId(), assessmentId));
        }

        // Resolve path/model from mapping → campaign default
        String purchasePath = mappingOpt.get().getPurchasePath();
        if (purchasePath == null) purchasePath = campaignOpt.get().getDefaultPurchasePath();
        if (purchasePath == null) purchasePath = "B";
        String counsellingModel = mappingOpt.get().getCounsellingModel();
        if (counsellingModel == null) counsellingModel = campaignOpt.get().getDefaultCounsellingModel();
        if (counsellingModel == null) counsellingModel = "1";

        StudentEntitlement entitlement = entitlementService.createPending(
                userStudent.getUserStudentId(), campaignId, assessmentId, purchasePath, counsellingModel);

        Map<String, Object> response = new HashMap<>();
        response.put("entitlementId", entitlement.getEntitlementId());
        response.put("userStudentId", userStudent.getUserStudentId());
        response.put("campaignId", campaignId);
        response.put("assessmentId", assessmentId);
        response.put("purchasePath", purchasePath);
        response.put("counsellingModel", counsellingModel);
        return ResponseEntity.ok(response);
    }

    /**
     * Public endpoint — student lands on /assessment/start?t=...&e=...; SPA calls this to validate
     * before letting them in. Returns the entitlement if the token is good, 404 otherwise.
     * NOTE: this endpoint does NOT issue a JWT yet — that's a follow-up integrated with the
     * existing JWT pipeline. The SPA can use the entitlement reference to short-circuit the
     * assessment-start flow with the resolved userStudentId.
     */
    @PostMapping("/redeem-token")
    public ResponseEntity<?> redeemToken(@RequestBody Map<String, Object> body) {
        String token = body.get("token") != null ? body.get("token").toString() : null;
        Long entitlementId = body.get("entitlementId") != null
                ? Long.valueOf(body.get("entitlementId").toString()) : null;
        StudentEntitlement e = entitlementService.redeemAccessToken(token, entitlementId);
        if (e == null) return ResponseEntity.status(404).body("Invalid or expired token");
        Map<String, Object> response = new HashMap<>();
        response.put("entitlementId", e.getEntitlementId());
        response.put("userStudentId", e.getUserStudentId());
        response.put("assessmentId", e.getAssessmentId());
        response.put("campaignId", e.getCampaignId());
        response.put("status", e.getStatus());
        response.put("purchasePath", e.getPurchasePath());
        response.put("counsellingModel", e.getCounsellingModel());
        response.put("dashboardActive", e.getDashboardActive());
        response.put("counsellingActive", e.getCounsellingActive());
        response.put("lmsActive", e.getLmsActive());
        response.put("finalReportActive", e.getFinalReportActive());
        response.put("expiresAt", e.getExpiresAt());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        Optional<StudentEntitlement> opt = entitlementRepository.findById(id);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(opt.get());
    }

    @GetMapping("/{id}/communications")
    public ResponseEntity<List<ServiceDeliveryLog>> getCommunications(@PathVariable Long id) {
        return ResponseEntity.ok(serviceDeliveryLogRepository.findByEntitlementIdOrderByCreatedAtDesc(id));
    }

    @PostMapping("/{id}/resend/{serviceType}")
    public ResponseEntity<?> resend(@PathVariable Long id,
                                    @PathVariable String serviceType,
                                    @RequestBody(required = false) Map<String, Object> body) {
        Optional<StudentEntitlement> opt = entitlementRepository.findById(id);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        String recipient = body != null && body.get("recipient") != null
                ? body.get("recipient").toString() : null;
        if (recipient == null || recipient.isEmpty()) {
            return ResponseEntity.badRequest().body("recipient email is required");
        }
        EntitlementService.ResendResult r = entitlementService.resendServiceLink(id, serviceType, recipient);
        if (!r.ok) return ResponseEntity.badRequest().body(r.message);
        return ResponseEntity.ok(Map.of("status", "sent"));
    }

    @PostMapping("/{id}/extend")
    public ResponseEntity<?> extend(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        if (body.get("newExpiresAt") == null) {
            return ResponseEntity.badRequest().body("newExpiresAt (dd-MM-yyyy) is required");
        }
        Date newExpiresAt;
        try {
            newExpiresAt = new SimpleDateFormat("dd-MM-yyyy").parse(body.get("newExpiresAt").toString());
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body("Use dd-MM-yyyy format");
        }
        StudentEntitlement e = entitlementService.extendExpiry(id, newExpiresAt);
        if (e == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(e);
    }

    @PostMapping("/{id}/revoke")
    public ResponseEntity<?> revoke(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body) {
        String reason = body != null && body.get("reason") != null ? body.get("reason").toString() : "manual";
        StudentEntitlement e = entitlementService.revoke(id, reason);
        if (e == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(e);
    }
}
