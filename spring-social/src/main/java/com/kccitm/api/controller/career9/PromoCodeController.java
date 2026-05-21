package com.kccitm.api.controller.career9;

import java.util.Date;
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

import com.kccitm.api.model.career9.PromoCode;
import com.kccitm.api.repository.Career9.PromoCodeRepository;

@RestController
@RequestMapping("/promo-codes")
public class PromoCodeController {

    @Autowired
    private PromoCodeRepository promoCodeRepository;

    @Autowired
    private com.kccitm.api.repository.Career9.b2c.PromoCodeCampaignRepository promoCodeCampaignRepository;

    @PreAuthorize("@auth.allows('promo_code.create')")
    @PostMapping("/create")
    public ResponseEntity<?> createPromoCode(@RequestBody Map<String, Object> request) {
        String code = (String) request.get("code");
        Integer discountPercent = (Integer) request.get("discountPercent");

        if (code == null || code.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Promo code is required");
        }
        if (discountPercent == null || discountPercent < 1 || discountPercent > 100) {
            return ResponseEntity.badRequest().body("Discount percent must be between 1 and 100");
        }

        Optional<PromoCode> existing = promoCodeRepository.findByCodeIgnoreCase(code.trim().toUpperCase());
        if (existing.isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Promo code already exists");
        }

        PromoCode promo = new PromoCode();
        promo.setCode(code.trim().toUpperCase());
        promo.setDiscountPercent(discountPercent);
        promo.setDescription((String) request.get("description"));

        if (request.get("maxUses") != null) {
            promo.setMaxUses((Integer) request.get("maxUses"));
        }
        if (request.get("expiresAt") != null) {
            try {
                long ts = Long.parseLong(request.get("expiresAt").toString());
                promo.setExpiresAt(new Date(ts));
            } catch (NumberFormatException e) {
                // ignore invalid date
            }
        }

        PromoCode saved = promoCodeRepository.save(promo);
        return ResponseEntity.ok(saved);
    }

    @PreAuthorize("@auth.allows('promo_code.read.all')")
    @GetMapping("/getAll")
    public ResponseEntity<List<PromoCode>> getAllPromoCodes() {
        return ResponseEntity.ok(promoCodeRepository.findAllByOrderByCreatedAtDesc());
    }

