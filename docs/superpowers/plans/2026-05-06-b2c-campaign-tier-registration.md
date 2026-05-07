# B2C Campaign-Tier Public Registration Links — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public registration/checkout links for B2C campaigns at three URL granularities (`/c/:slug`, `/c/:slug/:assessmentId`, `/c/:slug/:assessmentId/:tierId`), hosted on the assessment domain, that funnel through tier selection, payment, and the auto-login flow shipped earlier today. Promo codes can be scoped to specific campaigns via a new junction table.

**Architecture:** Approach 1 (parallel public surface, shared post-payment). New `/campaign/public/*` endpoints alongside existing `/assessment-mapping/public/*`. Reuses `provisionB2CStudentAndEntitlement`, `/payment/webhook/status/{linkId}`, and assessment-domain `PaymentStatusPage`. New frontend `CampaignRegisterPage.tsx` is one component handling all three URL shapes via conditional rendering.

**Tech Stack:** Spring Boot 2.5.5 / Java 11 (backend), React 19 + Vite + TypeScript (assessment domain), React 18 + CRA + TypeScript (dashboard).

**Reference spec:** `docs/superpowers/specs/2026-05-06-b2c-campaign-tier-registration-design.md`.

**Project conventions (do NOT skip):**
- **No automatic git commits.** This project's user commits manually. Each task ends with a "stage the commit" step that *prints* the commit command for the user to run when ready. Do NOT run `git commit` from any task.
- **No TypeScript compilation checks** (`npm run build`, `tsc`) per CLAUDE.md. Frontend verification = manual smoke testing on staging at deploy gates.
- **No backend test infrastructure** (only one load test exists). Backend verification = manual smoke testing via curl/Postman at the Phase 1 staging gate.
- **Each phase deploys independently behind a staging smoke test.** No flag day. Strict ordering: backend → backend config → assessment FE → dashboard FE.

---

## Phase 1 — Backend

### Task 1: `PromoCodeCampaign` entity + repository

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/model/career9/b2c/PromoCodeCampaign.java`
- Create: `spring-social/src/main/java/com/kccitm/api/repository/Career9/b2c/PromoCodeCampaignRepository.java`

**Why:** Junction table mapping promo codes to campaigns (many-to-many). Hibernate `ddl-auto: update` creates the table on next backend boot.

- [ ] **Step 1: Create the entity**

```java
// spring-social/src/main/java/com/kccitm/api/model/career9/b2c/PromoCodeCampaign.java
package com.kccitm.api.model.career9.b2c;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(
    name = "promo_code_campaigns",
    uniqueConstraints = @UniqueConstraint(columnNames = {"promo_code_id", "campaign_id"})
)
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class PromoCodeCampaign implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "promo_code_id", nullable = false)
    private Long promoCodeId;

    @Column(name = "campaign_id", nullable = false)
    private Long campaignId;

    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = new Date();
    }

    public PromoCodeCampaign() {}

    public Long getId() { return id; }
    public void setId(Long v) { this.id = v; }
    public Long getPromoCodeId() { return promoCodeId; }
    public void setPromoCodeId(Long v) { this.promoCodeId = v; }
    public Long getCampaignId() { return campaignId; }
    public void setCampaignId(Long v) { this.campaignId = v; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date v) { this.createdAt = v; }
}
```

- [ ] **Step 2: Create the repository**

```java
// spring-social/src/main/java/com/kccitm/api/repository/Career9/b2c/PromoCodeCampaignRepository.java
package com.kccitm.api.repository.Career9.b2c;

import com.kccitm.api.model.career9.b2c.PromoCodeCampaign;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface PromoCodeCampaignRepository extends JpaRepository<PromoCodeCampaign, Long> {
    List<PromoCodeCampaign> findByPromoCodeId(Long promoCodeId);
    List<PromoCodeCampaign> findByCampaignId(Long campaignId);
    boolean existsByPromoCodeIdAndCampaignId(Long promoCodeId, Long campaignId);
    boolean existsByPromoCodeId(Long promoCodeId);

    @Transactional
    void deleteByPromoCodeId(Long promoCodeId);
}
```

- [ ] **Step 3: Stage the commit**

Print this for the user to run:

```bash
git -C /home/babayaga/Projects/career-nine-sandbox add \
  spring-social/src/main/java/com/kccitm/api/model/career9/b2c/PromoCodeCampaign.java \
  spring-social/src/main/java/com/kccitm/api/repository/Career9/b2c/PromoCodeCampaignRepository.java
git -C /home/babayaga/Projects/career-nine-sandbox commit -m "feat: add PromoCodeCampaign junction entity for campaign-scoped promo codes"
```

---

### Task 2: Extend `validatePromoCode` to honor campaign scoping

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/PromoCodeController.java:142-172`

**Why:** Public-facing validate endpoint must reject campaign-scoped codes when called from school flow (no `campaignId`), and reject globally-scoped or wrong-campaign codes when called from B2C flow (with `campaignId`). Per spec §"Promo code semantics."

- [ ] **Step 1: Inject `PromoCodeCampaignRepository`**

In `PromoCodeController.java`, in the field-injection block near the top of the class, add:

```java
@Autowired
private com.kccitm.api.repository.Career9.b2c.PromoCodeCampaignRepository promoCodeCampaignRepository;
```

- [ ] **Step 2: Replace `validatePromoCode` body**

Replace the existing method (lines 142-172) with:

```java
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
```

(The body type changes from `Map<String, String>` to `Map<String, Object>` so `campaignId` can be a numeric. Existing school-flow callers send `{ code: "..." }` and continue to work — `code` is just `toString()`'d.)

- [ ] **Step 3: Stage the commit**

```bash
git -C /home/babayaga/Projects/career-nine-sandbox add \
  spring-social/src/main/java/com/kccitm/api/controller/career9/PromoCodeController.java
git -C /home/babayaga/Projects/career-nine-sandbox commit -m "feat: add campaign-scoping rules to validatePromoCode"
```

---

### Task 3: Add admin endpoints for promo-code campaign mapping

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/PromoCodeController.java` (add two new methods at end of class)

**Why:** Admin UI needs to read/write the campaign mapping for a promo code. `setCampaigns` does delete-then-insert (same pattern as the existing language-question/option-replacement flows in this codebase).

- [ ] **Step 1: Add `setCampaigns` and `getCampaigns` methods**

Inside `PromoCodeController` class (just before the closing `}`), add:

```java
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

@GetMapping("/{id}/campaigns")
public ResponseEntity<?> getCampaigns(@PathVariable Long id) {
    List<Long> ids = promoCodeCampaignRepository.findByPromoCodeId(id).stream()
        .map(com.kccitm.api.model.career9.b2c.PromoCodeCampaign::getCampaignId)
        .collect(java.util.stream.Collectors.toList());
    return ResponseEntity.ok(ids);
}
```

- [ ] **Step 2: Stage the commit**

```bash
git -C /home/babayaga/Projects/career-nine-sandbox add \
  spring-social/src/main/java/com/kccitm/api/controller/career9/PromoCodeController.java
git -C /home/babayaga/Projects/career-nine-sandbox commit -m "feat: add admin endpoints to map promo codes to campaigns"
```

---

### Task 4: `CampaignPublicController` — info endpoints

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/controller/career9/b2c/CampaignPublicController.java`

**Why:** Three URL forms render the same React component. The component fetches via these `/info/...` endpoints. One controller method dispatches on the path-vars.

- [ ] **Step 1: Create the controller skeleton with the info endpoint**

