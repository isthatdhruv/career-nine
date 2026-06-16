package com.kccitm.api.controller.career9;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import javax.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.AssessmentInstituteMapping;
import com.kccitm.api.model.career9.AssessmentMappingTier;
import com.kccitm.api.model.career9.InstituteAssessment;
import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.model.career9.PromoCode;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.model.career9.school.SchoolClasses;
import com.kccitm.api.model.career9.school.SchoolSections;
import com.kccitm.api.repository.Career9.AssessmentInstituteMappingRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.AssessmentMappingTierRepository;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;
import com.kccitm.api.repository.Career9.PromoCodeRepository;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.School.SchoolClassesRepository;
import com.kccitm.api.repository.Career9.School.SchoolSectionsRepository;
import com.kccitm.api.repository.Career9.School.SchoolSessionRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.security.AuthCookieService;
import com.kccitm.api.security.TokenProvider;
import com.kccitm.api.service.RazorpayService;
import com.kccitm.api.service.SmtpEmailService;
import com.kccitm.api.service.career9.AssessmentMappingTierService;
import com.kccitm.api.service.StudentProvisioningService;
import com.kccitm.api.service.branding.InstituteBrandingService;

@RestController
@RequestMapping("/assessment-mapping")
public class AssessmentInstituteMappingController {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentInstituteMappingController.class);

    @Autowired
    private AssessmentInstituteMappingRepository mappingRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private InstituteDetailRepository instituteDetailRepository;

    @Autowired
    private InstituteBrandingService brandingService;

    @Autowired
    private SchoolSessionRepository schoolSessionRepository;

    @Autowired
    private SchoolClassesRepository schoolClassesRepository;

    @Autowired
    private SchoolSectionsRepository schoolSectionsRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudentInfoRepository studentInfoRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @Autowired
    private SmtpEmailService gmailApiEmailService;

    @Autowired
    private StudentProvisioningService studentProvisioningService;

    @Autowired
    private com.kccitm.api.service.b2c.StudentInstituteMembershipService membershipService;

    @Autowired
    private com.kccitm.api.service.CareerNineRollNumberService rollNumberService;

    @Autowired
    private com.kccitm.api.service.StudentSessionService studentSessionService;

    @Autowired
    private RazorpayService razorpayService;

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

    @Autowired
    private com.kccitm.api.service.PaymentTransactionWriter paymentTransactionWriter;

    @Autowired
    private PromoCodeRepository promoCodeRepository;

    @Autowired
    private AssessmentMappingTierRepository tierRepository;

    @Autowired
    private AssessmentMappingTierService tierService;

    @Autowired
    private com.kccitm.api.service.counselling.BookingService bookingService;

    @Autowired
    private com.kccitm.api.service.career9.InstituteAssessmentService instituteAssessmentService;

    @Autowired
    private com.kccitm.api.service.b2c.EntitlementService entitlementService;

    @Autowired
    private com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository studentEntitlementRepository;

    @Autowired
    private AuthCookieService authCookieService;

    @Autowired
    private TokenProvider tokenProvider;

    @org.springframework.beans.factory.annotation.Value("${app.razorpay.callback-base-url:https://dashboard.career-9.com}")
    private String callbackBaseUrl;

    @org.springframework.beans.factory.annotation.Value("${app.auth.assessmentTokenExpirationMsec:14400000}")
    private long assessmentTokenExpirationMsec;

    // ============ ADMIN ENDPOINTS ============

    private static final java.util.Set<String> VALID_LEVELS = new java.util.HashSet<>(
            java.util.Arrays.asList("INSTITUTE", "SESSION", "CLASS", "SECTION"));

    @PostMapping("/create")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.create')")
    @Transactional
    public ResponseEntity<?> createMapping(@RequestBody AssessmentInstituteMapping mapping) {
        // Validate assessment exists
        if (mapping.getAssessmentId() == null || !assessmentTableRepository.existsById(mapping.getAssessmentId())) {
            return ResponseEntity.badRequest().body("Assessment not found");
        }
        if (mapping.getInstituteCode() == null) {
            return ResponseEntity.badRequest().body("Institute code is required");
        }

        // Validate + normalize the level, then null out coordinates that don't apply
        // (so e.g. an INSTITUTE-wide link never carries a stale classId).
        String level = mapping.getMappingLevel() == null ? null : mapping.getMappingLevel().trim().toUpperCase();
        if (level == null || !VALID_LEVELS.contains(level)) {
            return ResponseEntity.badRequest().body("mappingLevel must be one of INSTITUTE, SESSION, CLASS, SECTION");
        }
        mapping.setMappingLevel(level);
        normalizeLevelCoordinates(mapping);
        if (!levelCoordinatesPresent(mapping)) {
            return ResponseEntity.badRequest().body("Missing session/class/section for the selected level");
        }

        // Normalize/validate the post-assessment payment timing (PAY_FIRST default).
        String timing = mapping.getPaymentTiming() == null
                ? "PAY_FIRST" : mapping.getPaymentTiming().trim().toUpperCase();
        if (!"PAY_FIRST".equals(timing) && !"PAY_LATER".equals(timing)) {
            return ResponseEntity.badRequest().body("paymentTiming must be PAY_FIRST or PAY_LATER");
        }
        mapping.setPaymentTiming(timing);

        // Reject an exact-duplicate mapping (the DB unique key is ineffective when any
        // coordinate is null, which is every level except SECTION — so guard in code).
        boolean dup = mappingRepository.findByInstituteCode(mapping.getInstituteCode()).stream().anyMatch(m ->
                mapping.getAssessmentId().equals(m.getAssessmentId())
                        && level.equals(m.getMappingLevel())
                        && java.util.Objects.equals(m.getSessionId(), mapping.getSessionId())
                        && java.util.Objects.equals(m.getClassId(), mapping.getClassId())
                        && java.util.Objects.equals(m.getSectionId(), mapping.getSectionId()));
        if (dup) {
            return ResponseEntity.badRequest().body("A mapping already exists for this assessment at this level");
        }

        // Mint the dual link tokens. The paid token doubles as the legacy `token`
        // (non-null/unique) so any code still reading `token` keeps working.
        String paidToken = UUID.randomUUID().toString();
        mapping.setToken(paidToken);
        mapping.setPaidToken(paidToken);
        mapping.setFreeToken(UUID.randomUUID().toString());
        if (mapping.getPaidActive() == null) mapping.setPaidActive(true);
        if (mapping.getFreeActive() == null) mapping.setFreeActive(true);
        mapping.setMigratedFromSchoolConfigId(null);

        AssessmentInstituteMapping saved = mappingRepository.save(mapping);

        // Auto-create the free tier backing the free link (inclusions off by default;
        // reserved sort_order -1 keeps it out of the paid wave ordering).
        if (!tierRepository.findFirstByMappingIdAndIsFreeTrue(saved.getMappingId()).isPresent()) {
            AssessmentMappingTier freeTier = new AssessmentMappingTier();
            freeTier.setMappingId(saved.getMappingId());
            freeTier.setName("Free");
            freeTier.setDescription("Free registration");
            freeTier.setAmount(0L);
            freeTier.setSortOrder(-1);
            freeTier.setCurrentCount(0);
            freeTier.setIsActive(true);
            freeTier.setIsFree(true);
            tierRepository.save(freeTier);
        }

        // Keep the institute<->assessment catalog in sync (any mapping create enrolls
        // the assessment for the institute).
        instituteAssessmentService.ensure(saved.getInstituteCode(), saved.getAssessmentId());

        return ResponseEntity.ok(saved);
    }

    /** Clears coordinates that don't apply to the mapping level. */
    private static void normalizeLevelCoordinates(AssessmentInstituteMapping m) {
        String lvl = m.getMappingLevel();
        if ("INSTITUTE".equals(lvl)) {
            m.setSessionId(null); m.setClassId(null); m.setSectionId(null);
        } else if ("SESSION".equals(lvl)) {
            m.setClassId(null); m.setSectionId(null);
        } else if ("CLASS".equals(lvl)) {
            m.setSectionId(null);
        }
    }

    /** True when the level's required coordinates are present. */
    private static boolean levelCoordinatesPresent(AssessmentInstituteMapping m) {
        String lvl = m.getMappingLevel();
        if ("SESSION".equals(lvl)) return m.getSessionId() != null;
        if ("CLASS".equals(lvl)) return m.getSessionId() != null && m.getClassId() != null;
        if ("SECTION".equals(lvl)) return m.getSessionId() != null && m.getClassId() != null && m.getSectionId() != null;
        return true; // INSTITUTE needs no coordinates
    }

    @GetMapping("/getAll")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.read')") // SCOPE: filtered by Hibernate scopeFilter (Plan 15-06)
    public List<AssessmentInstituteMapping> getAll() {
        return mappingRepository.findAll();
    }

    @GetMapping("/getByInstitute/{instituteCode}")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.read')")
    public List<AssessmentInstituteMapping> getByInstitute(@PathVariable Integer instituteCode) {
        return mappingRepository.findByInstituteCode(instituteCode);
    }

    @GetMapping("/getByInstitute/{instituteCode}/assessments")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.read')")
    public List<AssessmentTableRepository.AssessmentSummary> getAssessmentsByInstitute(@PathVariable Integer instituteCode) {
        return assessmentTableRepository.findAssessmentSummariesByInstitute(instituteCode);
    }

    @GetMapping("/get/{id}")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.read')")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        return mappingRepository.findById(id)
                .map(m -> ResponseEntity.ok((Object) m))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/update/{id}")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.update')")
    public ResponseEntity<?> updateMapping(@PathVariable Long id,
            @RequestBody AssessmentInstituteMapping updated) {
        Optional<AssessmentInstituteMapping> existingOpt = mappingRepository.findById(id);
        if (!existingOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        AssessmentInstituteMapping existing = existingOpt.get();
        if (updated.getIsActive() != null) {
            existing.setIsActive(updated.getIsActive());
        }
        if (updated.getAmount() != null) {
            existing.setAmount(updated.getAmount());
        }

        return ResponseEntity.ok(mappingRepository.save(existing));
    }

    @DeleteMapping("/delete/{id}")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.delete')")
    public ResponseEntity<?> deleteMapping(@PathVariable Long id) {
        if (!mappingRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        mappingRepository.deleteById(id);
        return ResponseEntity.ok("Mapping deleted successfully");
    }

    // ----- Institute<->Assessment catalog (admin) -----
    // The catalog ("which assessments this institute offers") set in the wizard's
    // Map-Assessments step and kept in sync by createMapping.

    @GetMapping("/institute/{instituteCode}/catalog")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.read')")
    public List<InstituteAssessment> getCatalog(@PathVariable Integer instituteCode) {
        return instituteAssessmentService.listByInstitute(instituteCode);
    }

    @PostMapping("/institute/{instituteCode}/catalog")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.create')")
    public ResponseEntity<?> enableCatalog(@PathVariable Integer instituteCode,
            @RequestBody Map<String, Object> body) {
        Object idsRaw = body.get("assessmentIds");
        if (!(idsRaw instanceof List)) {
            return ResponseEntity.badRequest().body("assessmentIds (array) is required");
        }
        List<Long> assessmentIds = new java.util.ArrayList<>();
        for (Object o : (List<?>) idsRaw) {
            if (o != null) assessmentIds.add(Long.valueOf(o.toString()));
        }
        try {
            return ResponseEntity.ok(instituteAssessmentService.enable(instituteCode, assessmentIds));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/institute/catalog/{id}/toggle")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.update')")
    public ResponseEntity<?> toggleCatalog(@PathVariable Long id) {
        InstituteAssessment updated = instituteAssessmentService.toggle(id);
        return updated == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(updated);
    }

    @DeleteMapping("/institute/catalog/{id}")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.delete')")
    public ResponseEntity<?> deleteCatalog(@PathVariable Long id) {
        return instituteAssessmentService.delete(id)
                ? ResponseEntity.ok("Removed from catalog")
                : ResponseEntity.notFound().build();
    }

    // ----- Per-link toggles (admin) -----
    // Toggle the free or paid link independently of the mapping's master is_active.

    @PatchMapping("/{mappingId}/link/{linkType}/toggle")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.update')")
    public ResponseEntity<?> toggleLink(@PathVariable Long mappingId, @PathVariable String linkType) {
        Optional<AssessmentInstituteMapping> opt = mappingRepository.findById(mappingId);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        AssessmentInstituteMapping m = opt.get();
        if ("free".equalsIgnoreCase(linkType)) {
            m.setFreeActive(!Boolean.TRUE.equals(m.getFreeActive()));
        } else if ("paid".equalsIgnoreCase(linkType)) {
            m.setPaidActive(!Boolean.TRUE.equals(m.getPaidActive()));
        } else {
            return ResponseEntity.badRequest().body("linkType must be 'free' or 'paid'");
        }
        return ResponseEntity.ok(mappingRepository.save(m));
    }

    // ----- Pricing tiers (admin) — protected with the same permission family as the
    //       sibling mapping CRUD endpoints so the enforce-mode flip can't leave tier
    //       pricing world-writable by any authenticated user. -----

    @GetMapping("/{mappingId}/tiers")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.read')")
    public ResponseEntity<?> listTiers(@PathVariable Long mappingId) {
        if (!mappingRepository.existsById(mappingId)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(tierRepository.findByMappingIdOrderBySortOrderAsc(mappingId));
    }

    @PostMapping("/{mappingId}/tiers")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.create')")
    public ResponseEntity<?> createTier(@PathVariable Long mappingId,
            @RequestBody AssessmentMappingTier tier) {
        if (!mappingRepository.existsById(mappingId)) {
            return ResponseEntity.notFound().build();
        }
        if (tier.getName() == null || tier.getName().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Tier name is required");
        }
        if (tier.getDescription() == null || tier.getDescription().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Tier description is required");
        }
        if (tier.getDescription().trim().length() > 200) {
            return ResponseEntity.badRequest().body("Tier description must be 200 characters or fewer");
        }
        if (tier.getSortOrder() == null) {
            return ResponseEntity.badRequest().body("Sort order is required");
        }
        tier.setName(tier.getName().trim());
        tier.setDescription(tier.getDescription().trim());
        tier.setMappingId(mappingId);
        tier.setCurrentCount(0);
        return ResponseEntity.ok(tierRepository.save(tier));
    }

    @PutMapping("/tiers/{tierId}")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.update')")
    public ResponseEntity<?> updateTier(@PathVariable Long tierId,
            @RequestBody AssessmentMappingTier updated) {
        Optional<AssessmentMappingTier> existingOpt = tierRepository.findById(tierId);
        if (!existingOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        AssessmentMappingTier existing = existingOpt.get();
        if (updated.getName() != null) {
            String trimmed = updated.getName().trim();
            if (trimmed.isEmpty()) {
                return ResponseEntity.badRequest().body("Tier name is required");
            }
            existing.setName(trimmed);
        }
        if (updated.getDescription() != null) {
            String trimmed = updated.getDescription().trim();
            if (trimmed.isEmpty()) {
                return ResponseEntity.badRequest().body("Tier description is required");
            }
            if (trimmed.length() > 200) {
                return ResponseEntity.badRequest().body("Tier description must be 200 characters or fewer");
            }
            existing.setDescription(trimmed);
        }
        if (updated.getAmount() != null) existing.setAmount(updated.getAmount());
        if (updated.getSortOrder() != null) existing.setSortOrder(updated.getSortOrder());
        // maxRegistrations is nullable-meaningful: always copy it through
        existing.setMaxRegistrations(updated.getMaxRegistrations());
        if (updated.getIsActive() != null) existing.setIsActive(updated.getIsActive());
        // Service toggles (report / dashboard / counselling / LMS) — booleans copied
        // when sent; the count/validity sub-fields are nullable-meaningful so always copied.
        if (updated.getIncludesFinalReport() != null) existing.setIncludesFinalReport(updated.getIncludesFinalReport());
        if (updated.getIncludesDashboard() != null) existing.setIncludesDashboard(updated.getIncludesDashboard());
        existing.setDashboardValidityDays(updated.getDashboardValidityDays());
        if (updated.getIncludesCounselling() != null) existing.setIncludesCounselling(updated.getIncludesCounselling());
        existing.setCounsellingSessionCount(updated.getCounsellingSessionCount());
        existing.setCounsellingPrice(updated.getCounsellingPrice()); // Phase 3b: per-tier extra-session price
        if (updated.getIncludesLms() != null) existing.setIncludesLms(updated.getIncludesLms());
        existing.setLmsValidityDays(updated.getLmsValidityDays());
        return ResponseEntity.ok(tierRepository.save(existing));
    }

    @PatchMapping("/tiers/{tierId}/toggle")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.update')")
    public ResponseEntity<?> toggleTier(@PathVariable Long tierId) {
        Optional<AssessmentMappingTier> existingOpt = tierRepository.findById(tierId);
        if (!existingOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        AssessmentMappingTier existing = existingOpt.get();
        existing.setIsActive(!Boolean.TRUE.equals(existing.getIsActive()));
        return ResponseEntity.ok(tierRepository.save(existing));
    }

    @DeleteMapping("/tiers/{tierId}")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.delete')")
    public ResponseEntity<?> deleteTier(@PathVariable Long tierId) {
        if (!tierRepository.existsById(tierId)) {
            return ResponseEntity.notFound().build();
        }
        tierRepository.deleteById(tierId);
        return ResponseEntity.ok("Tier deleted successfully");
    }

    @PostMapping("/tiers/{tierId}/recount")
    @PreAuthorize("@auth.allows('assessment_institute_mapping.update')")
    public ResponseEntity<?> recountTier(@PathVariable Long tierId) {
        if (!tierRepository.existsById(tierId)) {
            return ResponseEntity.notFound().build();
        }
        int newCount = tierService.recountTier(tierId);
        Map<String, Object> response = new HashMap<>();
        response.put("tierId", tierId);
        response.put("currentCount", newCount);
        return ResponseEntity.ok(response);
    }

    // ----- Dual-link resolution helpers -----

    /** A public token resolved to its mapping + which link (free vs paid) it is. */
    private static class ResolvedLink {
        final AssessmentInstituteMapping mapping;
        final boolean freeLink;
        ResolvedLink(AssessmentInstituteMapping mapping, boolean freeLink) {
            this.mapping = mapping;
            this.freeLink = freeLink;
        }
    }

    /** Resolve a public token to (mapping, linkType), gated on the mapping's master is_active. */
    private ResolvedLink resolveLink(String token) {
        if (token == null) return null;
        Optional<AssessmentInstituteMapping> paid = mappingRepository.findByPaidToken(token);
        if (paid.isPresent() && Boolean.TRUE.equals(paid.get().getIsActive())) {
            return new ResolvedLink(paid.get(), false);
        }
        Optional<AssessmentInstituteMapping> free = mappingRepository.findByFreeToken(token);
        if (free.isPresent() && Boolean.TRUE.equals(free.get().getIsActive())) {
            return new ResolvedLink(free.get(), true);
        }
        // Legacy single-token back-compat (rows whose paid_token wasn't backfilled).
        Optional<AssessmentInstituteMapping> legacy = mappingRepository.findByTokenAndIsActive(token, true);
        return legacy.map(m -> new ResolvedLink(m, false)).orElse(null);
    }

    /**
     * The tier whose price + inclusions apply for this link, or null when registration
     * is closed (closed[0] is set accordingly). FREE link → the is_free tier (honoring
     * free_active + its cap). PAID link → the active wave (honoring paid_active).
     */
    private AssessmentMappingTier resolveEffectiveTier(ResolvedLink link, boolean[] closed) {
        AssessmentInstituteMapping m = link.mapping;
        if (link.freeLink) {
            if (!Boolean.TRUE.equals(m.getFreeActive())) { closed[0] = true; return null; }
            AssessmentMappingTier freeTier =
                    tierRepository.findFirstByMappingIdAndIsFreeTrue(m.getMappingId()).orElse(null);
            if (freeTier == null) { closed[0] = true; return null; }
            Integer max = freeTier.getMaxRegistrations();
            int cur = freeTier.getCurrentCount() == null ? 0 : freeTier.getCurrentCount();
            if (max != null && max > 0 && cur >= max) { closed[0] = true; return null; }
            closed[0] = false;
            return freeTier;
        }
        if (!Boolean.TRUE.equals(m.getPaidActive())) { closed[0] = true; return null; }
        List<AssessmentMappingTier> waves = tierRepository
                .findByMappingIdAndIsFreeAndIsActiveOrderBySortOrderAsc(m.getMappingId(), false, true);
        AssessmentMappingTier active = tierService.resolveActiveTier(waves);
        if (active == null) { closed[0] = true; return null; }
        closed[0] = false;
        return active;
    }

    private static Map<String, Object> inclusionsOf(AssessmentMappingTier t) {
        Map<String, Object> inc = new HashMap<>();
        if (t == null) return inc;
        inc.put("includesFinalReport", Boolean.TRUE.equals(t.getIncludesFinalReport()));
        inc.put("includesDashboard", Boolean.TRUE.equals(t.getIncludesDashboard()));
        inc.put("includesCounselling", Boolean.TRUE.equals(t.getIncludesCounselling()));
        inc.put("counsellingSessionCount", t.getCounsellingSessionCount());
        inc.put("counsellingPrice", t.getCounsellingPrice());
        inc.put("includesLms", Boolean.TRUE.equals(t.getIncludesLms()));
        inc.put("lmsValidityDays", t.getLmsValidityDays());
        inc.put("dashboardValidityDays", t.getDashboardValidityDays());
        return inc;
    }

    /** Session -> class -> section tree for an institute (explicit maps, no lazy nav). */
    private List<Map<String, Object>> buildInstituteSessionTree(Integer instituteCode) {
        List<Map<String, Object>> sessions = new java.util.ArrayList<>();
        for (com.kccitm.api.model.career9.school.SchoolSession s :
                schoolSessionRepository.findByInstitute_InstituteCode(instituteCode)) {
            Map<String, Object> sm = new HashMap<>();
            sm.put("id", s.getId());
            sm.put("sessionYear", s.getSessionYear());
            List<Map<String, Object>> classes = new java.util.ArrayList<>();
            for (SchoolClasses c : schoolClassesRepository.findBySchoolSession_Id(s.getId())) {
                Map<String, Object> cm = new HashMap<>();
                cm.put("id", c.getId());
                cm.put("className", c.getClassName());
                List<Map<String, Object>> sections = new java.util.ArrayList<>();
                for (SchoolSections sec : schoolSectionsRepository.findBySchoolClasses_Id(c.getId())) {
                    Map<String, Object> secm = new HashMap<>();
                    secm.put("id", sec.getId());
                    secm.put("sectionName", sec.getSectionName());
                    sections.add(secm);
                }
                cm.put("sections", sections);
                classes.add(cm);
            }
            sm.put("classes", classes);
            sessions.add(sm);
        }
        return sessions;
    }

    // ============ PUBLIC ENDPOINTS ============

    // Phase 2 (Task 2.1 / HIGH-B): anonymous token-gated public mapping lookup. @PreAuthorize
    // removed so the enforce flip won't 403 the public caller; permitAll + CSRF-exempt via
    // PUBLIC_PATHS (/assessment-mapping/public/**). The path token is the gate. Coverage-excluded.
    @GetMapping("/public/info/{token}")
    public ResponseEntity<?> getMappingInfoByToken(@PathVariable String token) {
        ResolvedLink link = resolveLink(token);
        if (link == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Invalid or expired assessment link");
        }
        AssessmentInstituteMapping mapping = link.mapping;

        Map<String, Object> info = new HashMap<>();
        info.put("mappingLevel", mapping.getMappingLevel());
        info.put("assessmentId", mapping.getAssessmentId());
        info.put("instituteCode", mapping.getInstituteCode());
        info.put("linkType", link.freeLink ? "FREE" : "PAID");

        // Price + sold-out state. FREE is always 0; PAID surfaces the active wave's
        // price. registrationClosed is HONORED end-to-end (no silent free fall-through).
        boolean[] closed = new boolean[]{false};
        AssessmentMappingTier effective = resolveEffectiveTier(link, closed);
        info.put("registrationClosed", closed[0]);
        if (link.freeLink) {
            info.put("amount", 0);
        } else {
            info.put("amount", effective != null && effective.getAmount() != null ? effective.getAmount() : 0);
            if (effective != null) info.put("activeTierName", effective.getName());
        }
        info.put("inclusions", inclusionsOf(effective));

        // Post-assessment counselling payment timing + fee breakdown. PAY_FIRST folds the
        // counselling fee (counsellingPrice × included session count) into the registration
        // total so the student pays it upfront; PAY_LATER charges it per slot after the
        // assessment. The fee fields are surfaced so the registration page can itemise the
        // PAY_FIRST total ("Assessment ₹X + Counselling ₹Y/session × N = ₹Z").
        String timing = mapping.getPaymentTiming() != null ? mapping.getPaymentTiming() : "PAY_FIRST";
        info.put("paymentTiming", timing);
        long counsellingFeeTotal = 0L;
        if (!link.freeLink && effective != null
                && Boolean.TRUE.equals(effective.getIncludesCounselling())
                && effective.getCounsellingPrice() != null && effective.getCounsellingPrice() > 0) {
            int sessions = effective.getCounsellingSessionCount() != null && effective.getCounsellingSessionCount() > 0
                    ? effective.getCounsellingSessionCount() : 1;
            counsellingFeeTotal = (long) effective.getCounsellingPrice() * sessions;
            info.put("counsellingFeePerSession", effective.getCounsellingPrice());
            info.put("counsellingSessionCount", sessions);
            info.put("counsellingFeeTotal", counsellingFeeTotal);
        }
        // The amount the student actually pays at registration. PAY_FIRST adds the
        // counselling fee on top of the tier price; PAY_LATER pays only the tier price.
        long baseAmt = link.freeLink ? 0L
                : (effective != null && effective.getAmount() != null ? effective.getAmount() : 0L);
        info.put("payableTotal", "PAY_FIRST".equals(timing) ? baseAmt + counsellingFeeTotal : baseAmt);

        assessmentTableRepository.findById(mapping.getAssessmentId())
                .ifPresent(a -> info.put("assessmentName", a.getAssessmentName()));

        InstituteDetail institute = instituteDetailRepository.findById(mapping.getInstituteCode().intValue());
        if (institute != null) info.put("instituteName", institute.getInstituteName());
        info.put("branding", brandingService.forInstitute(institute));

        // Coordinates already fixed on the mapping.
        if (mapping.getSessionId() != null) {
            schoolSessionRepository.findById(mapping.getSessionId()).ifPresent(session -> {
                info.put("sessionId", session.getId());
                info.put("sessionYear", session.getSessionYear());
            });
        }
        if (mapping.getClassId() != null) {
            schoolClassesRepository.findById(mapping.getClassId()).ifPresent(schoolClass -> {
                info.put("classId", schoolClass.getId());
                info.put("className", schoolClass.getClassName());
            });
        }
        if (mapping.getSectionId() != null) {
            schoolSectionsRepository.findById(mapping.getSectionId()).ifPresent(section -> {
                info.put("sectionId", section.getId());
                info.put("sectionName", section.getSectionName());
            });
        }

        // What the student still needs to pick, by level.
        String lvl = mapping.getMappingLevel();
        if ("INSTITUTE".equals(lvl)) {
            info.put("availableSessions", buildInstituteSessionTree(mapping.getInstituteCode()));
        } else if ("SESSION".equals(lvl) && mapping.getSessionId() != null) {
            info.put("availableClasses", schoolClassesRepository.findBySchoolSession_Id(mapping.getSessionId()));
        } else if ("CLASS".equals(lvl) && mapping.getClassId() != null) {
            info.put("availableSections", schoolSectionsRepository.findBySchoolClasses_Id(mapping.getClassId()));
        }

        return ResponseEntity.ok(info);
    }

    // Phase 2 (Task 2.1 / HIGH-B): anonymous token-gated B2C self-registration. @PreAuthorize
    // removed so the enforce flip won't 403 the public caller; permitAll + CSRF-exempt via
    // PUBLIC_PATHS (/assessment-mapping/public/**). The path token is the gate. Coverage-excluded.
    @PostMapping("/public/register/{token}")
    @Transactional
    public ResponseEntity<?> registerStudentByToken(@PathVariable String token,
            @RequestBody Map<String, Object> studentData,
            HttpServletResponse httpResponse) {
        // 1. Resolve the token to its mapping + link type (free vs paid).
        ResolvedLink link = resolveLink(token);
        if (link == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Invalid or expired assessment link");
        }

        AssessmentInstituteMapping mapping = link.mapping;
        Long assessmentId = mapping.getAssessmentId();
        Integer instituteCode = mapping.getInstituteCode();

        // 2. Extract student data from request
        String name = (String) studentData.get("name");
        String email = (String) studentData.get("email");
        String dobStr = (String) studentData.get("dob");
        String phone = (String) studentData.get("phone");
        String gender = (String) studentData.get("gender");

        if (name == null || email == null || dobStr == null
                || phone == null || phone.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Name, email, phone, and date of birth are required");
        }

        // Parse DOB
        SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
        Date dob;
        try {
            dob = sdf.parse(dobStr);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Invalid date format. Use dd-MM-yyyy");
        }

        // 3. Resolve class info based on mapping level
        Integer studentClass = null;
        Integer schoolSectionId = null;

        if ("SECTION".equals(mapping.getMappingLevel())) {
            schoolSectionId = mapping.getSectionId();
            if (mapping.getClassId() != null) {
                studentClass = parseClassNumber(mapping.getClassId());
            }
        } else if ("CLASS".equals(mapping.getMappingLevel())) {
            studentClass = parseClassNumber(mapping.getClassId());
            // Section is optional from request
            if (studentData.get("schoolSectionId") != null) {
                schoolSectionId = Integer.valueOf(studentData.get("schoolSectionId").toString());
            }
        } else if ("SESSION".equals(mapping.getMappingLevel())
                || "INSTITUTE".equals(mapping.getMappingLevel())) {
            // Class and section come from the request (INSTITUTE-wide links let the
            // student self-select session -> class -> section).
            if (studentData.get("classId") != null) {
                Integer classId = Integer.valueOf(studentData.get("classId").toString());
                studentClass = parseClassNumber(classId);
            }
            if (studentData.get("schoolSectionId") != null) {
                schoolSectionId = Integer.valueOf(studentData.get("schoolSectionId").toString());
            }
        }

        // 4. Resolve the effective tier for this link. FREE link -> the is_free tier
        //    (amount 0); PAID link -> the active wave. A closed link (cap hit / link
        //    toggled off / no priced wave) is rejected — never silently free.
        boolean[] closed = new boolean[]{false};
        AssessmentMappingTier effectiveTier = resolveEffectiveTier(link, closed);
        if (effectiveTier == null) {
            return ResponseEntity.badRequest().body("Registrations are closed for this link");
        }
        Long activeTierId = effectiveTier.getTierId();
        Long mappingAmount = link.freeLink ? 0L : effectiveTier.getAmount();
        // PAY_FIRST: fold the counselling fee (counsellingPrice × included sessions) into the
        // registration charge so it's paid upfront. The tier feature snapshot applied on
        // payment success then activates counselling, so the student books for free after
        // the assessment. PAY_LATER leaves the charge at the tier price and defers the
        // counselling fee to per-slot booking (see payLaterBook + the snapshot guard).
        String paymentTiming = mapping.getPaymentTiming() != null ? mapping.getPaymentTiming() : "PAY_FIRST";
        if (!link.freeLink && "PAY_FIRST".equals(paymentTiming)
                && Boolean.TRUE.equals(effectiveTier.getIncludesCounselling())
                && effectiveTier.getCounsellingPrice() != null && effectiveTier.getCounsellingPrice() > 0) {
            int feeSessions = effectiveTier.getCounsellingSessionCount() != null
                    && effectiveTier.getCounsellingSessionCount() > 0
                    ? effectiveTier.getCounsellingSessionCount() : 1;
            long fee = (long) effectiveTier.getCounsellingPrice() * feeSessions;
            mappingAmount = (mappingAmount != null ? mappingAmount : 0L) + fee;
        }
        boolean paymentRequired = !link.freeLink && mappingAmount != null && mappingAmount > 0;

        // 5. Handle promo code if provided
        String promoCodeStr = (String) studentData.get("promoCode");
        Integer promoDiscountPercent = null;
        Long originalAmount = mappingAmount;
        Long finalAmount = mappingAmount;

        if (paymentRequired && promoCodeStr != null && !promoCodeStr.trim().isEmpty()) {
            Optional<PromoCode> promoOpt = promoCodeRepository.findByCodeIgnoreCaseAndIsActive(
                    promoCodeStr.trim().toUpperCase(), true);
            if (!promoOpt.isPresent()) {
                return ResponseEntity.badRequest().body("Invalid promo code");
            }
            PromoCode promo = promoOpt.get();
            if (promo.getExpiresAt() != null && promo.getExpiresAt().before(new Date())) {
                return ResponseEntity.badRequest().body("Promo code has expired");
            }
            if (promo.getMaxUses() != null && promo.getCurrentUses() >= promo.getMaxUses()) {
                return ResponseEntity.badRequest().body("Promo code usage limit reached");
            }
            promoDiscountPercent = promo.getDiscountPercent();
            // PROMO3: a misconfigured discount outside [0,100] would yield a
            // negative/over-100% charge; reject rather than silently free-provision.
            if (promoDiscountPercent == null || promoDiscountPercent < 0 || promoDiscountPercent > 100) {
                return ResponseEntity.badRequest().body("Promo code is misconfigured");
            }
            finalAmount = mappingAmount * (100 - promoDiscountPercent) / 100;
            // Integer (floor) division can drive a low price to 0 for a non-100% discount,
            // which would wrongly route the student onto the free path. Only a true 100%
            // discount (or a 0 base amount) may reach the free flow.
            if (promoDiscountPercent < 100 && finalAmount < 1L) {
                finalAmount = 1L;
            }
            // A1/A2: do NOT consume the promo here. Consumption is deferred to the
            // realized-redemption points (paid webhook success, or the free-commit
            // below) via the atomic guarded tryConsume, so an abandoned/expired/
            // failed attempt no longer burns a use.
        }

        // 6. Duplicate check by EMAIL
        List<StudentInfo> byEmail = studentInfoRepository.findByEmailAndInstituteId(email, instituteCode);
        if (!byEmail.isEmpty()) {
            StudentInfo existing = byEmail.get(0);

            // Require DOB match before accepting — prevents impersonation now that
            // the registered-student path can return a session token.
            Date existingDob = existing.getStudentDob();
            if (existingDob == null || !sameDay(existingDob, dob)) {
                return ResponseEntity.badRequest().body(
                        com.kccitm.api.util.DuplicateEmailResponse.build(existing, instituteDetailRepository));
            }

            if (paymentRequired && finalAmount > 0) {
                return handleExistingStudentWithPayment(existing, assessmentId, instituteCode,
                        mapping.getMappingId(), finalAmount, originalAmount, promoCodeStr, promoDiscountPercent,
                        name, email, dob, phone, activeTierId, httpResponse);
            }
            return handleExistingStudent(existing, assessmentId, instituteCode,
                    mapping.getMappingId(), activeTierId, httpResponse);
        }

        // 7. Duplicate check by DOB + institute + class + name
        if (studentClass != null) {
            List<StudentInfo> byDob = studentInfoRepository
                    .findByStudentDobAndInstituteIdAndStudentClassAndNameIgnoreCase(dob, instituteCode, studentClass, name);
            if (!byDob.isEmpty()) {
                if (paymentRequired && finalAmount > 0) {
                    return handleExistingStudentWithPayment(byDob.get(0), assessmentId, instituteCode,
                            mapping.getMappingId(), finalAmount, originalAmount, promoCodeStr, promoDiscountPercent,
                            name, email, dob, phone, activeTierId, httpResponse);
                }
                return handleExistingStudent(byDob.get(0), assessmentId, instituteCode,
                        mapping.getMappingId(), activeTierId, httpResponse);
            }
        }

        // 8. If payment required and finalAmount > 0, create payment transaction and redirect
        if (paymentRequired && finalAmount > 0) {
            return createPaymentAndRedirect(mapping.getMappingId(), assessmentId, instituteCode,
                    finalAmount, originalAmount, promoCodeStr, promoDiscountPercent,
                    name, email, dob, dobStr, phone, gender, activeTierId);
        }

        // 9. Free registration (no amount, or 100% promo discount) — create student directly.
        // Record a zero-amount paid transaction stamped with the tier so recount has a
        // single source, and increment the tier tally (no-op when no tier).
        // Free path: claim a tier slot (enforces the free tier's — or a 100%-promo
        // wave's — cap) and record a zero-amount paid txn: the ledger row AND the
        // entitlement source.
        tierRepository.tryIncrementCount(activeTierId);
        PaymentTransaction freeTxn = new PaymentTransaction();
        freeTxn.setMappingId(mapping.getMappingId());
        freeTxn.setMappingTierId(activeTierId);
        freeTxn.setAmount(0L);
        freeTxn.setOriginalAmount(originalAmount);
        if (promoCodeStr != null && !promoCodeStr.trim().isEmpty()) {
            freeTxn.setPromoCode(promoCodeStr.trim().toUpperCase());
            freeTxn.setPromoDiscountPercent(promoDiscountPercent);
        }
        freeTxn.setStatus("paid");
        freeTxn.setAssessmentId(assessmentId);
        freeTxn.setInstituteCode(instituteCode);
        freeTxn.setStudentName(name);
        freeTxn.setStudentEmail(email);
        freeTxn.setStudentDob(dob);
        freeTxn.setStudentPhone(phone);
        freeTxn = paymentTransactionRepository.save(freeTxn);

        // Create User
        User user = new User((int) (Math.random() * 100000), dob);
        user.setName(name);
        user.setEmail(email);
        user.setPhone(phone);
        user = userRepository.save(user);

        // Generate and set careerNineRollNumber
        String rollNumber = rollNumberService.generateNextRollNumber(instituteCode, schoolSectionId);
        if (rollNumber != null) {
            user.setCareerNineRollNumber(rollNumber);
            user = userRepository.save(user);
        }

        // Create StudentInfo
        StudentInfo studentInfo = new StudentInfo();
        studentInfo.setName(name);
        studentInfo.setEmail(email);
        studentInfo.setStudentDob(dob);
        studentInfo.setPhoneNumber(phone);
        studentInfo.setGender(gender);
        studentInfo.setInstituteId(instituteCode);
        studentInfo.setStudentClass(studentClass);
        studentInfo.setSchoolSectionId(schoolSectionId);
        studentInfo.setUser(user);
        studentInfo = studentInfoRepository.save(studentInfo);

        // Create UserStudent
        InstituteDetail institute = instituteDetailRepository.findById(instituteCode.intValue());
        UserStudent userStudent = new UserStudent(user, studentInfo, institute);
        userStudent = userStudentRepository.save(userStudent);
        studentProvisioningService.provision(userStudent);
        // Write the institute-membership row so free-path students appear in the roster and are
        // manageable via the membership API (the paid webhook path already does this).
        membershipService.setPrimaryInstitute(userStudent, instituteCode, null, "mapping-free-provision");

        // Create StudentAssessmentMapping
        StudentAssessmentMapping sam = new StudentAssessmentMapping(
                userStudent.getUserStudentId(), assessmentId);
        studentAssessmentMappingRepository.save(sam);

        // Stamp the student on the ledger txn and mint the service entitlement
        // (report/dashboard/counselling/LMS per the resolved tier — for the free
        // link too). Reuses the B2C entitlement gates (campaign_id stays null).
        freeTxn.setUserStudentId(userStudent.getUserStudentId());
        paymentTransactionRepository.save(freeTxn);
        entitlementService.activateB2BOnPayment(freeTxn.getTransactionId());

        // A1: the free registration is now realized — consume the promo (atomic,
        // cap-guarded). No-op when no promo was applied.
        consumePromoIfPresent(promoCodeStr);

        // Build response (auto-login session merged in)
        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Registration successful! Please save your login credentials.");
        response.put("username", user.getUsername());
        response.put("dob", dobStr);
        response.putAll(studentSessionService.buildSessionPayload(userStudent.getUserStudentId()));
        issueAssessmentSessionCookie(httpResponse, userStudent, assessmentId);

        // Send registration email with credentials
        String assessmentName = assessmentTableRepository.findById(assessmentId)
                .map(a -> a.getAssessmentName()).orElse("Assessment");
        sendRegistrationEmail(email, name, user.getUsername(), dobStr, assessmentName);

        return ResponseEntity.ok(response);
    }

    // ----- Free -> paid upgrade (public) -----
    // A free-registered student pays the current active paid wave to add services
    // (report/dashboard/counselling/LMS). The webhook unions the wave's inclusions
    // onto the student's existing entitlement (no new account).

    @GetMapping("/public/upgrade-info/{entitlementId}")
    public ResponseEntity<?> getUpgradeInfo(@PathVariable Long entitlementId) {
        Optional<com.kccitm.api.model.career9.b2c.StudentEntitlement> entOpt =
                studentEntitlementRepository.findById(entitlementId);
        if (!entOpt.isPresent() || entOpt.get().getCampaignId() != null
                || entOpt.get().getMappingId() == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No upgradable entitlement");
        }
        com.kccitm.api.model.career9.b2c.StudentEntitlement ent = entOpt.get();

        AssessmentMappingTier wave = tierService.resolveActiveTier(
                tierRepository.findByMappingIdAndIsFreeAndIsActiveOrderBySortOrderAsc(ent.getMappingId(), false, true));

        Map<String, Object> resp = new HashMap<>();
        resp.put("entitlementId", entitlementId);
        if (wave == null || wave.getAmount() == null || wave.getAmount() <= 0) {
            resp.put("available", false);
            return ResponseEntity.ok(resp);
        }
        resp.put("available", true);
        resp.put("amount", wave.getAmount());
        resp.put("tierName", wave.getName());
        resp.put("inclusions", inclusionsOf(wave));
        // What the student already has (so the SPA can show only the delta).
        Map<String, Object> current = new HashMap<>();
        current.put("finalReportActive", Boolean.TRUE.equals(ent.getFinalReportActive()));
        current.put("dashboardActive", Boolean.TRUE.equals(ent.getDashboardActive()));
        current.put("counsellingActive", Boolean.TRUE.equals(ent.getCounsellingActive()));
        current.put("lmsActive", Boolean.TRUE.equals(ent.getLmsActive()));
        resp.put("current", current);
        assessmentTableRepository.findById(ent.getAssessmentId())
                .ifPresent(a -> resp.put("assessmentName", a.getAssessmentName()));
        return ResponseEntity.ok(resp);
    }

    // ----- Post-assessment counselling tier selection (public) -----
    // Drives the assessment-mapping thank-you page. Tells the SPA whether the
    // student can book counselling already (paid tier included it) or must first
    // pick a counselling-bearing tier — and, per the link's payment_timing,
    // whether they pay before booking (PAY_FIRST) or at booking (PAY_LATER).
    @GetMapping("/public/counselling-options/{entitlementId}")
    public ResponseEntity<?> getCounsellingOptions(@PathVariable Long entitlementId) {
        Optional<com.kccitm.api.model.career9.b2c.StudentEntitlement> entOpt =
                studentEntitlementRepository.findById(entitlementId);
        if (!entOpt.isPresent() || entOpt.get().getCampaignId() != null
                || entOpt.get().getMappingId() == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No mapping entitlement");
        }
        return ResponseEntity.ok(buildCounsellingOptions(entOpt.get()));
    }

    // Same payload resolved by (userStudentId, assessmentId) — used by the
    // thank-you page, where a mapping student arrives via a fresh login and has
    // no entitlementId in hand (mirrors the school-counselling resolution).
    @GetMapping("/public/counselling-options-by-student")
    public ResponseEntity<?> getCounsellingOptionsByStudent(
            @RequestParam Long userStudentId, @RequestParam Long assessmentId) {
        com.kccitm.api.model.career9.b2c.StudentEntitlement ent = null;
        for (com.kccitm.api.model.career9.b2c.StudentEntitlement e : studentEntitlementRepository
                .findByUserStudentIdAndAssessmentIdOrderByCreatedAtDesc(userStudentId, assessmentId)) {
            if (e.getCampaignId() == null && e.getMappingId() != null
                    && !"revoked".equals(e.getStatus()) && !"refunded".equals(e.getStatus())) {
                ent = e;
                break;
            }
        }
        if (ent == null) {
            Map<String, Object> none = new HashMap<>();
            none.put("needsTierSelection", false);
            none.put("canBookNow", false);
            none.put("tiers", new java.util.ArrayList<>());
            return ResponseEntity.ok(none);
        }
        return ResponseEntity.ok(buildCounsellingOptions(ent));
    }

    /** Shared payload for the post-assessment counselling tier-selection screen. */
    private Map<String, Object> buildCounsellingOptions(
            com.kccitm.api.model.career9.b2c.StudentEntitlement ent) {
        AssessmentInstituteMapping mapping = mappingRepository.findById(ent.getMappingId()).orElse(null);
        String paymentTiming = mapping != null && mapping.getPaymentTiming() != null
                ? mapping.getPaymentTiming() : "PAY_FIRST";

        int total = ent.getCounsellingSessionsTotal() != null ? ent.getCounsellingSessionsTotal() : 0;
        int used = ent.getCounsellingSessionsUsed() != null ? ent.getCounsellingSessionsUsed() : 0;
        boolean canBookNow = Boolean.TRUE.equals(ent.getCounsellingActive()) && (total - used) > 0;

        Map<String, Object> resp = new HashMap<>();
        resp.put("entitlementId", ent.getEntitlementId());
        resp.put("paymentTiming", paymentTiming);
        resp.put("counsellingActive", Boolean.TRUE.equals(ent.getCounsellingActive()));
        resp.put("sessionsRemaining", Math.max(0, total - used));
        resp.put("canBookNow", canBookNow);
        // Token the SPA reuses to call the shared counselling slots/book endpoints
        // (only meaningful once the entitlement is active with counselling).
        resp.put("accessToken", canBookNow ? ent.getAccessToken() : null);
        assessmentTableRepository.findById(ent.getAssessmentId())
                .ifPresent(a -> resp.put("assessmentName", a.getAssessmentName()));

        // Counselling-bearing paid tiers the student may pick to unlock a session.
        // For PAY_LATER, this is also the tier the slot picker books against (it charges
        // the per-slot counselling fee, not the tier price).
        List<Map<String, Object>> tiers = new java.util.ArrayList<>();
        Integer counsellingFeePerSession = ent.getCounsellingPrice();
        if (!canBookNow) {
            for (AssessmentMappingTier t : tierRepository
                    .findByMappingIdAndIsFreeAndIsActiveOrderBySortOrderAsc(ent.getMappingId(), false, true)) {
                if (!Boolean.TRUE.equals(t.getIncludesCounselling())) continue;
                if (t.getAmount() == null || t.getAmount() <= 0) continue;
                Map<String, Object> tm = new HashMap<>();
                tm.put("tierId", t.getTierId());
                tm.put("name", t.getName());
                tm.put("description", t.getDescription());
                tm.put("amount", t.getAmount());
                tm.put("counsellingPrice", t.getCounsellingPrice());
                tm.put("inclusions", inclusionsOf(t));
                tiers.add(tm);
                // Fall back to the tier's configured per-session fee when the entitlement
                // hasn't snapshotted one (e.g. free-link registration that later pays).
                if (counsellingFeePerSession == null) counsellingFeePerSession = t.getCounsellingPrice();
            }
        }
        resp.put("needsTierSelection", !canBookNow);
        resp.put("tiers", tiers);
        // PAY_LATER per-slot fee + flag: the SPA shows "₹X / session" and pays it at booking.
        resp.put("counsellingFeePerSession", counsellingFeePerSession);
        resp.put("payPerSlot", "PAY_LATER".equals(paymentTiming) && !canBookNow
                && counsellingFeePerSession != null && counsellingFeePerSession > 0);
        return resp;
    }

    // ----- PAY_LATER counselling: list slots before payment, then hold + pay -----

    // Lists available counselling slots for the student's institute BEFORE payment
    // (the shared campaign slots endpoint requires counselling already active, which
    // it isn't yet under PAY_LATER). `from` is yyyy-MM-dd; defaults to today.
    @GetMapping("/public/counselling-slots")
    public ResponseEntity<?> getPayLaterSlots(@RequestParam Long entitlementId,
            @RequestParam(required = false) String from) {
        com.kccitm.api.model.career9.b2c.StudentEntitlement ent =
                studentEntitlementRepository.findById(entitlementId).orElse(null);
        if (ent == null || ent.getCampaignId() != null || ent.getMappingId() == null
                || ent.getUserStudentId() == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No mapping entitlement");
        }
        UserStudent us = userStudentRepository.findById(ent.getUserStudentId()).orElse(null);
        Integer instituteCode = us != null && us.getStudentInfo() != null
                ? us.getStudentInfo().getInstituteId() : null;
        if (instituteCode == null) {
            return ResponseEntity.ok(java.util.Collections.singletonMap("slots", new java.util.ArrayList<>()));
        }
        java.time.LocalDate weekStart;
        try {
            weekStart = from != null && !from.isEmpty() ? java.time.LocalDate.parse(from) : java.time.LocalDate.now();
        } catch (Exception e) {
            weekStart = java.time.LocalDate.now();
        }
        List<Map<String, Object>> slots = new java.util.ArrayList<>();
        for (com.kccitm.api.model.career9.counselling.CounsellingSlot s :
                bookingService.getAvailableSlotsForInstitute(weekStart, instituteCode, ent.getAssessmentId())) {
            Map<String, Object> sm = new HashMap<>();
            sm.put("slotId", s.getId());
            sm.put("date", s.getDate() != null ? s.getDate().toString() : null);
            sm.put("startTime", s.getStartTime() != null ? s.getStartTime().toString() : null);
            sm.put("endTime", s.getEndTime() != null ? s.getEndTime().toString() : null);
            sm.put("durationMinutes", s.getDurationMinutes());
            sm.put("counsellorName", s.getCounsellor() != null ? s.getCounsellor().getName() : null);
            sm.put("mode", s.getMode());
            slots.add(sm);
        }
        return ResponseEntity.ok(java.util.Collections.singletonMap("slots", slots));
    }

    // PAY_LATER booking: hold the chosen slot, create a Razorpay payment for the
    // chosen counselling tier, and stash the held slot + contact on the txn. The
    // webhook activates the entitlement AND finalises the appointment on success.
    @PostMapping("/public/pay-later-book")
    @Transactional
    public ResponseEntity<?> payLaterBook(@RequestBody Map<String, Object> body) {
        if (body.get("entitlementId") == null || body.get("tierId") == null || body.get("slotId") == null) {
            return ResponseEntity.badRequest().body("entitlementId, tierId and slotId are required");
        }
        Long entitlementId = Long.valueOf(body.get("entitlementId").toString());
        Long tierId = Long.valueOf(body.get("tierId").toString());
        Long slotId = Long.valueOf(body.get("slotId").toString());

        com.kccitm.api.model.career9.b2c.StudentEntitlement ent =
                studentEntitlementRepository.findById(entitlementId).orElse(null);
        if (ent == null || ent.getCampaignId() != null || ent.getMappingId() == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No mapping entitlement");
        }
        AssessmentInstituteMapping mapping = mappingRepository.findById(ent.getMappingId()).orElse(null);
        if (mapping == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Mapping not found");
        }
        AssessmentMappingTier tier = tierRepository.findById(tierId).orElse(null);
        if (tier == null || !ent.getMappingId().equals(tier.getMappingId())
                || Boolean.TRUE.equals(tier.getIsFree()) || !Boolean.TRUE.equals(tier.getIsActive())
                || !Boolean.TRUE.equals(tier.getIncludesCounselling())) {
            return ResponseEntity.badRequest().body("Invalid counselling tier");
        }
        // PAY_LATER charges the per-slot counselling fee, NOT the whole tier price.
        // Prefer the fee snapshotted on the entitlement at registration; fall back to
        // the tier's configured counselling price.
        Long counsellingFee = ent.getCounsellingPrice() != null ? ent.getCounsellingPrice().longValue()
                : (tier.getCounsellingPrice() != null ? tier.getCounsellingPrice().longValue() : null);
        if (counsellingFee == null || counsellingFee <= 0) {
            return ResponseEntity.badRequest().body("Counselling fee is not configured for this link");
        }

        // Resolve student contact (prefer the posted contact, fall back to record).
        String name = strOrNull(body.get("contactName"));
        String phone = strOrNull(body.get("contactPhone"));
        String email = strOrNull(body.get("contactEmail"));
        String method = strOrNull(body.get("preferredContactMethod"));
        Date dob = null;
        if (ent.getUserStudentId() != null) {
            UserStudent us = userStudentRepository.findById(ent.getUserStudentId()).orElse(null);
            if (us != null && us.getStudentInfo() != null) {
                StudentInfo si = us.getStudentInfo();
                if (name == null) name = si.getName();
                if (email == null) email = si.getEmail();
                if (phone == null) phone = si.getPhoneNumber();
                dob = si.getStudentDob();
            }
        }

        // Hold the slot first so it can't be taken during the payment round-trip.
        try {
            bookingService.holdSlot(slotId);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Selected slot is no longer available. Please pick another.");
        }

        try {
            String assessmentName = assessmentTableRepository.findById(ent.getAssessmentId())
                    .map(a -> a.getAssessmentName()).orElse("Assessment");
            String callbackUrl = callbackBaseUrl + "/payment-status";

            PaymentTransaction txn = new PaymentTransaction();
            txn.setMappingId(mapping.getMappingId());
            txn.setMappingTierId(tier.getTierId());
            txn.setAmount(counsellingFee);
            txn.setOriginalAmount(counsellingFee);
            txn.setAssessmentId(ent.getAssessmentId());
            txn.setInstituteCode(mapping.getInstituteCode());
            txn.setUserStudentId(ent.getUserStudentId());
            txn.setPurchasePath("U");
            // Route the webhook through the PAY_LATER finaliser: confirm the held slot
            // WITHOUT activating the tier's included counselling pool (each PAY_LATER slot
            // is paid for individually), but LINK it to the mapping entitlement so the
            // thank-you page can show the "already booked" state.
            txn.setPurpose("COUNSELLING_PAYLATER");
            txn.setStudentName(name);
            txn.setStudentEmail(email);
            txn.setStudentDob(dob);
            txn.setStudentPhone(phone);
            // Held slot + contact for the webhook to finalise on payment success.
            txn.setCounsellingSlotId(slotId);
            txn.setCounsellingContactName(name);
            txn.setCounsellingContactPhone(phone);
            txn.setCounsellingContactEmail(email);
            txn.setCounsellingContactMethod(method);
            txn.setStatus("created");
            txn = paymentTransactionWriter.saveInNewTransaction(txn);

            String referenceId = "PLB-" + entitlementId + "-" + txn.getTransactionId()
                    + "-" + java.util.UUID.randomUUID().toString().substring(0, 6);
            Map<String, String> notes = new HashMap<>();
            notes.put("mappingId", String.valueOf(mapping.getMappingId()));
            notes.put("entitlementId", String.valueOf(entitlementId));
            notes.put("transactionId", String.valueOf(txn.getTransactionId()));
            notes.put("counsellingSlotId", String.valueOf(slotId));

            Map<String, String> rzpResponse = razorpayService.createPaymentLink(
                    counsellingFee, "INR", assessmentName + " - Counselling",
                    callbackUrl, referenceId, notes);

            txn.setRazorpayLinkId(rzpResponse.get("linkId"));
            txn.setPaymentLinkUrl(rzpResponse.get("shortUrl"));
            txn.setShortUrl(rzpResponse.get("shortUrl"));
            txn = paymentTransactionWriter.saveInNewTransaction(txn);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "payment_required");
            response.put("paymentUrl", rzpResponse.get("shortUrl"));
            response.put("transactionId", txn.getTransactionId());
            response.put("amount", counsellingFee);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            // Roll the hold back so the slot isn't stuck if link creation failed.
            try { bookingService.releaseHeldSlot(slotId); } catch (Exception ignore) {}
            logger.error("Failed to create pay-later counselling payment link: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to start payment. Please try again.");
        }
    }

    private static String strOrNull(Object o) {
        if (o == null) return null;
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }

    @PostMapping("/public/pay-for-upgrade")
    public ResponseEntity<?> payForUpgrade(@RequestBody Map<String, Object> body) {
        if (body.get("entitlementId") == null) {
            return ResponseEntity.badRequest().body("entitlementId is required");
        }
        Long entitlementId = Long.valueOf(body.get("entitlementId").toString());
        Optional<com.kccitm.api.model.career9.b2c.StudentEntitlement> entOpt =
                studentEntitlementRepository.findById(entitlementId);
        if (!entOpt.isPresent() || entOpt.get().getCampaignId() != null
                || entOpt.get().getMappingId() == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No upgradable entitlement");
        }
        com.kccitm.api.model.career9.b2c.StudentEntitlement ent = entOpt.get();

        Optional<AssessmentInstituteMapping> mappingOpt = mappingRepository.findById(ent.getMappingId());
        if (!mappingOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Mapping not found");
        }
        AssessmentInstituteMapping mapping = mappingOpt.get();

        // The student may pick a specific tier from the post-assessment dropdown.
        // Validate it belongs to this mapping and is a paid, non-free tier; otherwise
        // fall back to the auto-resolved active wave (legacy "Add feature" upsell).
        AssessmentMappingTier wave;
        if (body.get("tierId") != null) {
            Long tierId = Long.valueOf(body.get("tierId").toString());
            AssessmentMappingTier chosen = tierRepository.findById(tierId).orElse(null);
            if (chosen == null || !ent.getMappingId().equals(chosen.getMappingId())
                    || Boolean.TRUE.equals(chosen.getIsFree())
                    || !Boolean.TRUE.equals(chosen.getIsActive())) {
                return ResponseEntity.badRequest().body("Invalid tier for this assessment");
            }
            wave = chosen;
        } else {
            wave = tierService.resolveActiveTier(
                    tierRepository.findByMappingIdAndIsFreeAndIsActiveOrderBySortOrderAsc(ent.getMappingId(), false, true));
        }
        if (wave == null || wave.getAmount() == null || wave.getAmount() <= 0) {
            return ResponseEntity.badRequest().body("No upgrade is available for this assessment");
        }

        // Resolve the student's contact details for the payment link.
        String email = null, name = null;
        Date dob = null;
        if (ent.getUserStudentId() != null) {
            UserStudent us = userStudentRepository.findById(ent.getUserStudentId()).orElse(null);
            if (us != null && us.getStudentInfo() != null) {
                StudentInfo si = us.getStudentInfo();
                email = si.getEmail();
                name = si.getName();
                dob = si.getStudentDob();
            }
        }

        try {
            String assessmentName = assessmentTableRepository.findById(ent.getAssessmentId())
                    .map(a -> a.getAssessmentName()).orElse("Assessment");
            String callbackUrl = callbackBaseUrl + "/payment-status";

            PaymentTransaction txn = new PaymentTransaction();
            txn.setMappingId(mapping.getMappingId());
            txn.setMappingTierId(wave.getTierId());
            txn.setAmount(wave.getAmount());
            txn.setOriginalAmount(wave.getAmount());
            txn.setAssessmentId(ent.getAssessmentId());
            txn.setInstituteCode(mapping.getInstituteCode());
            // Upgrade marker: an existing student pays → the webhook must NOT create a
            // new account, only union the entitlement. userStudentId pre-set drives that.
            txn.setUserStudentId(ent.getUserStudentId());
            txn.setPurchasePath("U");
            txn.setStudentName(name);
            txn.setStudentEmail(email);
            txn.setStudentDob(dob);
            txn.setStatus("created");
            txn = paymentTransactionWriter.saveInNewTransaction(txn);

            String referenceId = "UPG-" + entitlementId + "-" + txn.getTransactionId()
                    + "-" + java.util.UUID.randomUUID().toString().substring(0, 6);
            Map<String, String> notes = new HashMap<>();
            notes.put("mappingId", String.valueOf(mapping.getMappingId()));
            notes.put("entitlementId", String.valueOf(entitlementId));
            notes.put("transactionId", String.valueOf(txn.getTransactionId()));
            notes.put("upgrade", "true");

            Map<String, String> rzpResponse = razorpayService.createPaymentLink(
                    wave.getAmount(), "INR", assessmentName + " - Upgrade",
                    callbackUrl, referenceId, notes);

            txn.setRazorpayLinkId(rzpResponse.get("linkId"));
            txn.setPaymentLinkUrl(rzpResponse.get("shortUrl"));
            txn.setShortUrl(rzpResponse.get("shortUrl"));
            txn = paymentTransactionWriter.saveInNewTransaction(txn);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "payment_required");
            response.put("paymentUrl", rzpResponse.get("shortUrl"));
            response.put("transactionId", txn.getTransactionId());
            response.put("amount", wave.getAmount());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to create upgrade payment link: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to create upgrade payment link. Please try again.");
        }
    }

    /**
     * Create a PaymentTransaction and Razorpay payment link, return payment URL.
     */
    private ResponseEntity<?> createPaymentAndRedirect(Long mappingId, Long assessmentId, Integer instituteCode,
            Long finalAmountInr, Long originalAmountInr, String promoCodeStr, Integer promoDiscountPercent,
            String name, String email, Date dob, String dobStr, String phone, String gender, Long mappingTierId) {
        try {
            String assessmentName = assessmentTableRepository.findById(assessmentId)
                    .map(a -> a.getAssessmentName()).orElse("Assessment");

            String callbackUrl = callbackBaseUrl + "/payment-status";

            // PAY1: persist a 'created' txn in its own committed transaction BEFORE
            // the irreversible Razorpay link call, so a recoverable DB record always
            // exists first (no orphan payable link if a later commit fails).
            PaymentTransaction txn = new PaymentTransaction();
            txn.setMappingId(mappingId);
            txn.setAmount(finalAmountInr);
            txn.setOriginalAmount(originalAmountInr);
            txn.setAssessmentId(assessmentId);
            txn.setInstituteCode(instituteCode);
            txn.setStudentName(name);
            txn.setStudentEmail(email);
            txn.setStudentDob(dob);
            txn.setStudentPhone(phone);
            txn.setStatus("created");
            txn.setMappingTierId(mappingTierId);
            if (promoCodeStr != null && !promoCodeStr.trim().isEmpty()) {
                txn.setPromoCode(promoCodeStr.trim().toUpperCase());
                txn.setPromoDiscountPercent(promoDiscountPercent);
            }
            txn = paymentTransactionWriter.saveInNewTransaction(txn);

            String referenceId = "MAP-" + mappingId + "-" + txn.getTransactionId()
                    + "-" + java.util.UUID.randomUUID().toString().substring(0, 6);

            Map<String, String> notes = new HashMap<>();
            notes.put("mappingId", String.valueOf(mappingId));
            notes.put("assessmentId", String.valueOf(assessmentId));
            notes.put("instituteCode", String.valueOf(instituteCode));
            notes.put("studentEmail", email);
            notes.put("studentName", name);
            // Lets the webhook recover this txn by id if the link-id update below
            // never commits (PAY1 fallback).
            notes.put("transactionId", String.valueOf(txn.getTransactionId()));

            Map<String, String> rzpResponse = razorpayService.createPaymentLink(
                    finalAmountInr, "INR", assessmentName + " - Payment",
                    callbackUrl, referenceId, notes);

            // Stamp the link ids and commit again.
            txn.setRazorpayLinkId((String) rzpResponse.get("linkId"));
            txn.setPaymentLinkUrl((String) rzpResponse.get("shortUrl"));
            txn.setShortUrl((String) rzpResponse.get("shortUrl"));
            txn = paymentTransactionWriter.saveInNewTransaction(txn);

            // A4: cancel any prior still-payable links for this student+assessment so a
            // resubmit (price/promo changed) can't leave multiple chargeable links live
            // at different amounts. Mirrors the school flow.
            cancelPriorOutstandingLinks(email, assessmentId, txn.getTransactionId());

            Map<String, Object> response = new HashMap<>();
            response.put("status", "payment_required");
            response.put("paymentUrl", rzpResponse.get("shortUrl"));
            response.put("transactionId", txn.getTransactionId());
            response.put("amount", finalAmountInr);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Failed to create payment link: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to create payment link. Please try again.");
        }
    }

    /**
     * Handle existing student who needs to pay.
     */
    private ResponseEntity<?> handleExistingStudentWithPayment(StudentInfo existingStudentInfo, Long assessmentId,
            Integer instituteCode, Long mappingId, Long finalAmountInr, Long originalAmountInr,
            String promoCodeStr, Integer promoDiscountPercent,
            String name, String email, Date dob, String phone, Long mappingTierId,
            HttpServletResponse httpResponse) {
        // Check if already assigned
        List<UserStudent> userStudents = userStudentRepository.findByStudentInfoId(existingStudentInfo.getId());
        if (!userStudents.isEmpty()) {
            UserStudent userStudent = userStudents.get(0);
            Optional<StudentAssessmentMapping> existingMapping = studentAssessmentMappingRepository
                    .findFirstByUserStudentUserStudentIdAndAssessmentId(
                            userStudent.getUserStudentId(), assessmentId);
            if (existingMapping.isPresent()) {
                Map<String, Object> response = new HashMap<>();
                response.put("status", "already_registered");
                response.put("message", "You are already registered for this assessment.");
                response.putAll(studentSessionService.buildSessionPayload(userStudent.getUserStudentId()));
                issueAssessmentSessionCookie(httpResponse, userStudent, assessmentId);
                return ResponseEntity.ok(response);
            }
        }

        // Not yet assigned — proceed with payment
        SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
        String dobStr = sdf.format(dob);
        return createPaymentAndRedirect(mappingId, assessmentId, instituteCode,
                finalAmountInr, originalAmountInr, promoCodeStr, promoDiscountPercent,
                name, email, dob, dobStr, phone, null, mappingTierId);
    }

    /**
     * Handle assigning assessment to an existing student.
     */
    private ResponseEntity<?> handleExistingStudent(StudentInfo existingStudentInfo, Long assessmentId,
            Integer instituteCode, Long mappingId, Long mappingTierId, HttpServletResponse httpResponse) {
        // Find UserStudent for this student
        List<UserStudent> userStudents = userStudentRepository.findByStudentInfoId(existingStudentInfo.getId());
        if (userStudents.isEmpty()) {
            // Student exists but no UserStudent — create one
            InstituteDetail institute = instituteDetailRepository.findById(instituteCode.intValue());
            User existingUser = existingStudentInfo.getUser();
            if (existingUser == null) {
                // Edge case: StudentInfo exists but no User — create User
                existingUser = new User((int) (Math.random() * 100000), existingStudentInfo.getStudentDob());
                existingUser.setName(existingStudentInfo.getName());
                existingUser.setEmail(existingStudentInfo.getEmail());
                existingUser = userRepository.save(existingUser);

                // Generate and set careerNineRollNumber
                String edgeRollNumber = rollNumberService.generateNextRollNumber(
                        instituteCode, existingStudentInfo.getSchoolSectionId());
                if (edgeRollNumber != null) {
                    existingUser.setCareerNineRollNumber(edgeRollNumber);
                    existingUser = userRepository.save(existingUser);
                }

                existingStudentInfo.setUser(existingUser);
                studentInfoRepository.save(existingStudentInfo);
            }
            UserStudent newUs = new UserStudent(existingUser, existingStudentInfo, institute);
            newUs = userStudentRepository.save(newUs);
            studentProvisioningService.provision(newUs);
            membershipService.setPrimaryInstitute(newUs, instituteCode, null, "mapping-free-provision");
            userStudents = List.of(newUs);
        }

        UserStudent userStudent = userStudents.get(0);

        // Check if already assigned
        Optional<StudentAssessmentMapping> existingMapping = studentAssessmentMappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(
                        userStudent.getUserStudentId(), assessmentId);

        Map<String, Object> response = new HashMap<>();
        if (existingMapping.isPresent()) {
            response.put("status", "already_registered");
            response.put("message", "You are already registered for this assessment.");
        } else {
            // Assign assessment
            StudentAssessmentMapping sam = new StudentAssessmentMapping(
                    userStudent.getUserStudentId(), assessmentId);
            studentAssessmentMappingRepository.save(sam);
            // Free tiered completion by an existing student: consume a tier slot and
            // record a zero-amount paid transaction so recount has a single source.
            if (mappingTierId != null) {
                tierRepository.tryIncrementCount(mappingTierId);
                PaymentTransaction freeTxn = new PaymentTransaction();
                freeTxn.setMappingId(mappingId);
                freeTxn.setMappingTierId(mappingTierId);
                freeTxn.setAmount(0L);
                freeTxn.setStatus("paid");
                freeTxn.setAssessmentId(assessmentId);
                freeTxn.setInstituteCode(instituteCode);
                freeTxn.setStudentName(existingStudentInfo.getName());
                freeTxn.setStudentEmail(existingStudentInfo.getEmail());
                freeTxn.setStudentDob(existingStudentInfo.getStudentDob());
                freeTxn.setUserStudentId(userStudent.getUserStudentId());
                freeTxn = paymentTransactionRepository.save(freeTxn);
                // Mint the service entitlement for this existing student's free assignment.
                entitlementService.activateB2BOnPayment(freeTxn.getTransactionId());
            }
            response.put("status", "success");
            response.put("message", "Assessment assigned successfully. Please use your existing credentials to log in.");
        }

        // Include login credentials
        User user = existingStudentInfo.getUser();
        if (user != null) {
            response.put("username", user.getUsername());
            SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
            String dobFormatted = user.getDobDate() != null ? sdf.format(user.getDobDate()) : "";
            response.put("dob", dobFormatted);

            // Send email for newly assigned assessments (not already registered)
            if (!"already_registered".equals(response.get("status")) && existingStudentInfo.getEmail() != null) {
                String assessmentName = assessmentTableRepository.findById(assessmentId)
                        .map(a -> a.getAssessmentName()).orElse("Assessment");
                sendRegistrationEmail(existingStudentInfo.getEmail(), existingStudentInfo.getName(),
                        user.getUsername(), dobFormatted, assessmentName);
            }
        }

        // Auto-login session payload — same shape /user/auth returns.
        response.putAll(studentSessionService.buildSessionPayload(userStudent.getUserStudentId()));
        issueAssessmentSessionCookie(httpResponse, userStudent, assessmentId);

        return ResponseEntity.ok(response);
    }

    /**
     * Issues the cn_at_asmnt HttpOnly cookie so the freshly registered /
     * auto-logged-in student is genuinely authenticated against
     * assessment-scoped endpoints (e.g. /student-demographics/**). Without
     * this the SPA holds only localStorage.userStudentId and the next
     * request to a scoped route 403s in TokenAuthenticationFilter.
     */
    private void issueAssessmentSessionCookie(HttpServletResponse httpResponse,
            UserStudent userStudent, Long assessmentId) {
        if (httpResponse == null || userStudent == null) return;
        final Long userStudentId = userStudent.getUserStudentId();
        final Long ownerUserId = userStudent.getUserId();
        Runnable issue = () -> {
            try {
                String sessionJwt = tokenProvider.createAssessmentSessionToken(
                        userStudentId, assessmentId, ownerUserId);
                authCookieService.issueAssessmentSessionCookie(httpResponse, sessionJwt,
                        (int) (assessmentTokenExpirationMsec / 1000));
            } catch (Exception e) {
                // Auto-login is a convenience: a cookie/audit hiccup must never fail
                // (or roll back) an otherwise-successful registration.
                logger.warn("Could not issue assessment session cookie for userStudent {}: {}",
                        userStudentId, e.getMessage());
            }
        };
        // Defer to AFTER the enclosing @Transactional register commits. The audit row
        // jwt_token_audit FK-references student_user (the User just inserted in this
        // transaction); running it pre-commit makes the audit's REQUIRES_NEW transaction
        // wait 50s on this transaction's X lock of that row (self-deadlock). Post-commit
        // the lock is released and the FK insert succeeds immediately. The HTTP response
        // is not flushed until after the tx interceptor returns, so the cookie still lands.
        if (org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                    new org.springframework.transaction.support.TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            issue.run();
                        }
                    });
        } else {
            issue.run();
        }
    }

    /**
     * A4: cancel prior still-payable ({@code created}) Razorpay links for this
     * student+assessment (excluding the one just created), so a resubmit can't
     * leave multiple simultaneously-chargeable links at stale prices. The
     * cancelled status is committed in its own transaction so it survives even
     * if the surrounding register transaction rolls back (the Razorpay cancel is
     * irreversible regardless).
     */
    private void cancelPriorOutstandingLinks(String email, Long assessmentId, Long keepTxnId) {
        if (email == null) return;
        for (PaymentTransaction t : paymentTransactionRepository.findByStudentEmailAndAssessmentId(email, assessmentId)) {
            if (t.getTransactionId().equals(keepTxnId)) continue;
            if (!"created".equals(t.getStatus()) || t.getRazorpayLinkId() == null) continue;
            try {
                razorpayService.cancelPaymentLink(t.getRazorpayLinkId());
                t.setStatus("cancelled");
                paymentTransactionWriter.saveInNewTransaction(t);
            } catch (Exception e) {
                logger.warn("A4: could not cancel stale link {} (txn {}): {}",
                        t.getRazorpayLinkId(), t.getTransactionId(), e.getMessage());
            }
        }
    }

    /** Atomically consume one promo use for a realized registration; no-op if absent/at-cap. */
    private void consumePromoIfPresent(String promoCode) {
        if (promoCode == null || promoCode.trim().isEmpty()) return;
        promoCodeRepository.findByCodeIgnoreCase(promoCode.trim().toUpperCase()).ifPresent(p -> {
            int rows = promoCodeRepository.tryConsume(p.getId());
            if (rows == 0) {
                logger.warn("Promo {} already at maxUses at redemption time — not consumed", promoCode);
            }
        });
    }

    /**
     * Send registration confirmation email with login credentials.
     */
    private void sendRegistrationEmail(String toEmail, String studentName, String username, String dob, String assessmentName) {
        try {
            String subject = "Registration Successful - " + assessmentName;
            String htmlContent = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>"
                    + "<div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px 12px 0 0; color: white;'>"
                    + "<h2 style='margin: 0;'>Registration Successful!</h2>"
                    + "</div>"
                    + "<div style='padding: 24px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;'>"
                    + "<p>Dear <strong>" + studentName + "</strong>,</p>"
                    + "<p>You have been successfully registered for <strong>" + assessmentName + "</strong>.</p>"
                    + "<p>Here are your login credentials:</p>"
                    + "<div style='background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;'>"
                    + "<p style='margin: 4px 0;'><strong>Username:</strong> <span style='color: #667eea; font-size: 1.1em;'>" + username + "</span></p>"
                    + "<p style='margin: 4px 0;'><strong>Password:</strong> <span style='color: #667eea; font-size: 1.1em;'>" + dob + "</span> (Your Date of Birth)</p>"
                    + "</div>"
                    + "<p style='color: #666; font-size: 0.9em;'>Please save these credentials. You will need them to log in and take the assessment.</p>"
                    + "<div style='text-align: center; margin: 24px 0;'>"
                    + "<a href='https://assessment.career-9.com/' style='display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 1em;'>Go To Assessment</a>"
                    + "</div>"
                    + "<p style='color: #999; font-size: 0.8em; margin-top: 24px;'>This is an automated email. Please do not reply.</p>"
                    + "</div>"
                    + "</div>";

            gmailApiEmailService.sendHtmlEmail(toEmail, subject, htmlContent);
            logger.info("Registration email sent to: {}", toEmail);
        } catch (Exception e) {
            logger.error("Failed to send registration email to: {}. Error: {}", toEmail, e.getMessage(), e);
            // Don't fail registration if email fails
        }
    }

    /**
     * Parse class number from SchoolClasses ID.
     * Looks up the SchoolClasses entity and tries to parse className as an integer.
     */
    private Integer parseClassNumber(Integer classId) {
        if (classId == null) return null;
        Optional<SchoolClasses> classOpt = schoolClassesRepository.findById(classId);
        if (classOpt.isPresent()) {
            String className = classOpt.get().getClassName();
            if (className != null) {
                String digits = className.replaceAll("[^0-9]", "");
                if (!digits.isEmpty()) {
                    try {
                        return Integer.parseInt(digits);
                    } catch (NumberFormatException e) {
                        logger.warn("Could not parse class number from className for classId: {}", classId);
                    }
                }
            }
        }
        // Never fall back to classId (a DB primary key) — that would corrupt studentClass
        // (B2: a non-numeric class like "Nursery"/"LKG" used to persist the PK as the grade).
        return null;
    }

    private static boolean sameDay(Date a, Date b) {
        if (a == null || b == null) return false;
        java.util.Calendar ca = java.util.Calendar.getInstance();
        java.util.Calendar cb = java.util.Calendar.getInstance();
        ca.setTime(a);
        cb.setTime(b);
        return ca.get(java.util.Calendar.YEAR) == cb.get(java.util.Calendar.YEAR)
            && ca.get(java.util.Calendar.MONTH) == cb.get(java.util.Calendar.MONTH)
            && ca.get(java.util.Calendar.DAY_OF_MONTH) == cb.get(java.util.Calendar.DAY_OF_MONTH);
    }
}