    @PreAuthorize("@auth.allows('promo_code.read')")
    @GetMapping("/get/{id}")
    public ResponseEntity<?> getPromoCodeById(@PathVariable Long id) {
        Optional<PromoCode> promo = promoCodeRepository.findById(id);
        if (!promo.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(promo.get());
    }

    @PreAuthorize("@auth.allows('promo_code.update')")
    @PutMapping("/update/{id}")
    public ResponseEntity<?> updatePromoCode(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        Optional<PromoCode> optPromo = promoCodeRepository.findById(id);
        if (!optPromo.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        PromoCode promo = optPromo.get();

        if (request.containsKey("code")) {
            String newCode = ((String) request.get("code")).trim().toUpperCase();
            Optional<PromoCode> existing = promoCodeRepository.findByCodeIgnoreCase(newCode);
            if (existing.isPresent() && !existing.get().getId().equals(id)) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body("Promo code already exists");
            }
            promo.setCode(newCode);
        }
        if (request.containsKey("discountPercent")) {
            Integer dp = (Integer) request.get("discountPercent");
            if (dp < 1 || dp > 100) {
                return ResponseEntity.badRequest().body("Discount percent must be between 1 and 100");
            }
            promo.setDiscountPercent(dp);
        }
        if (request.containsKey("description")) {
            promo.setDescription((String) request.get("description"));
        }
        if (request.containsKey("isActive")) {
            promo.setIsActive((Boolean) request.get("isActive"));
        }
        if (request.containsKey("maxUses")) {
            promo.setMaxUses(request.get("maxUses") != null ? (Integer) request.get("maxUses") : null);
        }
        if (request.containsKey("expiresAt")) {
            if (request.get("expiresAt") != null) {
                try {
                    long ts = Long.parseLong(request.get("expiresAt").toString());
                    promo.setExpiresAt(new Date(ts));
                } catch (NumberFormatException e) {
                    // ignore
                }
            } else {
                promo.setExpiresAt(null);
            }
        }

        PromoCode saved = promoCodeRepository.save(promo);
        return ResponseEntity.ok(saved);
    }

    @PreAuthorize("@auth.allows('promo_code.delete')")
    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> deletePromoCode(@PathVariable Long id) {
        if (!promoCodeRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        promoCodeRepository.deleteById(id);
        return ResponseEntity.ok("Promo code deleted");
    }

    // Phase 2 (Task 2.1 / HIGH-B): genuinely anonymous landing-page promo check. @PreAuthorize
    // removed so the enforce flip won't 403 anonymous callers (permitAll + CSRF-exempt via
    // PUBLIC_PATHS); the in-body promo-code lookup is the gate. Excluded in the coverage test.
    @PostMapping("/public/validate")
    public ResponseEntity<?> validatePromoCode(@RequestBody Map<String, Object> request) {
        Object codeObj = request.get("code");
        if (codeObj == null || codeObj.toString().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Promo code is required");
        }
        String code = codeObj.toString().trim().toUpperCase();

        Optional<PromoCode> optPromo = promoCodeRepository.findByCodeIgnoreCaseAndIsActive(code, true);
        if (!optPromo.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Invalid promo code");
        }
        PromoCode promo = optPromo.get();

        // Campaign-scoping check
        Object campaignIdObj = request.get("campaignId");
        Long campaignId = null;
        if (campaignIdObj != null) {
            try { campaignId = Long.valueOf(campaignIdObj.toString()); }
            catch (NumberFormatException e) { return ResponseEntity.badRequest().body("Invalid campaignId"); }
        }
        boolean codeIsCampaignScoped = promoCodeCampaignRepository.existsByPromoCodeId(promo.getId());

        if (campaignId != null) {
            // B2C flow — code must be mapped to this campaign
            if (!codeIsCampaignScoped
                    || !promoCodeCampaignRepository.existsByPromoCodeIdAndCampaignId(promo.getId(), campaignId)) {
                return ResponseEntity.badRequest().body("Code not valid for this campaign");
            }
        } else {
            // School flow — code must NOT be campaign-scoped
            if (codeIsCampaignScoped) {
                return ResponseEntity.badRequest().body(
                    "This code is for a specific campaign — open the campaign link to use it");
            }
        }

        if (promo.getExpiresAt() != null && promo.getExpiresAt().before(new Date())) {
            return ResponseEntity.status(HttpStatus.GONE).body("Promo code has expired");
        }
        if (promo.getMaxUses() != null && promo.getCurrentUses() >= promo.getMaxUses()) {
            return ResponseEntity.status(HttpStatus.GONE).body("Promo code usage limit reached");
        }

        Map<String, Object> response = new HashMap<>();
        response.put("code", promo.getCode());
        response.put("discountPercent", promo.getDiscountPercent());
        response.put("valid", true);
        return ResponseEntity.ok(response);
    }

    @PreAuthorize("@auth.allows('promo_code.update')")
    @PutMapping("/{id}/campaigns")
    public ResponseEntity<?> setCampaigns(@PathVariable Long id, @RequestBody Map<String, Object> req) {
        if (!promoCodeRepository.findById(id).isPresent()) {
            return ResponseEntity.notFound().build();
        }
        Object raw = req.get("campaignIds");
        List<Long> campaignIds = new java.util.ArrayList<>();
        if (raw instanceof List) {
            for (Object o : (List<?>) raw) {
                if (o == null) continue;
                try { campaignIds.add(Long.valueOf(o.toString())); }
                catch (NumberFormatException e) {
                    return ResponseEntity.badRequest().body("campaignIds must be a list of numbers");
                }
            }
        } else if (raw != null) {
            return ResponseEntity.badRequest().body("campaignIds must be a list");
        }

        promoCodeCampaignRepository.deleteByPromoCodeId(id);
        for (Long cid : campaignIds) {
            com.kccitm.api.model.career9.b2c.PromoCodeCampaign m =
                new com.kccitm.api.model.career9.b2c.PromoCodeCampaign();
            m.setPromoCodeId(id);
            m.setCampaignId(cid);
            promoCodeCampaignRepository.save(m);
        }
        return ResponseEntity.ok(java.util.Map.of("status", "ok", "count", campaignIds.size()));
    }

    @PreAuthorize("@auth.allows('promo_code.read')")
    @GetMapping("/{id}/campaigns")
    public ResponseEntity<?> getCampaigns(@PathVariable Long id) {
        List<Long> ids = promoCodeCampaignRepository.findByPromoCodeId(id).stream()
            .map(com.kccitm.api.model.career9.b2c.PromoCodeCampaign::getCampaignId)
            .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(ids);
    }
}