```java
// spring-social/src/main/java/com/kccitm/api/controller/career9/b2c/CampaignPublicController.java
package com.kccitm.api.controller.career9.b2c;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.b2c.Campaign;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentMapping;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentTier;
import com.kccitm.api.model.career9.b2c.PricingTier;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentTierRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignRepository;
import com.kccitm.api.repository.Career9.b2c.PricingTierRepository;

@RestController
@RequestMapping("/campaign/public")
public class CampaignPublicController {

    private static final Logger logger = LoggerFactory.getLogger(CampaignPublicController.class);

    @Autowired private CampaignRepository campaignRepository;
    @Autowired private CampaignAssessmentMappingRepository mappingRepository;
    @Autowired private CampaignAssessmentTierRepository tierMappingRepository;
    @Autowired private PricingTierRepository pricingTierRepository;
    @Autowired private AssessmentTableRepository assessmentTableRepository;

    @GetMapping("/info/{slug}")
    public ResponseEntity<?> infoBySlug(@PathVariable String slug) {
        return buildInfo(slug, null, null);
    }

    @GetMapping("/info/{slug}/{assessmentId}")
    public ResponseEntity<?> infoByAssessment(@PathVariable String slug,
                                              @PathVariable Long assessmentId) {
        return buildInfo(slug, assessmentId, null);
    }

    @GetMapping("/info/{slug}/{assessmentId}/{tierMappingId}")
    public ResponseEntity<?> infoByTier(@PathVariable String slug,
                                        @PathVariable Long assessmentId,
                                        @PathVariable Long tierMappingId) {
        return buildInfo(slug, assessmentId, tierMappingId);
    }

    private ResponseEntity<?> buildInfo(String slug, Long filterAssessmentId, Long filterTierMappingId) {
        Optional<Campaign> campaignOpt = campaignRepository.findBySlugIgnoreCaseAndIsDeletedFalse(slug);
        if (!campaignOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Campaign not found");
        }
        Campaign c = campaignOpt.get();
        if (Boolean.FALSE.equals(c.getIsActive())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Campaign not active");
        }
        if (c.getValidTo() != null && c.getValidTo().before(new Date())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Campaign has expired");
        }

        Map<String, Object> campaignDto = new HashMap<>();
        campaignDto.put("campaignId", c.getCampaignId());
        campaignDto.put("name", c.getName());
        campaignDto.put("slug", c.getSlug());
        campaignDto.put("brandLogoUrl", c.getBrandLogoUrl());
        campaignDto.put("targetAudience", c.getTargetAudience());
        campaignDto.put("description", c.getDescription());
        campaignDto.put("validFrom", c.getValidFrom());
        campaignDto.put("validTo", c.getValidTo());

        // Resolved purchasePath/counsellingModel defaults
        String defaultPurchasePath = c.getDefaultPurchasePath();
        String defaultCounsellingModel = c.getDefaultCounsellingModel();

        List<CampaignAssessmentMapping> mappings = mappingRepository
                .findByCampaignIdAndIsDeletedFalseOrderBySortOrderAsc(c.getCampaignId())
                .stream()
                .filter(m -> Boolean.TRUE.equals(m.getIsActive()))
                .filter(m -> filterAssessmentId == null || filterAssessmentId.equals(m.getAssessmentId()))
                .collect(java.util.stream.Collectors.toList());

        if (filterAssessmentId != null && mappings.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Assessment not in campaign");
        }

        List<Map<String, Object>> assessmentsOut = new ArrayList<>();
        for (CampaignAssessmentMapping m : mappings) {
            Optional<AssessmentTable> aOpt = assessmentTableRepository.findById(m.getAssessmentId());
            if (!aOpt.isPresent()) continue;
            AssessmentTable a = aOpt.get();
            if (Boolean.FALSE.equals(a.getIsActive())) continue;

            Map<String, Object> aDto = new HashMap<>();
            aDto.put("assessmentId", a.getAssessmentId());
            aDto.put("assessmentName", a.getAssessmentName());
            aDto.put("isActive", a.getIsActive());
            aDto.put("purchasePath", m.getPurchasePath() != null ? m.getPurchasePath() : defaultPurchasePath);
            aDto.put("counsellingModel", m.getCounsellingModel() != null ? m.getCounsellingModel() : defaultCounsellingModel);

            List<CampaignAssessmentTier> tiers = tierMappingRepository
                    .findByCampaignAssessmentMappingIdOrderByIdAsc(m.getId())
                    .stream()
                    .filter(t -> Boolean.TRUE.equals(t.getIsActive()))
                    .filter(t -> filterTierMappingId == null || filterTierMappingId.equals(t.getId()))
                    .collect(java.util.stream.Collectors.toList());

            if (filterTierMappingId != null && tiers.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Tier not in this assessment");
            }

            List<Map<String, Object>> tiersOut = new ArrayList<>();
            for (CampaignAssessmentTier t : tiers) {
                Optional<PricingTier> ptOpt = pricingTierRepository.findById(t.getPricingTierId());
                if (!ptOpt.isPresent()) continue;
                PricingTier pt = ptOpt.get();
                if (Boolean.FALSE.equals(pt.getIsActive()) || Boolean.TRUE.equals(pt.getIsDeleted())) continue;

                Map<String, Object> tDto = new HashMap<>();
                tDto.put("campaignAssessmentTierId", t.getId());
                tDto.put("tierId", pt.getTierId());
                tDto.put("name", pt.getName());
                tDto.put("description", pt.getDescription());
                tDto.put("basePriceInr", pt.getBasePriceInr());
                long priceInr = t.getPriceOverrideInr() != null ? t.getPriceOverrideInr() : pt.getBasePriceInr();
                tDto.put("priceInr", priceInr);
                tDto.put("currency", pt.getCurrency());
                tDto.put("isDefault", t.getIsDefault());
                tDto.put("includesFinalReport", pt.getIncludesFinalReport());
                tDto.put("includesDashboard", pt.getIncludesDashboard());
                tDto.put("includesCounselling", pt.getIncludesCounselling());
                tDto.put("counsellingSessionCount", pt.getCounsellingSessionCount());
                tDto.put("includesLms", pt.getIncludesLms());
                tDto.put("lmsValidityDays", pt.getLmsValidityDays());
                tDto.put("dashboardValidityDays", pt.getDashboardValidityDays());
                tiersOut.add(tDto);
            }
            aDto.put("tiers", tiersOut);
            assessmentsOut.add(aDto);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("campaign", campaignDto);
        response.put("assessments", assessmentsOut);
        return ResponseEntity.ok(response);
    }
}
```

- [ ] **Step 2: Verify repository method names exist**

The plan uses `mappingRepository.findByCampaignIdAndIsDeletedFalseOrderBySortOrderAsc(...)` and `tierMappingRepository.findByCampaignAssessmentMappingIdOrderByIdAsc(...)`. Verify both exist:

```bash
grep -rn "findByCampaignIdAndIsDeletedFalse\|findByCampaignAssessmentMappingIdOrderByIdAsc" \
  /home/babayaga/Projects/career-nine-sandbox/spring-social/src/main/java/com/kccitm/api/repository/Career9/b2c/
```

Expected: at least one match for each. If `findByCampaignIdAndIsDeletedFalseOrderBySortOrderAsc` is missing on `CampaignAssessmentMappingRepository`, add this declaration to that file:

```java
List<CampaignAssessmentMapping> findByCampaignIdAndIsDeletedFalseOrderBySortOrderAsc(Long campaignId);
```

(Spring Data JPA will derive the query.)

- [ ] **Step 3: Stage the commit**

```bash
git -C /home/babayaga/Projects/career-nine-sandbox add \
  spring-social/src/main/java/com/kccitm/api/controller/career9/b2c/CampaignPublicController.java
# Plus any repository file you added a method to
git -C /home/babayaga/Projects/career-nine-sandbox commit -m "feat: add CampaignPublicController info endpoints"
```

---

### Task 5: `CampaignPublicController` — register endpoint

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/b2c/CampaignPublicController.java` (add register method + free-path helpers)

**Why:** Single endpoint creates a `PaymentTransaction` with `campaignAssessmentTierId` and either: (a) free path inline-creates everything and returns session payload, or (b) paid path returns Razorpay payment URL. The webhook + provisioning + auto-login machinery already exists.

- [ ] **Step 1: Add `@Autowired` fields for the additional services**

In `CampaignPublicController`, with the other `@Autowired` fields, add:

```java
@Autowired private com.kccitm.api.repository.Career9.PromoCodeRepository promoCodeRepository;
@Autowired private com.kccitm.api.repository.Career9.b2c.PromoCodeCampaignRepository promoCodeCampaignRepository;
@Autowired private com.kccitm.api.repository.Career9.PaymentTransactionRepository paymentTransactionRepository;
@Autowired private com.kccitm.api.repository.Career9.StudentInfoRepository studentInfoRepository;
@Autowired private com.kccitm.api.repository.UserRepository userRepository;
@Autowired private com.kccitm.api.repository.Career9.UserStudentRepository userStudentRepository;
@Autowired private com.kccitm.api.repository.StudentAssessmentMappingRepository studentAssessmentMappingRepository;
@Autowired private com.kccitm.api.service.RazorpayService razorpayService;
@Autowired private com.kccitm.api.service.StudentSessionService studentSessionService;
@Autowired(required = false) private com.kccitm.api.service.b2c.EntitlementService entitlementService;

@org.springframework.beans.factory.annotation.Value("${app.razorpay.callback-base-url:}")
private String callbackBaseUrl;
```

Add to the imports at top of file:

```java
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.model.career9.PromoCode;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.b2c.PromoCodeCampaign;

