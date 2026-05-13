package com.kccitm.api.controller.career9.b2c;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.b2c.Campaign;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentMapping;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentTier;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentTierRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignRepository;
import com.kccitm.api.repository.Career9.b2c.PricingTierRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.service.b2c.CampaignResolutionService;

@RestController
@RequestMapping("/campaign")
public class CampaignController {

    @Autowired private CampaignRepository campaignRepository;
    @Autowired private CampaignAssessmentMappingRepository mappingRepository;
    @Autowired private CampaignAssessmentTierRepository tierMappingRepository;
    @Autowired private PricingTierRepository pricingTierRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;
    @Autowired private InstituteDetailRepository instituteDetailRepository;
    @Autowired private CampaignResolutionService campaignResolutionService;

    @PreAuthorize("@auth.allows('campaign.read.all')")
    @GetMapping("/getAll")
    public ResponseEntity<List<Campaign>> getAll() {
        return ResponseEntity.ok(campaignRepository.findByIsDeletedFalseOrderByCreatedAtDesc());
    }

    @PreAuthorize("@auth.allows('campaign.read')")
    @GetMapping("/get/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        Optional<Campaign> opt = campaignRepository.findById(id);
        if (!opt.isPresent() || Boolean.TRUE.equals(opt.get().getIsDeleted())) {
            return ResponseEntity.notFound().build();
        }
        Campaign c = opt.get();
        Map<String, Object> response = toFullDto(c);
        return ResponseEntity.ok(response);
    }

    @PreAuthorize("@auth.allows('campaign.read')")
    @GetMapping("/get/by-slug/{slug}")
    public ResponseEntity<?> getBySlug(@PathVariable String slug) {
        Optional<Campaign> opt = campaignRepository.findBySlugIgnoreCaseAndIsDeletedFalse(slug);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(toFullDto(opt.get()));
    }

    @PreAuthorize("@auth.allows('campaign.create')")
    @PostMapping("/create")
    public ResponseEntity<?> create(@RequestBody Campaign body) {
        if (body.getName() == null || body.getName().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Campaign name is required");
        }
        if (body.getSlug() == null || body.getSlug().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Slug is required");
        }
        // New campaigns must be mapped to an institute. Legacy campaigns are
        // grandfathered (handled in update() — see below) until the admin
        // backfills them, after which Phase 2 migration enforces NOT NULL.
        if (body.getInstituteCode() == null) {
            return ResponseEntity.badRequest().body("Institute is required");
        }
        if (instituteDetailRepository.findById(body.getInstituteCode()) == null) {
            return ResponseEntity.badRequest().body("Selected institute does not exist");
        }
        String slug = body.getSlug().trim().toLowerCase().replaceAll("[^a-z0-9-]", "-");
        if (campaignRepository.findBySlugIgnoreCase(slug).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Slug already in use");
        }
        body.setCampaignId(null);
        body.setSlug(slug);
        normalizeDefaults(body);
        Campaign saved = campaignRepository.save(body);
        return ResponseEntity.ok(saved);
    }

