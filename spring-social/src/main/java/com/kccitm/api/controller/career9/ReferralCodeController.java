package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.AssessmentInstituteMapping;
import com.kccitm.api.model.career9.ReferralCode;
import com.kccitm.api.model.career9.ReferralCodeAssessment;
import com.kccitm.api.model.career9.StudentReferral;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.Career9.AssessmentInstituteMappingRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.ReferralCodeAssessmentRepository;
import com.kccitm.api.repository.Career9.ReferralCodeRepository;
import com.kccitm.api.repository.Career9.StudentReferralRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.security.CurrentScopes;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.career9.ReferralService;

@RestController
@RequestMapping("/referral-codes")
public class ReferralCodeController {

    @Autowired private ReferralCodeRepository referralCodeRepository;
    @Autowired private ReferralCodeAssessmentRepository referralCodeAssessmentRepository;
    @Autowired private StudentReferralRepository studentReferralRepository;
    @Autowired private ReferralService referralService;
    @Autowired private InstituteDetailRepository instituteDetailRepository;
    @Autowired private AssessmentInstituteMappingRepository assessmentInstituteMappingRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private UserStudentRepository userStudentRepository;

    // ── CRUD ────────────────────────────────────────────────────────────────

    @PreAuthorize("@auth.allows('referral_code.create')")
    @PostMapping("/create")
    public ResponseEntity<?> create(@RequestBody Map<String, Object> request) {
        String code = (String) request.get("code");
        if (code == null || code.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Referral code is required");
        }
        Integer instituteCode = toInt(request.get("instituteCode"));
        if (instituteCode == null) {
            return ResponseEntity.badRequest().body("Institute is required");
        }
        if (!canAccessInstitute(instituteCode)) {
            return forbidden();
        }
        if (referralCodeRepository.findByCodeIgnoreCase(code.trim().toUpperCase()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Referral code already exists");
        }

        ReferralCode rc = new ReferralCode();
        rc.setCode(code.trim().toUpperCase());
        rc.setName((String) request.get("name"));
        rc.setPhone((String) request.get("phone"));
        rc.setEmail((String) request.get("email"));
        rc.setInstituteCode(instituteCode);
        rc.setDescription((String) request.get("description"));
        if (request.get("maxUses") != null) {
            rc.setMaxUses(toInt(request.get("maxUses")));
        }
        applyExpiresAt(rc, request.get("expiresAt"));
        rc = referralCodeRepository.save(rc);

        setAssessments(rc.getId(), request.get("assessmentIds"));
        return ResponseEntity.ok(rc);
    }

    @PreAuthorize("@auth.allows('referral_code.read.all')")
    @GetMapping("/getAll")
    public ResponseEntity<List<ReferralCode>> getAll() {
        List<ReferralCode> all = referralCodeRepository.findAllByOrderByCreatedAtDesc();
        List<Integer> allowed = allowedInstituteCodes();
        if (allowed == null) {
            return ResponseEntity.ok(all); // unrestricted (super-admin / wildcard)
        }
        List<ReferralCode> scoped = all.stream()
                .filter(rc -> rc.getInstituteCode() != null && allowed.contains(rc.getInstituteCode()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(scoped);
    }

    @PreAuthorize("@auth.allows('referral_code.read')")
    @GetMapping("/get/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        Optional<ReferralCode> rc = referralCodeRepository.findById(id);
        if (!rc.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        if (!canAccessInstitute(rc.get().getInstituteCode())) {
            return forbidden();
        }
        return ResponseEntity.ok(rc.get());
    }

    @PreAuthorize("@auth.allows('referral_code.update')")
    @PutMapping("/update/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        Optional<ReferralCode> opt = referralCodeRepository.findById(id);
        if (!opt.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        ReferralCode rc = opt.get();
        if (!canAccessInstitute(rc.getInstituteCode())) {
            return forbidden();
        }

        if (request.containsKey("code")) {
            String newCode = ((String) request.get("code")).trim().toUpperCase();
            Optional<ReferralCode> existing = referralCodeRepository.findByCodeIgnoreCase(newCode);
            if (existing.isPresent() && !existing.get().getId().equals(id)) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body("Referral code already exists");
            }
            rc.setCode(newCode);
        }
        if (request.containsKey("name")) rc.setName((String) request.get("name"));
        if (request.containsKey("phone")) rc.setPhone((String) request.get("phone"));
        if (request.containsKey("email")) rc.setEmail((String) request.get("email"));
        if (request.containsKey("description")) rc.setDescription((String) request.get("description"));
        if (request.containsKey("instituteCode")) {
            Integer ic = toInt(request.get("instituteCode"));
            if (ic != null) {
                if (!canAccessInstitute(ic)) {
                    return forbidden(); // cannot reassign a code to an institute you aren't mapped to
                }
                rc.setInstituteCode(ic);
            }
        }
        if (request.containsKey("isActive")) rc.setIsActive((Boolean) request.get("isActive"));
        if (request.containsKey("maxUses")) {
            rc.setMaxUses(request.get("maxUses") != null ? toInt(request.get("maxUses")) : null);
        }
        if (request.containsKey("expiresAt")) {
            if (request.get("expiresAt") != null) applyExpiresAt(rc, request.get("expiresAt"));
            else rc.setExpiresAt(null);
        }

        rc = referralCodeRepository.save(rc);
        if (request.containsKey("assessmentIds")) {
            setAssessments(id, request.get("assessmentIds"));
        }
        return ResponseEntity.ok(rc);
    }

    @PreAuthorize("@auth.allows('referral_code.delete')")
    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        Optional<ReferralCode> opt = referralCodeRepository.findById(id);
        if (!opt.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        if (!canAccessInstitute(opt.get().getInstituteCode())) {
            return forbidden();
        }
        referralCodeAssessmentRepository.deleteByReferralCodeId(id);
        referralCodeRepository.deleteById(id);
        return ResponseEntity.ok("Referral code deleted");
    }

    // ── Assessment mapping ───────────────────────────────────────────────────

    @PreAuthorize("@auth.allows('referral_code.read')")
    @GetMapping("/{id}/assessments")
    public ResponseEntity<?> getAssessments(@PathVariable Long id) {
        Optional<ReferralCode> opt = referralCodeRepository.findById(id);
        if (!opt.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        if (!canAccessInstitute(opt.get().getInstituteCode())) {
            return forbidden();
        }
        List<Long> ids = referralCodeAssessmentRepository.findByReferralCodeId(id).stream()
                .map(ReferralCodeAssessment::getAssessmentId)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ids);
    }

    // ── Pickers for the admin create/edit form ───────────────────────────────

    @PreAuthorize("@auth.allows('referral_code.read')")
    @GetMapping("/institutes")
    public ResponseEntity<?> listInstitutes() {
        List<Integer> allowed = allowedInstituteCodes(); // null = unrestricted
        List<Map<String, Object>> out = new ArrayList<>();
        for (InstituteDetail inst : instituteDetailRepository.findAll()) {
            if (allowed != null && !allowed.contains(inst.getInstituteCode())) {
                continue; // only institutes the caller is mapped to
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("instituteCode", inst.getInstituteCode());
            m.put("instituteName", inst.getInstituteName());
            out.add(m);
        }
        return ResponseEntity.ok(out);
    }

    @PreAuthorize("@auth.allows('referral_code.read')")
    @GetMapping("/institutes/{instituteCode}/assessments")
    public ResponseEntity<?> listInstituteAssessments(@PathVariable Integer instituteCode) {
        if (!canAccessInstitute(instituteCode)) {
            return forbidden();
        }
        // Distinct assessments this institute offers (via its active mappings).
        Set<Long> assessmentIds = assessmentInstituteMappingRepository
                .findByInstituteCode(instituteCode).stream()
                .map(AssessmentInstituteMapping::getAssessmentId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        List<Map<String, Object>> out = new ArrayList<>();
        for (Long aid : assessmentIds) {
            String name = assessmentTableRepository.findById(aid)
                    .map(a -> a.getAssessmentName()).orElse("Assessment #" + aid);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("assessmentId", aid);
            m.put("assessmentName", name);
            out.add(m);
        }
        return ResponseEntity.ok(out);
    }

    // ── Referred students (for the Excel export on the admin page) ────────────

    @PreAuthorize("@auth.allows('referral_code.read')")
    @GetMapping("/{id}/students")
    public ResponseEntity<?> getReferredStudents(@PathVariable Long id) {
        Optional<ReferralCode> rcOpt = referralCodeRepository.findById(id);
        if (!rcOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        if (!canAccessInstitute(rcOpt.get().getInstituteCode())) {
            return forbidden();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (StudentReferral link : studentReferralRepository.findByReferralCodeId(id)) {
            Map<String, Object> row = new LinkedHashMap<>();
            String studentName = "";
            String email = "";
            String phone = "";
            UserStudent us = userStudentRepository.findByIdWithStudentInfo(link.getUserStudentId()).orElse(null);
            if (us != null && us.getStudentInfo() != null) {
                studentName = nullSafe(us.getStudentInfo().getName());
                email = nullSafe(us.getStudentInfo().getEmail());
                phone = nullSafe(us.getStudentInfo().getPhoneNumber());
            }
            String instituteName = "";
            if (link.getInstituteCode() != null) {
                InstituteDetail inst = instituteDetailRepository.findById(link.getInstituteCode().intValue());
                if (inst != null) instituteName = nullSafe(inst.getInstituteName());
            }
            String assessmentName = "";
            if (link.getAssessmentId() != null) {
                assessmentName = assessmentTableRepository.findById(link.getAssessmentId())
                        .map(a -> a.getAssessmentName()).orElse("");
            }
            row.put("studentName", studentName);
            row.put("email", email);
            row.put("phone", phone);
            row.put("instituteName", instituteName);
            row.put("assessmentName", assessmentName);
            row.put("registeredAt", link.getCreatedAt());
            out.add(row);
        }
        return ResponseEntity.ok(out);
    }

    // ── Public validation (used by the assessment app at registration) ────────

    @PostMapping("/public/validate")
    public ResponseEntity<?> validate(@RequestBody Map<String, Object> request) {
        Object codeObj = request.get("code");
        if (codeObj == null || codeObj.toString().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Referral code is required");
        }
        Long assessmentId = toLong(request.get("assessmentId"));
        ReferralService.Result result = referralService.validate(codeObj.toString(), assessmentId);
        if (!result.valid) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(result.message);
        }
        Map<String, Object> response = new HashMap<>();
        response.put("code", result.referralCode.getCode());
        response.put("name", result.referralCode.getName());
        response.put("valid", true);
        return ResponseEntity.ok(response);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void setAssessments(Long referralCodeId, Object raw) {
        List<Long> assessmentIds = new ArrayList<>();
        if (raw instanceof List) {
            for (Object o : (List<?>) raw) {
                Long v = toLong(o);
                if (v != null) assessmentIds.add(v);
            }
        }
        referralCodeAssessmentRepository.deleteByReferralCodeId(referralCodeId);
        for (Long aid : assessmentIds) {
            ReferralCodeAssessment m = new ReferralCodeAssessment();
            m.setReferralCodeId(referralCodeId);
            m.setAssessmentId(aid);
            referralCodeAssessmentRepository.save(m);
        }
    }

    private void applyExpiresAt(ReferralCode rc, Object raw) {
        if (raw == null) return;
        try {
            rc.setExpiresAt(new Date(Long.parseLong(raw.toString())));
        } catch (NumberFormatException e) {
            // ignore invalid date
        }
    }

    private static Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.valueOf(o.toString().trim()); } catch (NumberFormatException e) { return null; }
    }

    private static Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).longValue();
        try { return Long.valueOf(o.toString().trim()); } catch (NumberFormatException e) { return null; }
    }

    private static String nullSafe(String s) {
        return s == null ? "" : s;
    }

    // ── ABAC institute scoping ────────────────────────────────────────────────
    // A referral code belongs to one institute. A non-super-admin may only see /
    // manage codes for the institutes their role-assignment scopes cover. This
    // reuses the same CurrentScopes source that @auth.allows('perm', instituteId)
    // consults, so referral scoping stays consistent with the permission system.

    private UserPrincipal currentPrincipal() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !(a.getPrincipal() instanceof UserPrincipal)) {
            return null;
        }
        return (UserPrincipal) a.getPrincipal();
    }

    /**
     * Institute codes the caller is scoped to, or {@code null} when unrestricted
     * (super-admin, or a wildcard scope row with {@code i == null}). An empty list
     * means "scoped to nothing" → sees nothing.
     */
    private List<Integer> allowedInstituteCodes() {
        UserPrincipal p = currentPrincipal();
        if (p == null) return Collections.emptyList();
        if (p.isSuperAdmin()) return null;
        List<CurrentScopes.ScopeRow> rows = p.getScopes();
        if (rows == null || rows.isEmpty()) return Collections.emptyList();
        List<Integer> codes = new ArrayList<>();
        for (CurrentScopes.ScopeRow row : rows) {
            if (row.i == null) return null; // wildcard at institute dim = unrestricted
            if (!codes.contains(row.i)) codes.add(row.i);
        }
        return codes;
    }

    private boolean canAccessInstitute(Integer instituteCode) {
        if (instituteCode == null) return true;
        List<Integer> allowed = allowedInstituteCodes();
        return allowed == null || allowed.contains(instituteCode);
    }

    private ResponseEntity<?> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body("You are not mapped to this institute");
    }
}