import java.text.SimpleDateFormat;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;
```

- [ ] **Step 2: Add the register method**

```java
@PostMapping("/register/{slug}/{assessmentId}/{tierMappingId}")
@Transactional
public ResponseEntity<?> register(@PathVariable String slug,
                                  @PathVariable Long assessmentId,
                                  @PathVariable Long tierMappingId,
                                  @RequestBody Map<String, Object> body) {

    // 1. Resolve campaign
    Optional<Campaign> campaignOpt = campaignRepository.findBySlugIgnoreCaseAndIsDeletedFalse(slug);
    if (!campaignOpt.isPresent() || Boolean.FALSE.equals(campaignOpt.get().getIsActive())) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Campaign not found");
    }
    Campaign campaign = campaignOpt.get();
    if (campaign.getValidTo() != null && campaign.getValidTo().before(new Date())) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Campaign has expired");
    }

    // 2. Resolve assessment-mapping + tier
    Optional<CampaignAssessmentMapping> mOpt = mappingRepository
            .findByCampaignIdAndAssessmentIdAndIsDeletedFalse(campaign.getCampaignId(), assessmentId);
    if (!mOpt.isPresent() || !Boolean.TRUE.equals(mOpt.get().getIsActive())) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Assessment not in campaign");
    }
    CampaignAssessmentMapping mapping = mOpt.get();

    Optional<CampaignAssessmentTier> tOpt = tierMappingRepository.findById(tierMappingId);
    if (!tOpt.isPresent() || !Boolean.TRUE.equals(tOpt.get().getIsActive())
            || !mapping.getId().equals(tOpt.get().getCampaignAssessmentMappingId())) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Tier not in this assessment");
    }
    CampaignAssessmentTier tierMapping = tOpt.get();

    Optional<PricingTier> ptOpt = pricingTierRepository.findById(tierMapping.getPricingTierId());
    if (!ptOpt.isPresent()) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Pricing tier not found");
    }
    PricingTier pricingTier = ptOpt.get();
    long priceInr = tierMapping.getPriceOverrideInr() != null
            ? tierMapping.getPriceOverrideInr() : pricingTier.getBasePriceInr();
    long originalPaise = priceInr * 100L;

    // 3. Validate input
    String name = strFromBody(body, "name");
    String email = strFromBody(body, "email");
    String dobStr = strFromBody(body, "dob");
    String phone = strFromBody(body, "phone");
    String gender = strFromBody(body, "gender");
    String promoCodeStr = strFromBody(body, "promoCode");

    if (name == null || email == null || dobStr == null) {
        return ResponseEntity.badRequest().body("Name, email, and date of birth are required");
    }
    SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
    Date dob;
    try { dob = sdf.parse(dobStr); }
    catch (Exception e) { return ResponseEntity.badRequest().body("Invalid date format. Use dd-MM-yyyy"); }

    // 4. Apply promo code (if any)
    Long finalPaise = originalPaise;
    Integer promoDiscountPercent = null;
    String promoCodeSaved = null;
    if (promoCodeStr != null && !promoCodeStr.trim().isEmpty()) {
        Optional<PromoCode> promoOpt = promoCodeRepository
                .findByCodeIgnoreCaseAndIsActive(promoCodeStr.trim().toUpperCase(), true);
        if (!promoOpt.isPresent()) {
            return ResponseEntity.badRequest().body("Invalid promo code");
        }
        PromoCode promo = promoOpt.get();
        if (!promoCodeCampaignRepository.existsByPromoCodeIdAndCampaignId(promo.getId(), campaign.getCampaignId())) {
            return ResponseEntity.badRequest().body("Code not valid for this campaign");
        }
        if (promo.getExpiresAt() != null && promo.getExpiresAt().before(new Date())) {
            return ResponseEntity.badRequest().body("Promo code has expired");
        }
        if (promo.getMaxUses() != null && promo.getCurrentUses() >= promo.getMaxUses()) {
            return ResponseEntity.badRequest().body("Promo code usage limit reached");
        }
        promoDiscountPercent = promo.getDiscountPercent();
        finalPaise = originalPaise * (100 - promoDiscountPercent) / 100;
        promo.setCurrentUses(promo.getCurrentUses() + 1);
        promoCodeRepository.save(promo);
        promoCodeSaved = promo.getCode();
    }

    // 5. Email-DOB duplicate check (impersonation block)
    List<StudentInfo> existingByEmail = studentInfoRepository.findByEmail(email);
    StudentInfo existing = existingByEmail.isEmpty() ? null : existingByEmail.get(0);
    if (existing != null) {
        Date existingDob = existing.getStudentDob();
        if (existingDob == null || !sameDay(existingDob, dob)) {
            return ResponseEntity.badRequest().body(java.util.Map.of(
                "status", "error",
                "message", "This email is already registered with a different date of birth. " +
                           "If this is your account, please use your registered date of birth."));
        }
    }

    // 6. Free path → inline-provision and return session
    if (finalPaise == 0L) {
        return provisionFreeAndRespond(campaign, mapping, tierMapping, pricingTier,
                existing, name, email, dob, dobStr, phone, gender,
                promoCodeSaved, promoDiscountPercent, originalPaise);
    }

    // 7. Paid path → create Razorpay payment link + PaymentTransaction
    return createPaymentAndRedirect(campaign, mapping, tierMapping, pricingTier,
            name, email, dob, dobStr, phone, gender,
            finalPaise, originalPaise, promoCodeSaved, promoDiscountPercent);
}

private static String strFromBody(Map<String, Object> body, String key) {
    Object v = body.get(key);
    if (v == null) return null;
    String s = v.toString().trim();
    return s.isEmpty() ? null : s;
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
```

- [ ] **Step 3: Add the free-path helper**

```java
private ResponseEntity<?> provisionFreeAndRespond(Campaign campaign,
        CampaignAssessmentMapping mapping, CampaignAssessmentTier tierMapping,
        PricingTier pricingTier, StudentInfo existing,
        String name, String email, Date dob, String dobStr, String phone, String gender,
        String promoCodeSaved, Integer promoDiscountPercent, long originalPaise) {

    // Create or reuse User+StudentInfo+UserStudent
    UserStudent userStudent;
    User user;
    if (existing != null) {
        user = existing.getUser();
        if (user == null) {
            user = new User((int) (Math.random() * 100000), dob);
            user.setName(existing.getName());
            user.setEmail(existing.getEmail());
            user = userRepository.save(user);
            existing.setUser(user);
            studentInfoRepository.save(existing);
        }
        List<UserStudent> us = userStudentRepository.findByStudentInfoId(existing.getId());
        if (us.isEmpty()) {
            UserStudent newUs = new UserStudent(user, existing, null);
            userStudent = userStudentRepository.save(newUs);
        } else {
            userStudent = us.get(0);
        }
    } else {
        user = new User((int) (Math.random() * 100000), dob);
        user.setName(name);
        user.setEmail(email);
        user.setPhone(phone);
        user = userRepository.save(user);

        StudentInfo studentInfo = new StudentInfo();
        studentInfo.setName(name);
        studentInfo.setEmail(email);
        studentInfo.setStudentDob(dob);
        studentInfo.setPhoneNumber(phone);
        studentInfo.setGender(gender);
        studentInfo.setUser(user);
        studentInfo = studentInfoRepository.save(studentInfo);

        userStudent = new UserStudent(user, studentInfo, null);
        userStudent = userStudentRepository.save(userStudent);
    }

    // Ensure StudentAssessmentMapping exists
    Long assessmentId = mapping.getAssessmentId();
    Optional<StudentAssessmentMapping> samOpt = studentAssessmentMappingRepository
            .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudent.getUserStudentId(), assessmentId);
    if (!samOpt.isPresent()) {
        StudentAssessmentMapping sam = new StudentAssessmentMapping(userStudent.getUserStudentId(), assessmentId);
        studentAssessmentMappingRepository.save(sam);
    }

    // Record zero-amount PaymentTransaction
    PaymentTransaction txn = new PaymentTransaction();
    txn.setAmount(0L);
    txn.setOriginalAmount(originalPaise);
    txn.setStatus("paid");
    txn.setAssessmentId(assessmentId);
    txn.setCampaignId(campaign.getCampaignId());
    txn.setCampaignAssessmentTierId(tierMapping.getId());
    txn.setStudentName(name);
    txn.setStudentEmail(email);
    txn.setStudentDob(dob);
    txn.setStudentPhone(phone);
    txn.setUserStudentId(userStudent.getUserStudentId());
    if (promoCodeSaved != null) {
        txn.setPromoCode(promoCodeSaved);
        txn.setPromoDiscountPercent(promoDiscountPercent);
    }
    txn = paymentTransactionRepository.save(txn);

    // Trigger entitlement activation (welcome email + tier service delivery)
    if (entitlementService != null) {
        try { entitlementService.activateOnPayment(txn.getTransactionId()); }
        catch (Exception e) { logger.error("Entitlement activation failed (free path) for txn {}", txn.getTransactionId(), e); }
    }

    // Build session payload
    Map<String, Object> response = new HashMap<>();
    response.put("status", "success");
    response.put("message", "Registration successful! Please save your login credentials.");
    response.put("username", user.getUsername());
    response.put("dob", dobStr);
    response.putAll(studentSessionService.buildSessionPayload(userStudent.getUserStudentId()));
    return ResponseEntity.ok(response);
}
```

- [ ] **Step 4: Add the paid-path helper**

```java
private ResponseEntity<?> createPaymentAndRedirect(Campaign campaign,
        CampaignAssessmentMapping mapping, CampaignAssessmentTier tierMapping,
        PricingTier pricingTier,
        String name, String email, Date dob, String dobStr, String phone, String gender,
        long finalPaise, long originalPaise, String promoCodeSaved, Integer promoDiscountPercent) {

    try {
        String description = pricingTier.getName() + " — " + campaign.getName();
        String callbackUrl = (callbackBaseUrl == null ? "" : callbackBaseUrl) + "/payment-status";
        String referenceId = "CAM-" + campaign.getCampaignId() + "-" + tierMapping.getId() + "-" + System.currentTimeMillis();

        Map<String, String> notes = new HashMap<>();
        notes.put("campaignId", String.valueOf(campaign.getCampaignId()));
        notes.put("assessmentId", String.valueOf(mapping.getAssessmentId()));
        notes.put("campaignAssessmentTierId", String.valueOf(tierMapping.getId()));
        notes.put("studentEmail", email);
        notes.put("customerName", name);
        notes.put("customerDob", dobStr);

        Map<String, String> rzpResponse = razorpayService.createPaymentLink(
                finalPaise, "INR", description, callbackUrl, referenceId, notes);

        PaymentTransaction txn = new PaymentTransaction();
        txn.setAmount(finalPaise);
        txn.setOriginalAmount(originalPaise);
        txn.setAssessmentId(mapping.getAssessmentId());
        txn.setCampaignId(campaign.getCampaignId());
        txn.setCampaignAssessmentTierId(tierMapping.getId());
        txn.setStudentName(name);
        txn.setStudentEmail(email);
        txn.setStudentDob(dob);
        txn.setStudentPhone(phone);
        txn.setRazorpayLinkId(rzpResponse.get("linkId"));
        txn.setPaymentLinkUrl(rzpResponse.get("shortUrl"));
        txn.setShortUrl(rzpResponse.get("shortUrl"));
        txn.setStatus("created");
        if (promoCodeSaved != null) {
            txn.setPromoCode(promoCodeSaved);
            txn.setPromoDiscountPercent(promoDiscountPercent);
        }
        txn = paymentTransactionRepository.save(txn);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "payment_required");
        response.put("paymentUrl", rzpResponse.get("shortUrl"));
        response.put("transactionId", txn.getTransactionId());
        response.put("amount", finalPaise);
        return ResponseEntity.ok(response);
    } catch (Exception e) {
        logger.error("Failed to create campaign payment link", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Failed to create payment link. Please try again.");
    }
}
```

- [ ] **Step 5: Verify `PaymentTransaction` setter availability**

`PaymentTransaction` is expected to have setters for: `Amount`, `OriginalAmount`, `Status`, `AssessmentId`, `CampaignId`, `CampaignAssessmentTierId`, `StudentName`, `StudentEmail`, `StudentDob`, `StudentPhone`, `UserStudentId`, `PromoCode`, `PromoDiscountPercent`, `RazorpayLinkId`, `PaymentLinkUrl`, `ShortUrl`. Verify:

```bash
grep -n "public void set\(Amount\|OriginalAmount\|CampaignId\|CampaignAssessmentTierId\)" \
  /home/babayaga/Projects/career-nine-sandbox/spring-social/src/main/java/com/kccitm/api/model/career9/PaymentTransaction.java