    @PreAuthorize("@auth.allows('campaign.update')")
    @PutMapping("/update/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Map<String, Object> req) {
        Optional<Campaign> opt = campaignRepository.findById(id);
        if (!opt.isPresent() || Boolean.TRUE.equals(opt.get().getIsDeleted())) {
            return ResponseEntity.notFound().build();
        }
        Campaign c = opt.get();
        if (req.containsKey("name")) c.setName((String) req.get("name"));
        if (req.containsKey("slug")) {
            String slug = ((String) req.get("slug")).trim().toLowerCase().replaceAll("[^a-z0-9-]", "-");
            Optional<Campaign> existing = campaignRepository.findBySlugIgnoreCase(slug);
            if (existing.isPresent() && !existing.get().getCampaignId().equals(id)) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body("Slug already in use");
            }
            c.setSlug(slug);
        }
        if (req.containsKey("brandLogoUrl")) c.setBrandLogoUrl((String) req.get("brandLogoUrl"));
        if (req.containsKey("targetAudience")) c.setTargetAudience((String) req.get("targetAudience"));
        if (req.containsKey("description")) c.setDescription((String) req.get("description"));
        if (req.containsKey("validFrom")) c.setValidFrom(parseDate((String) req.get("validFrom")));
        if (req.containsKey("validTo")) c.setValidTo(parseDate((String) req.get("validTo")));
        if (req.containsKey("defaultPurchasePath")) c.setDefaultPurchasePath((String) req.get("defaultPurchasePath"));
        if (req.containsKey("defaultCounsellingModel")) c.setDefaultCounsellingModel((String) req.get("defaultCounsellingModel"));
        if (req.containsKey("instituteCode")) {
            Integer instituteCode = toInt(req.get("instituteCode"));
            // Editing a campaign cannot blank out an institute that's already set.
            // Legacy campaigns (NULL) must be filled in; once filled they stay required.
            if (instituteCode == null) {
                return ResponseEntity.badRequest().body("Institute is required");
            }
            if (instituteDetailRepository.findById(instituteCode) == null) {
                return ResponseEntity.badRequest().body("Selected institute does not exist");
            }
            c.setInstituteCode(instituteCode);
        }
        if (req.containsKey("isActive")) c.setIsActive((Boolean) req.get("isActive"));
        normalizeDefaults(c);
        return ResponseEntity.ok(campaignRepository.save(c));
    }

    @PreAuthorize("@auth.allows('campaign.delete')")
    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> softDelete(@PathVariable Long id) {
        Optional<Campaign> opt = campaignRepository.findById(id);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        Campaign c = opt.get();
        c.setIsDeleted(true);
        c.setIsActive(false);
        campaignRepository.save(c);
        return ResponseEntity.ok("Campaign deleted");
    }

    @PreAuthorize("@auth.allows('campaign.read')")
    @GetMapping("/{id}/resolved/{assessmentId}")
    public ResponseEntity<?> resolved(@PathVariable Long id, @PathVariable Long assessmentId) {
        Map<String, Object> response = campaignResolutionService.resolve(id, assessmentId);
        if (response == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(response);
    }

    @PreAuthorize("@auth.allows('campaign.update')")
    @PostMapping("/{campaignId}/assessment")
    public ResponseEntity<?> attachAssessment(@PathVariable Long campaignId,
                                              @RequestBody Map<String, Object> req) {
        if (!campaignRepository.findById(campaignId).isPresent()) {
            return ResponseEntity.notFound().build();
        }
        Long assessmentId = toLong(req.get("assessmentId"));
        if (assessmentId == null) return ResponseEntity.badRequest().body("assessmentId is required");

        Optional<CampaignAssessmentMapping> existing = mappingRepository
                .findByCampaignIdAndAssessmentIdAndIsDeletedFalse(campaignId, assessmentId);
        if (existing.isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Assessment already attached");
        }

        CampaignAssessmentMapping m = new CampaignAssessmentMapping();
        m.setCampaignId(campaignId);
        m.setAssessmentId(assessmentId);
        m.setPurchasePath(normalizePath((String) req.get("purchasePath")));
        m.setCounsellingModel(normalizeModel((String) req.get("counsellingModel")));
        if (req.containsKey("sortOrder")) m.setSortOrder(toInt(req.get("sortOrder")));
        return ResponseEntity.ok(mappingRepository.save(m));
    }

    @PreAuthorize("@auth.allows('campaign.update')")
    @PutMapping("/assessment/{mappingId}")
    public ResponseEntity<?> updateMapping(@PathVariable Long mappingId,
                                           @RequestBody Map<String, Object> req) {
        Optional<CampaignAssessmentMapping> opt = mappingRepository.findById(mappingId);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        CampaignAssessmentMapping m = opt.get();
        if (req.containsKey("purchasePath")) m.setPurchasePath(normalizePath((String) req.get("purchasePath")));
        if (req.containsKey("counsellingModel")) m.setCounsellingModel(normalizeModel((String) req.get("counsellingModel")));
        if (req.containsKey("sortOrder")) m.setSortOrder(toInt(req.get("sortOrder")));
        if (req.containsKey("isActive")) m.setIsActive((Boolean) req.get("isActive"));
        return ResponseEntity.ok(mappingRepository.save(m));
    }

    @PreAuthorize("@auth.allows('campaign.update')")
    @DeleteMapping("/assessment/{mappingId}")
    public ResponseEntity<?> detachAssessment(@PathVariable Long mappingId) {
        Optional<CampaignAssessmentMapping> opt = mappingRepository.findById(mappingId);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        CampaignAssessmentMapping m = opt.get();
        m.setIsDeleted(true);
        m.setIsActive(false);
        mappingRepository.save(m);
        return ResponseEntity.ok("Assessment detached");
    }

    @PreAuthorize("@auth.allows('campaign.update')")
    @PostMapping("/assessment/{mappingId}/tier")
    public ResponseEntity<?> attachTier(@PathVariable Long mappingId,
                                        @RequestBody Map<String, Object> req) {
        if (!mappingRepository.findById(mappingId).isPresent()) {
            return ResponseEntity.notFound().build();
        }
        Long pricingTierId = toLong(req.get("pricingTierId"));
        if (pricingTierId == null) return ResponseEntity.badRequest().body("pricingTierId is required");
        if (!pricingTierRepository.findById(pricingTierId).isPresent()) {
            return ResponseEntity.badRequest().body("pricingTierId not found");
        }

        Optional<CampaignAssessmentTier> existing = tierMappingRepository
                .findByCampaignAssessmentMappingIdAndPricingTierId(mappingId, pricingTierId);
        CampaignAssessmentTier tm = existing.orElseGet(CampaignAssessmentTier::new);
        tm.setCampaignAssessmentMappingId(mappingId);
        tm.setPricingTierId(pricingTierId);
        if (req.containsKey("priceOverrideInr")) tm.setPriceOverrideInr(toLong(req.get("priceOverrideInr")));
        if (req.containsKey("isDefault")) tm.setIsDefault((Boolean) req.get("isDefault"));
        if (req.containsKey("isActive")) tm.setIsActive((Boolean) req.get("isActive"));

        // Enforce single default per mapping
        if (Boolean.TRUE.equals(tm.getIsDefault())) {
            List<CampaignAssessmentTier> all = tierMappingRepository.findByCampaignAssessmentMappingIdOrderByIdAsc(mappingId);
            for (CampaignAssessmentTier other : all) {
                if (!other.getId().equals(tm.getId()) && Boolean.TRUE.equals(other.getIsDefault())) {
                    other.setIsDefault(false);
                    tierMappingRepository.save(other);
                }
            }
        }
        return ResponseEntity.ok(tierMappingRepository.save(tm));
    }

    @PreAuthorize("@auth.allows('campaign.update')")
    @DeleteMapping("/assessment/tier/{tierMapId}")
    public ResponseEntity<?> detachTier(@PathVariable Long tierMapId) {
        Optional<CampaignAssessmentTier> opt = tierMappingRepository.findById(tierMapId);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        CampaignAssessmentTier tm = opt.get();
        tm.setIsActive(false);
        tierMappingRepository.save(tm);
        return ResponseEntity.ok("Tier detached");
    }

    private Map<String, Object> toFullDto(Campaign c) {
        Map<String, Object> out = new HashMap<>();
        out.put("campaign", c);

        // Resolve institute name for display so the edit page can show the
        // currently-mapped institute without a second round trip.
        if (c.getInstituteCode() != null) {
            com.kccitm.api.model.career9.school.InstituteDetail inst =
                    instituteDetailRepository.findById((int) c.getInstituteCode());
            if (inst != null) {
                Map<String, Object> instDto = new HashMap<>();
                instDto.put("instituteCode", inst.getInstituteCode());
                instDto.put("instituteName", inst.getInstituteName());
                out.put("institute", instDto);
            }
        }

        List<CampaignAssessmentMapping> mappings = mappingRepository
                .findByCampaignIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(c.getCampaignId());
        List<Map<String, Object>> rows = new ArrayList<>();
        for (CampaignAssessmentMapping m : mappings) {
            Map<String, Object> row = new HashMap<>();
            row.put("mappingId", m.getId());
            row.put("assessmentId", m.getAssessmentId());
            AssessmentTable a = assessmentTableRepository.findById(m.getAssessmentId()).orElse(null);
            row.put("assessmentName", a != null ? a.getAssessmentName() : null);
            row.put("purchasePath", m.getPurchasePath());
            row.put("counsellingModel", m.getCounsellingModel());
            row.put("isActive", m.getIsActive());
            row.put("sortOrder", m.getSortOrder());
            List<CampaignAssessmentTier> tiers = tierMappingRepository
                    .findByCampaignAssessmentMappingIdOrderByIdAsc(m.getId());
            row.put("tiers", tiers);
            rows.add(row);
        }
        out.put("assessments", rows);
        return out;
    }

    private static void normalizeDefaults(Campaign c) {
        c.setDefaultPurchasePath(normalizePath(c.getDefaultPurchasePath()));
        c.setDefaultCounsellingModel(normalizeModel(c.getDefaultCounsellingModel()));
    }

    private static String normalizePath(String s) {
        if (s == null) return null;
        s = s.trim().toUpperCase();
        return ("A".equals(s) || "B".equals(s)) ? s : null;
    }

    private static String normalizeModel(String s) {
        if (s == null) return null;
        s = s.trim();
        return ("1".equals(s) || "2".equals(s)) ? s : null;
    }

    private static java.util.Date parseDate(String s) {
        if (s == null || s.isEmpty()) return null;
        try { return new SimpleDateFormat("dd-MM-yyyy").parse(s); }
        catch (Exception e) { return null; }
    }

    private static Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).longValue();
        return Long.parseLong(o.toString());
    }

    private static Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).intValue();
        return Integer.parseInt(o.toString());
    }
}
