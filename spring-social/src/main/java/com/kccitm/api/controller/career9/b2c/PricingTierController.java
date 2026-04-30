package com.kccitm.api.controller.career9.b2c;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.b2c.PricingTier;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentTierRepository;
import com.kccitm.api.repository.Career9.b2c.PricingTierRepository;

@RestController
@RequestMapping("/pricing-tier")
public class PricingTierController {

    @Autowired private PricingTierRepository pricingTierRepository;
    @Autowired private CampaignAssessmentTierRepository campaignAssessmentTierRepository;

    @GetMapping("/getAll")
    public ResponseEntity<List<PricingTier>> getAll() {
        return ResponseEntity.ok(pricingTierRepository.findByIsDeletedFalseOrderBySortOrderAscTierIdAsc());
    }

    @GetMapping("/getActive")
    public ResponseEntity<List<PricingTier>> getActive() {
        return ResponseEntity.ok(pricingTierRepository.findByIsDeletedFalseAndIsActiveTrueOrderBySortOrderAscTierIdAsc());
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        Optional<PricingTier> tier = pricingTierRepository.findById(id);
        if (!tier.isPresent() || Boolean.TRUE.equals(tier.get().getIsDeleted())) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(tier.get());
    }

    @PostMapping("/create")
    public ResponseEntity<?> create(@RequestBody PricingTier body) {
        if (body.getName() == null || body.getName().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Tier name is required");
        }
        if (body.getBasePriceInr() == null || body.getBasePriceInr() < 0) {
            return ResponseEntity.badRequest().body("Base price must be non-negative (in paise)");
        }
        body.setTierId(null);
        PricingTier saved = pricingTierRepository.save(body);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Map<String, Object> req) {
        Optional<PricingTier> opt = pricingTierRepository.findById(id);
        if (!opt.isPresent() || Boolean.TRUE.equals(opt.get().getIsDeleted())) {
            return ResponseEntity.notFound().build();
        }
        PricingTier t = opt.get();
        if (req.containsKey("name")) t.setName((String) req.get("name"));
        if (req.containsKey("description")) t.setDescription((String) req.get("description"));
        if (req.containsKey("basePriceInr")) t.setBasePriceInr(toLong(req.get("basePriceInr")));
        if (req.containsKey("currency")) t.setCurrency((String) req.get("currency"));
        if (req.containsKey("includesFinalReport")) t.setIncludesFinalReport((Boolean) req.get("includesFinalReport"));
        if (req.containsKey("includesDashboard")) t.setIncludesDashboard((Boolean) req.get("includesDashboard"));
        if (req.containsKey("includesCounselling")) t.setIncludesCounselling((Boolean) req.get("includesCounselling"));
        if (req.containsKey("counsellingSessionCount")) t.setCounsellingSessionCount(toInt(req.get("counsellingSessionCount")));
        if (req.containsKey("includesLms")) t.setIncludesLms((Boolean) req.get("includesLms"));
        if (req.containsKey("lmsValidityDays")) t.setLmsValidityDays(toInt(req.get("lmsValidityDays")));
        if (req.containsKey("dashboardValidityDays")) t.setDashboardValidityDays(toInt(req.get("dashboardValidityDays")));
        if (req.containsKey("sortOrder")) t.setSortOrder(toInt(req.get("sortOrder")));
        if (req.containsKey("isActive")) t.setIsActive((Boolean) req.get("isActive"));
        return ResponseEntity.ok(pricingTierRepository.save(t));
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> softDelete(@PathVariable Long id) {
        Optional<PricingTier> opt = pricingTierRepository.findById(id);
        if (!opt.isPresent()) return ResponseEntity.notFound().build();
        long inUse = campaignAssessmentTierRepository.countByPricingTierIdAndIsActiveTrue(id);
        if (inUse > 0) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Tier is in use by " + inUse + " active campaign-assessment mapping(s)");
        }
        PricingTier t = opt.get();
        t.setIsDeleted(true);
        t.setIsActive(false);
        pricingTierRepository.save(t);
        return ResponseEntity.ok("Pricing tier deleted");
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