```

Expected: at least one match per setter. If `setCampaignId` is missing, the field needs to be added (it's used in the existing `provisionB2CStudentAndEntitlement` flow, so this would be surprising — flag and stop if so).

- [ ] **Step 6: Stage the commit**

```bash
git -C /home/babayaga/Projects/career-nine-sandbox add \
  spring-social/src/main/java/com/kccitm/api/controller/career9/b2c/CampaignPublicController.java
git -C /home/babayaga/Projects/career-nine-sandbox commit -m "feat: add CampaignPublicController register endpoint with free + paid paths"
```

---

### Task 6: Permit `/campaign/public/**` in `SecurityConfig`

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java:151`

**Why:** Public endpoints must bypass auth, parallel to `/assessment-mapping/public/**`.

- [ ] **Step 1: Add path to the antMatchers list**

In `SecurityConfig.java:151`, the current line reads:

```java
.antMatchers("/assessment-mapping/public/**", "/school-registration/public/**", "/assessments/prefetch/**", "/leads/capture", "/payment/webhook/**",
```

Change to:

```java
.antMatchers("/assessment-mapping/public/**", "/campaign/public/**", "/school-registration/public/**", "/assessments/prefetch/**", "/leads/capture", "/payment/webhook/**",
```

(Insert `"/campaign/public/**"` between `"/assessment-mapping/public/**"` and `"/school-registration/public/**"`.)

- [ ] **Step 2: Stage the commit**

```bash
git -C /home/babayaga/Projects/career-nine-sandbox add \
  spring-social/src/main/java/com/kccitm/api/config/SecurityConfig.java
git -C /home/babayaga/Projects/career-nine-sandbox commit -m "feat: permit /campaign/public/** without authentication"
```

---

### Task 7: Add `app.b2c.frontendBaseUrl` per profile in `application.yml`

**Files:**
- Modify: `spring-social/src/main/resources/application.yml` (gitignored — apply on staging/prod servers at deploy time)

**Why:** `LinkBuilder.campaignLanding(slug)` builds URLs from `app.b2c.frontendBaseUrl`. Currently unset → defaults to `https://dashboard.career-9.com`. Need to flip to assessment domain per profile.

- [ ] **Step 1: Find razorpay config blocks per profile**

```bash
grep -n "razorpay:\|on-profile\|callback-base-url" /home/babayaga/Projects/career-nine-sandbox/spring-social/src/main/resources/application.yml | head -20
```

Each profile has an `app.razorpay.callback-base-url` line you flipped earlier today. The new B2C config sits in the same `app:` block.

- [ ] **Step 2: Add `b2c` section per profile**

For each profile (`dev`, `staging`/`sandbox`, `production`), add inside the `app:` block (sibling to `razorpay:`) :

**dev profile** (`http://localhost:5173` — the assessment Vite dev port, mirroring the Razorpay dev callback):

```yaml
  b2c:
    frontendBaseUrl: http://localhost:5173
    assessmentBaseUrl: http://localhost:5173
```

**staging/sandbox profile:**

```yaml
  b2c:
    frontendBaseUrl: https://staging-assessment.career-9.com
    assessmentBaseUrl: https://staging-assessment.career-9.com
```

**production profile:**

```yaml
  b2c:
    frontendBaseUrl: https://assessment.career-9.com
    assessmentBaseUrl: https://assessment.career-9.com
```

(Also flips `assessmentBaseUrl` for symmetry — `LinkBuilder.assessmentStart` already uses it, but its current default `https://assessment.career-9.com` is correct. Setting it explicitly removes ambiguity.)

- [ ] **Step 3: NO COMMIT — file is gitignored**

The user must apply equivalent changes to the staging/prod copies of `application.yml` at deploy time. Document this in the task report.

---

### Phase 1 staging gate

Before starting Phase 2, deploy backend to staging and verify:

```bash
# Pick an active campaign with at least one assessment+tier mapped
# Replace <slug>, <aid>, <tid> with real IDs from your DB.

# 1. Info endpoints
curl https://api-staging.career-9.com/campaign/public/info/<slug>
curl https://api-staging.career-9.com/campaign/public/info/<slug>/<aid>
curl https://api-staging.career-9.com/campaign/public/info/<slug>/<aid>/<tid>

# 2. validatePromoCode rules
# (a) campaign-scoped code with matching campaignId — should succeed
curl -X POST https://api-staging.career-9.com/promo-codes/public/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"<scoped-code>","campaignId":<campaign-id>}'

# (b) campaign-scoped code, NO campaignId — should reject "for a specific campaign"
curl -X POST https://api-staging.career-9.com/promo-codes/public/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"<scoped-code>"}'

# (c) global code (no junction) with campaignId — should reject "Code not valid for this campaign"
curl -X POST https://api-staging.career-9.com/promo-codes/public/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"<global-code>","campaignId":<campaign-id>}'

# (d) global code without campaignId — should still succeed (preserved school behavior)
curl -X POST https://api-staging.career-9.com/promo-codes/public/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"<global-code>"}'

# 3. Register endpoint, free tier (priceInr * (100-discount)/100 == 0)
# Use a tier with priceOverrideInr=0 OR a 100% promo code.
curl -X POST https://api-staging.career-9.com/campaign/public/register/<slug>/<aid>/<tid> \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test1@example.com","dob":"01-01-2010","phone":"","gender":"Male"}'
# Expect: { status: "success", username, dob, userStudentId, assessments: [...] }

# 4. Register endpoint, paid tier
curl -X POST https://api-staging.career-9.com/campaign/public/register/<slug>/<aid>/<paid-tid> \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test2@example.com","dob":"01-01-2010","phone":"","gender":"Male"}'
# Expect: { status: "payment_required", paymentUrl, transactionId, amount }

# 5. Email-DOB mismatch
curl -X POST https://api-staging.career-9.com/campaign/public/register/<slug>/<aid>/<tid> \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test1@example.com","dob":"15-06-2008","phone":"","gender":"Male"}'
# Expect: 400 with "different date of birth" message
```

Once all pass, proceed to Phase 2.

---

## Phase 2 — Assessment Frontend (depends on Phase 1 deployed)

### Task 8: Extend `promoCodeAPI.ts` with optional `campaignId`

**Files:**
- Modify: `career-nine-assessment/src/api-clients/promoCodeAPI.ts`

**Why:** Frontend calls validate endpoint with optional `campaignId`. Backwards-compatible: school flow keeps calling without it.

- [ ] **Step 1: Update the client**

Replace the entire file content with:

```typescript
// career-nine-assessment/src/api-clients/promoCodeAPI.ts
import http from '../api/http'

export function validatePromoCode(code: string, campaignId?: number) {
  const body: { code: string; campaignId?: number } = { code }
  if (campaignId != null) body.campaignId = campaignId
  return http.post('/promo-codes/public/validate', body)
}
```

- [ ] **Step 2: Stage the commit**

```bash
git -C /home/babayaga/Projects/career-nine-sandbox add \
  career-nine-assessment/src/api-clients/promoCodeAPI.ts
git -C /home/babayaga/Projects/career-nine-sandbox commit -m "feat: promoCodeAPI accepts optional campaignId"
```

---

### Task 9: Create `campaignAPI.ts` client

**Files:**
- Create: `career-nine-assessment/src/api-clients/campaignAPI.ts`

- [ ] **Step 1: Create the client**

```typescript
// career-nine-assessment/src/api-clients/campaignAPI.ts
import http from '../api/http'

export function getCampaignInfoBySlug(slug: string) {
  return http.get(`/campaign/public/info/${encodeURIComponent(slug)}`)
}

export function getCampaignInfoByAssessment(slug: string, assessmentId: number) {
  return http.get(`/campaign/public/info/${encodeURIComponent(slug)}/${assessmentId}`)
}

export function getCampaignInfoByTier(slug: string, assessmentId: number, tierMappingId: number) {
  return http.get(`/campaign/public/info/${encodeURIComponent(slug)}/${assessmentId}/${tierMappingId}`)
}

export function registerForCampaignTier(
  slug: string,
  assessmentId: number,
  tierMappingId: number,
  studentData: {
    name: string
    email: string
    dob: string
    phone?: string
    gender?: string
    promoCode?: string
  }
) {
  return http.post(
    `/campaign/public/register/${encodeURIComponent(slug)}/${assessmentId}/${tierMappingId}`,
    studentData,
  )
}
```

- [ ] **Step 2: Stage the commit**

```bash
git -C /home/babayaga/Projects/career-nine-sandbox add \
  career-nine-assessment/src/api-clients/campaignAPI.ts
git -C /home/babayaga/Projects/career-nine-sandbox commit -m "feat: add campaignAPI client for B2C public endpoints"
```

---

### Task 10: Create `CampaignRegisterPage.tsx`

**Files:**
- Create: `career-nine-assessment/src/pages/CampaignRegisterPage.tsx`

**Why:** Single component handling all three URL shapes (`/c/:slug`, `/c/:slug/:assessmentId`, `/c/:slug/:assessmentId/:tierMappingId`) via conditional rendering.

- [ ] **Step 1: Create the file**

```tsx
// career-nine-assessment/src/pages/CampaignRegisterPage.tsx
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { showErrorToast } from "../utils/toast"
import {
  getCampaignInfoBySlug,
  getCampaignInfoByAssessment,
  getCampaignInfoByTier,
  registerForCampaignTier,
} from "../api-clients/campaignAPI"
import { validatePromoCode } from "../api-clients/promoCodeAPI"

type Tier = {
  campaignAssessmentTierId: number
  tierId: number
  name: string
  description?: string
  basePriceInr: number
  priceInr: number
  currency: string
  isDefault: boolean
  includesFinalReport: boolean
  includesDashboard: boolean
  includesCounselling: boolean
  counsellingSessionCount?: number | null
  includesLms: boolean
  lmsValidityDays?: number | null
  dashboardValidityDays?: number | null
}

type Assessment = {
  assessmentId: number
  assessmentName: string
  isActive: boolean
  purchasePath: string
  counsellingModel: string
  tiers: Tier[]
}

type CampaignInfo = {
  campaign: {
    campaignId: number
    name: string
    slug: string
    brandLogoUrl?: string
    targetAudience?: string
    description?: string
    validFrom?: string
    validTo?: string
  }
  assessments: Assessment[]
}

const CampaignRegisterPage = () => {
  const { slug, assessmentId: aidParam, tierId: tidParam } = useParams<{
    slug: string
    assessmentId?: string
    tierId?: string
  }>()
  const navigate = useNavigate()

  const aidFromUrl = aidParam ? Number(aidParam) : null
  const tidFromUrl = tidParam ? Number(tidParam) : null

  const [info, setInfo] = useState<CampaignInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Selection state — seeded from URL, mutated by pickers
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(aidFromUrl)
  const [selectedTierId, setSelectedTierId] = useState<number | null>(tidFromUrl)

  // Form fields
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [dob, setDob] = useState("")
  const [phone, setPhone] = useState("")
  const [gender, setGender] = useState("")

  // Promo
  const [promoCode, setPromoCode] = useState("")
  const [promoApplied, setPromoApplied] = useState<{ code: string; discountPercent: number } | null>(null)
  const [promoError, setPromoError] = useState("")
  const [promoValidating, setPromoValidating] = useState(false)

  useEffect(() => {
    if (!slug) return
    const fetcher =
      tidFromUrl != null && aidFromUrl != null
        ? getCampaignInfoByTier(slug, aidFromUrl, tidFromUrl)
        : aidFromUrl != null
        ? getCampaignInfoByAssessment(slug, aidFromUrl)
        : getCampaignInfoBySlug(slug)
    fetcher
      .then((res) => {
        setInfo(res.data)
        setLoading(false)
      })
      .catch(() => {
        setError("Invalid or expired campaign link.")
        setLoading(false)
      })
  }, [slug, aidFromUrl, tidFromUrl])

  // Resolve currently selected (assessment, tier) from state + info
  const selectedAssessment: Assessment | null =
    info && selectedAssessmentId != null
      ? info.assessments.find((a) => a.assessmentId === selectedAssessmentId) || null
      : null

  const selectedTier: Tier | null =
    selectedAssessment && selectedTierId != null
      ? selectedAssessment.tiers.find((t) => t.campaignAssessmentTierId === selectedTierId) || null
      : null

  const isPaid = (selectedTier?.priceInr ?? 0) > 0
  const discountedPriceInr = promoApplied && selectedTier
    ? selectedTier.priceInr * (100 - promoApplied.discountPercent) / 100
    : (selectedTier?.priceInr ?? 0)

  const handleDobChange = (value: string) => {
    let cleaned = value.replace(/[^0-9-]/g, "")
    const digits = cleaned.replace(/-/g, "")
    if (digits.length <= 2) cleaned = digits
    else if (digits.length <= 4) cleaned = digits.slice(0, 2) + "-" + digits.slice(2)
    else cleaned = digits.slice(0, 2) + "-" + digits.slice(2, 4) + "-" + digits.slice(4, 8)
    setDob(cleaned)
  }

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || !info) return
    setPromoValidating(true)
    setPromoError("")
    setPromoApplied(null)
    try {
      const res = await validatePromoCode(promoCode.trim(), info.campaign.campaignId)
      setPromoApplied({ code: res.data.code, discountPercent: res.data.discountPercent })
    } catch (err: any) {
      const msg = err.response?.data || "Invalid promo code"
      setPromoError(typeof msg === "string" ? msg : "Invalid promo code")
    } finally {
      setPromoValidating(false)
    }
  }

  const handleRemovePromo = () => {
    setPromoApplied(null)
    setPromoCode("")
    setPromoError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!info || !selectedAssessment || !selectedTier) return

    if (!name.trim() || !email.trim() || !dob.trim()) {
      showErrorToast("Please fill in all required fields (Name, Email, Date of Birth).")
      return
    }
    if (!/^\d{2}-\d{2}-\d{4}$/.test(dob)) {
      showErrorToast("Date of Birth must be in dd-mm-yyyy format.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showErrorToast("Please enter a valid email address.")
      return
    }

    setSubmitting(true)
    try {
      const data: any = {
        name: name.trim(),
        email: email.trim(),
        dob,
        phone: phone.trim(),
        gender,
      }
      if (promoApplied) data.promoCode = promoApplied.code

      const res = await registerForCampaignTier(
        info.campaign.slug,
        selectedAssessment.assessmentId,
        selectedTier.campaignAssessmentTierId,
        data,
      )

      if (res.data.status === "payment_required") {
        if (res.data.paymentUrl) {
          window.location.href = res.data.paymentUrl
        } else {
          showErrorToast("Payment link could not be generated. Please try again.")
        }
        return
      }

      if (res.data.userStudentId && res.data.assessments) {
        localStorage.clear()
        localStorage.setItem("userStudentId", String(res.data.userStudentId))
        localStorage.setItem("allottedAssessments", JSON.stringify(res.data.assessments))
        navigate("/allotted-assessment")
        return
      }

      showErrorToast("Unexpected response from server. Please try again.")
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || "Registration failed. Please try again."
      showErrorToast(typeof msg === "string" ? msg : "Registration failed.")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading / Error states ──
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }
  if (error || !info) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: "3rem", color: "#dc3545" }}>!</div>
          <h3 style={{ color: "#1e293b" }}>Link Unavailable</h3>
          <p style={{ color: "#64748b" }}>
            {error || "This campaign link is unavailable. Please contact the administrator for a valid link."}
          </p>
        </div>
      </div>
    )
  }

  // ── Render ──
  const onlyOneAssessmentInUrl = aidFromUrl != null
  const onlyOneTierInUrl = tidFromUrl != null
  const showAssessmentPicker = !onlyOneAssessmentInUrl && info.assessments.length > 0
  const showTierPicker = !onlyOneTierInUrl && selectedAssessment !== null
  const showForm = selectedTier !== null

  return (
    <div style={s.page}>
      <style>{spinKeyframes}</style>

      {/* Campaign header */}
      <div style={s.header}>
        {info.campaign.brandLogoUrl && (
          <img src={info.campaign.brandLogoUrl} alt="" style={s.logo} />
        )}
        <h1 style={s.campaignName}>{info.campaign.name}</h1>
        {info.campaign.targetAudience && <p style={s.targetAudience}>{info.campaign.targetAudience}</p>}
        {info.campaign.description && <p style={s.description}>{info.campaign.description}</p>}
      </div>

      {/* Assessment picker */}
      {showAssessmentPicker && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Choose your assessment</h2>
          <div style={s.assessmentGrid}>
            {info.assessments.map((a) => {
              const isSelected = selectedAssessmentId === a.assessmentId
              return (
                <button
                  key={a.assessmentId}
                  onClick={() => {
                    setSelectedAssessmentId(a.assessmentId)
                    setSelectedTierId(null)
                  }}
                  style={isSelected ? { ...s.assessmentCard, ...s.assessmentCardSelected } : s.assessmentCard}
                >
                  <h3 style={s.assessmentCardTitle}>{a.assessmentName}</h3>
                  <p style={s.assessmentCardMeta}>
                    {a.tiers.length} tier{a.tiers.length === 1 ? "" : "s"} available
                  </p>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Tier picker */}
      {showTierPicker && selectedAssessment && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Choose a tier{!showAssessmentPicker ? "" : ` — ${selectedAssessment.assessmentName}`}</h2>
          <div style={s.tierGrid}>
            {selectedAssessment.tiers.map((t) => (
              <TierCard
                key={t.campaignAssessmentTierId}
                tier={t}
                selected={selectedTierId === t.campaignAssessmentTierId}
                onSelect={() => setSelectedTierId(t.campaignAssessmentTierId)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Locked-in tier summary (when URL pre-selected) */}
      {onlyOneTierInUrl && selectedTier && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Selected tier</h2>
          <TierCard tier={selectedTier} selected={true} onSelect={() => {}} />
        </section>
      )}

      {/* Registration form */}
      {showForm && selectedTier && (
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Your details</h2>
          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.row}>
              <label style={s.label}>
                Full Name <span style={s.required}>*</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={s.input} />
              </label>
            </div>
            <div style={s.gridTwo}>
              <label style={s.label}>
                Email <span style={s.required}>*</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={s.input} />
              </label>
              <label style={s.label}>
                Date of Birth <span style={s.required}>*</span>
                <input type="text" placeholder="dd-mm-yyyy" value={dob} maxLength={10}
                       onChange={(e) => handleDobChange(e.target.value)} required style={s.input} />
              </label>
            </div>
            <div style={s.gridTwo}>
              <label style={s.label}>
                Phone Number
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={s.input} />
              </label>
              <label style={s.label}>
                Gender
                <select value={gender} onChange={(e) => setGender(e.target.value)} style={s.input}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>

            {/* Promo code */}
            {isPaid && (
              <div style={s.promoBlock}>
                <label style={s.label}>Promo Code</label>
                {promoApplied ? (
                  <div style={s.promoApplied}>
                    <span>{promoApplied.code} — {promoApplied.discountPercent}% off</span>
                    <button type="button" onClick={handleRemovePromo} style={s.promoRemove}>Remove</button>
                  </div>
                ) : (
                  <div style={s.promoInputRow}>
                    <input type="text" placeholder="Enter code" value={promoCode}
                           onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError("") }}
                           onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleApplyPromo())}
                           style={{ ...s.input, marginBottom: 0 }} />
                    <button type="button" onClick={handleApplyPromo}
                            disabled={promoValidating || !promoCode.trim()}
                            style={s.promoApply}>
                      {promoValidating ? "..." : "Apply"}
                    </button>
                  </div>
                )}
                {promoError && <div style={s.promoError}>{promoError}</div>}
              </div>
            )}

            <button type="submit" disabled={submitting} style={s.submit}>
              {submitting
                ? (isPaid && discountedPriceInr > 0 ? "Processing..." : "Registering...")
                : isPaid && discountedPriceInr > 0
                ? `Register & Pay INR ${discountedPriceInr}`
                : "Register"}
            </button>
          </form>
        </section>
      )}
    </div>
  )
}

