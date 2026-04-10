package com.kccitm.api.controller.career9;

import java.util.Date;
import java.util.HashMap;
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

import com.kccitm.api.model.career9.PromoCode;
import com.kccitm.api.repository.Career9.PromoCodeRepository;

@RestController
@RequestMapping("/promo-codes")
public class PromoCodeController {

    @Autowired
    private PromoCodeRepository promoCodeRepository;

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

    @GetMapping("/getAll")
    public ResponseEntity<List<PromoCode>> getAllPromoCodes() {
        return ResponseEntity.ok(promoCodeRepository.findAllByOrderByCreatedAtDesc());
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<?> getPromoCodeById(@PathVariable Long id) {
        Optional<PromoCode> promo = promoCodeRepository.findById(id);
        if (!promo.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(promo.get());
    }

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

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> deletePromoCode(@PathVariable Long id) {
        if (!promoCodeRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        promoCodeRepository.deleteById(id);
        return ResponseEntity.ok("Promo code deleted");
    }

    @PostMapping("/public/validate")
    public ResponseEntity<?> validatePromoCode(@RequestBody Map<String, String> request) {
        String code = request.get("code");
        if (code == null || code.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Promo code is required");
        }

        Optional<PromoCode> optPromo = promoCodeRepository.findByCodeIgnoreCaseAndIsActive(
                code.trim().toUpperCase(), true);

        if (!optPromo.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Invalid promo code");
        }

        PromoCode promo = optPromo.get();

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
}