// ── TierCard sub-component ──
function TierCard({ tier, selected, onSelect }: { tier: Tier; selected: boolean; onSelect: () => void }) {
  const features: string[] = []
  if (tier.includesFinalReport) features.push("Final report")
  if (tier.includesCounselling && tier.counsellingSessionCount) {
    features.push(`${tier.counsellingSessionCount}× counselling session${tier.counsellingSessionCount > 1 ? "s" : ""}`)
  }
  if (tier.includesDashboard) {
    features.push(tier.dashboardValidityDays ? `Dashboard (${tier.dashboardValidityDays} days)` : "Dashboard access")
  }
  if (tier.includesLms) {
    features.push(tier.lmsValidityDays ? `LMS (${tier.lmsValidityDays} days)` : "LMS access")
  }

  return (
    <button onClick={onSelect} style={selected ? { ...s.tierCard, ...s.tierCardSelected } : s.tierCard}>
      {tier.isDefault && <span style={s.recommendedBadge}>Recommended</span>}
      <h3 style={s.tierTitle}>{tier.name}</h3>
      <div style={s.tierPriceLine}>
        {tier.priceInr !== tier.basePriceInr && (
          <span style={s.tierBasePrice}>INR {tier.basePriceInr}</span>
        )}
        <span style={s.tierPrice}>INR {tier.priceInr}</span>
      </div>
      {tier.description && <p style={s.tierDescription}>{tier.description}</p>}
      <ul style={s.tierFeatures}>
        {features.map((f) => <li key={f}>{f}</li>)}
      </ul>
    </button>
  )
}

// ── Styles ──
const spinKeyframes = `@keyframes spin { to { transform: rotate(360deg); } }`

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(145deg, #f0fdf4 0%, #ecfeff 30%, #f0f9ff 60%, #faf5ff 100%)",
    padding: "32px 24px",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  header: { maxWidth: 720, margin: "0 auto 32px", textAlign: "center" },
  logo: { maxWidth: 180, marginBottom: 16 },
  campaignName: { fontSize: "2rem", fontWeight: 800, margin: "0 0 8px", color: "#0f172a" },
  targetAudience: { color: "#10b981", fontWeight: 600, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 },
  description: { color: "#64748b", marginTop: 12 },
  section: { maxWidth: 720, margin: "0 auto 32px" },
  sectionTitle: { fontSize: "1.3rem", fontWeight: 700, color: "#1e293b", marginBottom: 16 },
  assessmentGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 },
  assessmentCard: {
    padding: 20, borderRadius: 12, border: "2px solid #e2e8f0",
    background: "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
  },
  assessmentCardSelected: { borderColor: "#10b981", boxShadow: "0 0 0 3px rgba(16,185,129,0.15)" },
  assessmentCardTitle: { fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", margin: "0 0 6px" },
  assessmentCardMeta: { color: "#64748b", fontSize: "0.85rem", margin: 0 },
  tierGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 },
  tierCard: {
    padding: 20, borderRadius: 14, border: "2px solid #e2e8f0",
    background: "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
    position: "relative", display: "flex", flexDirection: "column", gap: 8,
  },
  tierCardSelected: { borderColor: "#10b981", boxShadow: "0 0 0 3px rgba(16,185,129,0.15)" },
  recommendedBadge: {
    position: "absolute", top: -10, right: 16, background: "#10b981", color: "#fff",
    fontSize: "0.72rem", padding: "3px 10px", borderRadius: 999, fontWeight: 700,
  },
  tierTitle: { fontSize: "1.15rem", fontWeight: 700, color: "#1e293b", margin: 0 },
  tierPriceLine: { display: "flex", alignItems: "baseline", gap: 8 },
  tierBasePrice: { textDecoration: "line-through", color: "#94a3b8", fontSize: "0.85rem" },
  tierPrice: { fontSize: "1.4rem", fontWeight: 800, color: "#0f172a" },
  tierDescription: { color: "#64748b", fontSize: "0.85rem", margin: 0 },
  tierFeatures: { listStyle: "disc", paddingLeft: 18, color: "#374151", fontSize: "0.88rem", margin: 0 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  row: {},
  gridTwo: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  label: { display: "flex", flexDirection: "column", fontSize: "0.85rem", color: "#374151", fontWeight: 600 },
  required: { color: "#f43f5e" },
  input: {
    marginTop: 6, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0",
    background: "#fff", fontSize: "0.95rem", outline: "none", fontFamily: "inherit", color: "#1e293b",
  },
  promoBlock: { display: "flex", flexDirection: "column", gap: 8 },
  promoApplied: {
    display: "flex", alignItems: "center", gap: 12,
    background: "#ecfdf5", border: "1.5px solid #6ee7b7", borderRadius: 10, padding: "10px 14px",
    color: "#065f46", fontWeight: 600, fontSize: "0.9rem",
  },
  promoRemove: {
    marginLeft: "auto", background: "transparent", border: "1.5px solid #fca5a5",
    color: "#ef4444", borderRadius: 8, padding: "4px 10px", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
  },
  promoInputRow: { display: "flex", gap: 8 },
  promoApply: {
    border: "1.5px solid #10b981", color: "#10b981", background: "transparent",
    borderRadius: 10, padding: "0 18px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  },
  promoError: { color: "#ef4444", fontSize: "0.82rem" },
  submit: {
    marginTop: 8, padding: "14px 22px", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff",
    fontSize: "1rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  },
}

export default CampaignRegisterPage
```

- [ ] **Step 2: Stage the commit**

```bash
git -C /home/babayaga/Projects/career-nine-sandbox add \
  career-nine-assessment/src/pages/CampaignRegisterPage.tsx
git -C /home/babayaga/Projects/career-nine-sandbox commit -m "feat: add CampaignRegisterPage with layered URL forms and auto-login"
```

(The page imports `PaymentStatusPage` indirectly via the `/payment-status` route — already mounted in `App.tsx` from earlier today.)

---

### Task 11: Wire the three routes in `App.tsx`

**Files:**
- Modify: `career-nine-assessment/src/App.tsx`

- [ ] **Step 1: Add the import and routes**

In `career-nine-assessment/src/App.tsx`, add the import alongside the existing page imports (after `PaymentStatusPage`):

```tsx
import CampaignRegisterPage from './pages/CampaignRegisterPage'
```

In the `<Routes>` block, add three routes immediately after the existing `<Route path="/payment-status" ... />`:

```tsx
<Route path="/c/:slug" element={<CampaignRegisterPage />} />
<Route path="/c/:slug/:assessmentId" element={<CampaignRegisterPage />} />
<Route path="/c/:slug/:assessmentId/:tierId" element={<CampaignRegisterPage />} />
```

- [ ] **Step 2: Stage the commit**

```bash
git -C /home/babayaga/Projects/career-nine-sandbox add career-nine-assessment/src/App.tsx
git -C /home/babayaga/Projects/career-nine-sandbox commit -m "feat: register /c/:slug routes in assessment app"
```

---

### Phase 2 staging gate

Deploy the assessment frontend to staging. Smoke test in a real browser:

1. `/c/{slug}` → assessment grid renders → click an assessment → tier picker renders → click a tier → form renders → fill + submit (free tier) → land on `/allotted-assessment`.
2. `/c/{slug}/{aid}` → tier picker renders directly → continue as above.
3. `/c/{slug}/{aid}/{tid}` → form renders directly with locked tier card → submit (paid tier) → Razorpay → return to `/payment-status` → polling → auto-login.
4. Apply a promo code that's mapped to this campaign → success.
5. Apply a promo code NOT mapped to this campaign → toast with "Code not valid for this campaign."
6. Apply a school-flow (global) promo code → toast with "for a specific campaign — open the campaign link."
7. Submit with an existing email + matching DOB → auto-login (existing student gets the campaign assessment+entitlement attached).
8. Submit with an existing email + wrong DOB → toast with the impersonation-block message.

---

## Phase 3 — Dashboard Frontend (depends on Phase 2 deployed)

### Task 12: Add campaign-mapping clients in `PromoCode_APIs.ts`

**Files:**
- Modify: `react-social/src/app/pages/PromoCode/API/PromoCode_APIs.ts`

- [ ] **Step 1: Verify current contents and append**

Read the file and append (after existing exports, before `export {}` if any):

```typescript
export function getPromoCodeCampaigns(id: number) {
  return axios.get<number[]>(`${API_URL}/promo-codes/${id}/campaigns`)
}

export function setPromoCodeCampaigns(id: number, campaignIds: number[]) {
  return axios.put(`${API_URL}/promo-codes/${id}/campaigns`, { campaignIds })
}
```

(`API_URL` and `axios` should already be imported in the file — verify before appending.)

- [ ] **Step 2: Stage the commit**

```bash
git -C /home/babayaga/Projects/career-nine-sandbox add \
  react-social/src/app/pages/PromoCode/API/PromoCode_APIs.ts
git -C /home/babayaga/Projects/career-nine-sandbox commit -m "feat: add promo-code campaign-mapping API clients"
```

---

### Task 13: Add `CampaignPicker` to `PromoCodePage`

**Files:**
- Create: `react-social/src/app/pages/PromoCode/components/CampaignPicker.tsx`
- Modify: `react-social/src/app/pages/PromoCode/PromoCodePage.tsx`

**Why:** Admin needs a multi-select to pick which campaigns a promo code is valid for. Save-promo flow does the existing PUT followed by `setPromoCodeCampaigns`.

- [ ] **Step 1: Create the picker component**

```tsx
// react-social/src/app/pages/PromoCode/components/CampaignPicker.tsx
import { useEffect, useState } from "react"
import { getCampaigns } from "../../B2C/API/Campaign_APIs"

type Campaign = { campaignId: number; name: string }

export type CampaignPickerProps = {
  selectedIds: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}

const CampaignPicker = ({ selectedIds, onChange, disabled }: CampaignPickerProps) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCampaigns()
      .then((res: any) => {
        const list = (res.data || []).map((c: any) => ({
          campaignId: c.campaignId, name: c.name,
        }))
        setCampaigns(list)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const toggle = (id: number) => {
    if (disabled) return
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id))
    else onChange([...selectedIds, id])
  }

  if (loading) return <div className="text-muted">Loading campaigns...</div>
  if (campaigns.length === 0) return <div className="text-muted">No campaigns available.</div>

  return (
    <div>
      {campaigns.map((c) => (
        <label key={c.campaignId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={selectedIds.includes(c.campaignId)}
            onChange={() => toggle(c.campaignId)}
            disabled={disabled}
          />
          <span>{c.name}</span>
        </label>
      ))}
    </div>
  )
}

export default CampaignPicker
```

- [ ] **Step 2: Verify `getCampaigns` exists in B2C API**

```bash
grep -n "getCampaigns\|export function getCampaigns\|export const getCampaigns" \
  /home/babayaga/Projects/career-nine-sandbox/react-social/src/app/pages/B2C/API/Campaign_APIs.ts
```

Expected: a function named `getCampaigns` returning `axios.get` of the campaign list. If absent, add it:

```typescript
export const getCampaigns = () => axios.get(`${API_URL}/campaign/getAll`)
```

(Use whatever import / `API_URL` the file already has.)

- [ ] **Step 3: Wire the picker into `PromoCodePage`**

This is the most context-heavy step. Open `react-social/src/app/pages/PromoCode/PromoCodePage.tsx` and integrate as follows:

1. Add imports at the top:

```tsx
import { useEffect } from "react"  // if not already imported
import CampaignPicker from "./components/CampaignPicker"
import {
  getPromoCodeCampaigns,
  setPromoCodeCampaigns,
} from "./API/PromoCode_APIs"
```

2. In the form-state declarations (alongside the existing fields like code/discountPercent/etc.), add:

```tsx
const [restrictMode, setRestrictMode] = useState<"global" | "campaigns">("global")
const [linkedCampaignIds, setLinkedCampaignIds] = useState<number[]>([])
```

3. When loading an existing promo code into the edit form, fetch its campaign mappings:

```tsx
useEffect(() => {
  if (!editingPromoId) {
    setRestrictMode("global")
    setLinkedCampaignIds([])
    return
  }
  getPromoCodeCampaigns(editingPromoId)
    .then((res: any) => {
      const ids: number[] = res.data || []
      setRestrictMode(ids.length > 0 ? "campaigns" : "global")
      setLinkedCampaignIds(ids)
    })
    .catch(() => {
      setRestrictMode("global")
      setLinkedCampaignIds([])
    })
}, [editingPromoId])
```

(Use whatever variable holds "the promo code currently being edited"; in this codebase it is likely `editingPromoId` or similar — read the existing file to confirm.)

4. In the form JSX, inside the existing fields block, add a new block:

```tsx
<div className="mb-3">
  <label className="form-label fw-bold">Restrict to campaigns</label>
  <div>
    <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <input
        type="radio"
        checked={restrictMode === "global"}
        onChange={() => { setRestrictMode("global"); setLinkedCampaignIds([]) }}
      />
      <span>Available everywhere (school flow only — current behavior)</span>
    </label>
    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="radio"
        checked={restrictMode === "campaigns"}
        onChange={() => setRestrictMode("campaigns")}
      />
      <span>Restrict to specific campaigns</span>
    </label>
  </div>
  {restrictMode === "campaigns" && (
    <div style={{ marginTop: 8, paddingLeft: 24 }}>
      <CampaignPicker
        selectedIds={linkedCampaignIds}
        onChange={setLinkedCampaignIds}
      />
    </div>
  )}
</div>
```

5. After the existing save-promo call (the `PUT /promo-codes/{id}` or `POST /create`), chain a call to set campaigns:

```tsx
// existing save call returns a saved promo code with .data.id (or .data.promoCodeId — check existing code)
const savedId = res.data.id ?? res.data.promoCodeId
const ids = restrictMode === "campaigns" ? linkedCampaignIds : []
await setPromoCodeCampaigns(savedId, ids)
```

Wrap appropriately so that if the second call fails, the user sees an error toast and the local state is preserved for retry.

- [ ] **Step 4: Stage the commit**

```bash
git -C /home/babayaga/Projects/career-nine-sandbox add \
  react-social/src/app/pages/PromoCode/components/CampaignPicker.tsx \
  react-social/src/app/pages/PromoCode/PromoCodePage.tsx \
  react-social/src/app/pages/B2C/API/Campaign_APIs.ts
git -C /home/babayaga/Projects/career-nine-sandbox commit -m "feat: add CampaignPicker for restricting promo codes to campaigns"
```

(Include `Campaign_APIs.ts` in the add command only if you needed to add `getCampaigns` in Step 2.)

---

### Task 14: Add `RegistrationLinks` to `CampaignEditPage`

**Files:**
- Create: `react-social/src/app/pages/B2C/Campaign/components/RegistrationLinks.tsx`
- Modify: `react-social/src/app/pages/B2C/Campaign/CampaignEditPage.tsx`

**Why:** Admins need an in-page surface to read/copy the three URL forms per (campaign, assessment, tier).

- [ ] **Step 1: Create the component**

```tsx
// react-social/src/app/pages/B2C/Campaign/components/RegistrationLinks.tsx
import { useState } from "react"

type Tier = { campaignAssessmentTierId: number; pricingTierId: number; name?: string }
type AssessmentBlock = {
  assessmentId: number
  assessmentName: string
  tiers: Tier[]
}

export type RegistrationLinksProps = {
  slug: string
  assessments: AssessmentBlock[]
}

const ASSESSMENT_DOMAIN =
  process.env.REACT_APP_ASSESSMENT_APP_URL || "https://assessment.career-9.com"

const RegistrationLinks = ({ slug, assessments }: RegistrationLinksProps) => {
  const [copied, setCopied] = useState<string>("")

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => { setCopied(label); setTimeout(() => setCopied(""), 1500) },
      () => window.prompt("Copy this link:", text),
    )
  }

  const campaignUrl = `${ASSESSMENT_DOMAIN}/c/${slug}`
  return (
    <div className="card mt-4">
      <div className="card-body">
        <h5 className="mb-2">Public Registration Links</h5>
        <p className="text-muted small">
          Share these URLs to drive students to register and pay.
        </p>

        <div className="mb-3">
          <label className="form-label fw-bold">Campaign-wide link</label>
          <div className="d-flex gap-2 align-items-center">
            <code className="flex-grow-1 p-2 bg-light rounded">{campaignUrl}</code>
            <button className="btn btn-sm btn-outline-primary"
                    onClick={() => copy(campaignUrl, "campaign")}>
              {copied === "campaign" ? "Copied" : "Copy"}
            </button>
          </div>
          <small className="text-muted">Shows all assessments and tiers in this campaign.</small>
        </div>

        {assessments.length > 0 && (
          <>
            <h6 className="mt-3">Per-assessment & per-tier links</h6>
            {assessments.map((a) => {
              const aUrl = `${ASSESSMENT_DOMAIN}/c/${slug}/${a.assessmentId}`
              return (
                <div key={a.assessmentId} className="border rounded p-3 mb-3">
                  <div className="fw-bold mb-2">{a.assessmentName}</div>

                  <div className="mb-2">
                    <small className="text-muted">Assessment-only link (shows tier picker):</small>
                    <div className="d-flex gap-2 align-items-center mt-1">
                      <code className="flex-grow-1 p-2 bg-light rounded">{aUrl}</code>
                      <button className="btn btn-sm btn-outline-primary"
                              onClick={() => copy(aUrl, `a-${a.assessmentId}`)}>
                        {copied === `a-${a.assessmentId}` ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  {a.tiers.length > 0 && (
                    <div>
                      <small className="text-muted">Per-tier deep links:</small>
                      {a.tiers.map((t) => {
                        const tUrl = `${ASSESSMENT_DOMAIN}/c/${slug}/${a.assessmentId}/${t.campaignAssessmentTierId}`
                        const key = `t-${t.campaignAssessmentTierId}`
                        return (
                          <div key={t.campaignAssessmentTierId} className="d-flex gap-2 align-items-center mt-1">
                            <span className="text-muted me-2" style={{ minWidth: 100 }}>
                              {t.name || `Tier #${t.pricingTierId}`}
                            </span>
                            <code className="flex-grow-1 p-2 bg-light rounded">{tUrl}</code>
                            <button className="btn btn-sm btn-outline-primary"
                                    onClick={() => copy(tUrl, key)}>
                              {copied === key ? "Copied" : "Copy"}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

export default RegistrationLinks
```

- [ ] **Step 2: Inspect `CampaignEditPage` to find where to mount it**

```bash
grep -n "campaign\|assessment\|tier" \
  /home/babayaga/Projects/career-nine-sandbox/react-social/src/app/pages/B2C/Campaign/CampaignEditPage.tsx \
  | head -40
```

Find the data shape returned by the existing `getCampaignById` (or whatever fetcher). The component needs `slug`, plus the list of attached assessments with each one's tiers (tier id, campaign-assessment-tier id, tier name).

- [ ] **Step 3: Mount the component**

In `CampaignEditPage.tsx`:

1. Add import:

```tsx
import RegistrationLinks from "./components/RegistrationLinks"
```

2. After the existing form / save section (in JSX), only when `campaign?.slug` is truthy, render:

```tsx
{campaign?.slug && (
  <RegistrationLinks
    slug={campaign.slug}
    assessments={(campaign.assessments || []).map((a: any) => ({
      assessmentId: a.assessmentId,
      assessmentName: a.assessmentName,
      tiers: (a.tiers || []).map((t: any) => ({
        campaignAssessmentTierId: t.campaignAssessmentTierId ?? t.id,
        pricingTierId: t.pricingTierId,
        name: t.name || t.pricingTierName,
      })),
    }))}
  />
)}
```

(The exact prop names depend on what `toFullDto` on the backend returns — adjust if the `assessments` array uses different keys. The fields available are documented in the `CampaignController.toFullDto` method.)

- [ ] **Step 4: Stage the commit**

```bash
git -C /home/babayaga/Projects/career-nine-sandbox add \
  react-social/src/app/pages/B2C/Campaign/components/RegistrationLinks.tsx \
  react-social/src/app/pages/B2C/Campaign/CampaignEditPage.tsx
git -C /home/babayaga/Projects/career-nine-sandbox commit -m "feat: add RegistrationLinks panel to CampaignEditPage"
```

---

### Task 15: Add `CampaignLandingRedirect` routes on dashboard

**Files:**
- Modify: `react-social/src/app/routing/AppRoutes.tsx`

**Why:** Cheap insurance against any test-sent emails containing dashboard `/c/...` URLs from when `LinkBuilder` defaulted to the dashboard.

- [ ] **Step 1: Add the redirect component**

In `react-social/src/app/routing/AppRoutes.tsx`, alongside the existing `RedirectAssessmentRegister` and `RedirectPaymentStatus` components (added earlier today), add:

```tsx
const CampaignLandingRedirect: FC = () => {
  const params = useParams<{ slug?: string; assessmentId?: string; tierId?: string }>();
  useEffect(() => {
    let path = `/c/${params.slug ?? ""}`;
    if (params.assessmentId) path += `/${params.assessmentId}`;
    if (params.tierId) path += `/${params.tierId}`;
    const target = `${process.env.REACT_APP_ASSESSMENT_APP_URL}${path}${window.location.search}`;
    window.location.replace(target);
  }, [params.slug, params.assessmentId, params.tierId]);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#555" }}>
      Redirecting…
    </div>
  );
};
```

- [ ] **Step 2: Add three routes**

In the `<Routes>` block, add three routes alongside the other redirect routes (after `/payment-status`):

```tsx
<Route path="/c/:slug" element={<CampaignLandingRedirect />} />
<Route path="/c/:slug/:assessmentId" element={<CampaignLandingRedirect />} />
<Route path="/c/:slug/:assessmentId/:tierId" element={<CampaignLandingRedirect />} />
```

- [ ] **Step 3: Stage the commit**

```bash
git -C /home/babayaga/Projects/career-nine-sandbox add \
  react-social/src/app/routing/AppRoutes.tsx
git -C /home/babayaga/Projects/career-nine-sandbox commit -m "feat: redirect dashboard /c/* URLs to assessment domain"
```

---

### Phase 3 staging gate

Deploy dashboard frontend to staging. Verify:

1. Open a campaign in `CampaignEditPage` → "Public Registration Links" panel appears at the bottom with the three URL forms. Copy buttons work.
2. Open `PromoCodePage`, edit a code → toggle "Restrict to specific campaigns" → pick campaigns → save. Reload → mappings persist.
3. Visit `staging-dashboard.career-9.com/c/some-slug` → redirected to `staging-assessment.career-9.com/c/some-slug` (query string preserved).
4. Visit `staging-dashboard.career-9.com/c/some-slug/123/45?utm_source=test` → query string preserved through redirect.
5. End-to-end: in dashboard, generate a per-tier link → open in incognito → register + pay → auto-login on assessment domain → assessment visible on `/allotted-assessment`.

---

## Self-review checklist

- [ ] Phase 1 backend changes are additive (existing `validatePromoCode` callers without `campaignId` keep working — preserved school flow semantics).
- [ ] Phase 1 deploys safely without Phase 2 (frontend-side: nothing references the new endpoints yet; backend just exposes them).
- [ ] Phase 2 deploys safely without Phase 3 (newly generated public links work end-to-end as soon as Phase 1 + Phase 2 are live; admins build URLs by hand until Phase 3 lands).
- [ ] Phase 3 deploys safely on top of Phase 2 (admins gain the link-generation UI; redirect catches stragglers).
- [ ] Each phase has a staging smoke-test gate.
- [ ] No flag-day or atomic-deploy requirement.
- [ ] Every reference to `userStudentId` matches between backend (Long) and frontend (number → `String(...)` for localStorage).
- [ ] No placeholders, no "TBD," every code block is complete.
- [ ] Per-task commits are *staged* (commands shown to user) — never run automatically per the project's no-auto-commit rule.

## Rollback notes

- **Phase 3 (dashboard FE):** revert each commit. Admins lose the UI surfaces but can still manually build URLs and admin-edit promo-code junctions via direct API calls if needed.
- **Phase 2 (assessment FE):** revert. Routes `/c/...` 404 to `/student-login` (existing wildcard). Live links would 404 on assessment domain — but redirect from Phase 3 (if still deployed) bounces them, leaving them in a flicker loop. Either roll back Phase 3 too or accept temporary breakage.
- **Phase 1 backend:** revert. New `promo_code_campaigns` table stays (Hibernate doesn't drop). Endpoints 404. School-flow `validatePromoCode` reverts to original behavior. Frontend `/campaign/public/...` calls 404 → page shows "Link Unavailable" error.
