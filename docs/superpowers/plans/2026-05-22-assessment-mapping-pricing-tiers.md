# Assessment Mapping Pricing Tiers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `amount` price on an `AssessmentInstituteMapping` with an ordered list of pricing tiers, where the live price auto-switches from one tier to the next as each tier's registration cap is reached.

**Architecture:** A new per-mapping `AssessmentMappingTier` entity holds `name`, `amount`, `sortOrder`, `maxRegistrations`, and a stored `currentCount` tally. A small `AssessmentMappingTierService` owns the pure "which tier is live" resolution (lowest active `sortOrder` whose `currentCount < maxRegistrations`, unlimited last). Public info/register endpoints resolve the active tier server-side; the tally is incremented on free completion (inline) and paid completion (Razorpay webhook), with a `recount` backstop. Existing mappings are migrated to a single unlimited "Standard" tier so pricing is unchanged.

**Tech Stack:** Spring Boot 2.5.5 / Java 11 / JPA / MySQL (backend); React 18 + TypeScript + react-bootstrap (frontend); JUnit 5 for backend unit tests.

**Spec:** `docs/superpowers/specs/2026-05-22-assessment-mapping-pricing-tiers-design.md`

**Conventions / constraints:**
- Per CLAUDE.md: do **NOT** run `npm run build`, `tsc`, or frontend tests unless explicitly asked. Frontend tasks end at code changes; verification is manual.
- New tier admin endpoints stay **unprotected**, matching the sibling mapping admin endpoints (`/create`, `/update`, `/delete`). No `@PreAuthorize`.
- Hibernate `ddl-auto: update` auto-creates the new table/columns; the migration SQL is for backfilling existing rows only.
- Money is stored as `Long` rupees throughout (matching `AssessmentInstituteMapping.amount`).

---

## File structure

**Backend (create):**
- `spring-social/src/main/java/com/kccitm/api/model/career9/AssessmentMappingTier.java` — entity
- `spring-social/src/main/java/com/kccitm/api/repository/Career9/AssessmentMappingTierRepository.java` — repository
- `spring-social/src/main/java/com/kccitm/api/service/career9/AssessmentMappingTierService.java` — active-tier resolution + recount
- `spring-social/src/test/java/com/kccitm/api/service/career9/AssessmentMappingTierServiceTest.java` — unit tests
- `spring-social/migrations/2026-05-22-backfill-mapping-tiers.sql` — data migration

**Backend (modify):**
- `.../model/career9/PaymentTransaction.java` — add `mappingTierId` column + accessors
- `.../repository/Career9/PaymentTransactionRepository.java` — add `countByMappingTierIdAndStatus`
- `.../controller/career9/AssessmentInstituteMappingController.java` — tier CRUD; tier-aware public info + register
- `.../controller/career9/PaymentWebhookController.java` — increment tier tally on paid completion

**Frontend (create):**
- `react-social/src/app/pages/College/components/TierManagementModal.tsx` — tier list + add/toggle, and the nested add/edit form modal

**Frontend (modify):**
- `react-social/src/app/pages/AssessmentMapping/API/AssessmentMapping_APIs.ts` — tier CRUD API functions + `AssessmentMappingTier` type
- `react-social/src/app/pages/College/components/AssessmentMappingPanel.tsx` — replace amount input with "Manage Tiers"; create-then-add tiers; show live tier in table

---

## Task 1: `AssessmentMappingTier` entity

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/model/career9/AssessmentMappingTier.java`

- [ ] **Step 1: Create the entity**

Mirror the column/`@PrePersist` style of `AssessmentInstituteMapping.java`.

```java
package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "assessment_mapping_tier",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_mapping_tier_sort",
           columnNames = {"mapping_id", "sort_order"}
       ))
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class AssessmentMappingTier implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tier_id")
    private Long tierId;

    @Column(name = "mapping_id", nullable = false)
    private Long mappingId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "amount")
    private Long amount;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(name = "max_registrations")
    private Integer maxRegistrations;

    @Column(name = "current_count", nullable = false, columnDefinition = "INT DEFAULT 0")
    private Integer currentCount = 0;

    @Column(name = "is_active", columnDefinition = "BOOLEAN DEFAULT TRUE")
    private Boolean isActive = true;

    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date createdAt;

    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) this.createdAt = new Date();
        if (this.updatedAt == null) this.updatedAt = new Date();
        if (this.currentCount == null) this.currentCount = 0;
        if (this.isActive == null) this.isActive = true;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = new Date();
    }

    public AssessmentMappingTier() {}

    public Long getTierId() { return tierId; }
    public void setTierId(Long tierId) { this.tierId = tierId; }

    public Long getMappingId() { return mappingId; }
    public void setMappingId(Long mappingId) { this.mappingId = mappingId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }

    public Integer getMaxRegistrations() { return maxRegistrations; }
    public void setMaxRegistrations(Integer maxRegistrations) { this.maxRegistrations = maxRegistrations; }

    public Integer getCurrentCount() { return currentCount; }
    public void setCurrentCount(Integer currentCount) { this.currentCount = currentCount; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }

    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }
}
```

- [ ] **Step 2: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/model/career9/AssessmentMappingTier.java
git commit -m "feat: add AssessmentMappingTier entity"
```

---

## Task 2: `AssessmentMappingTierRepository`

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/repository/Career9/AssessmentMappingTierRepository.java`

- [ ] **Step 1: Create the repository**

The `tryIncrementCount` query mirrors `SchoolRegistrationLinkRepository.tryIncrementCount` exactly (atomic, cap-guarded, returns rows affected).

```java
package com.kccitm.api.repository.Career9;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.AssessmentMappingTier;

@Repository
public interface AssessmentMappingTierRepository extends JpaRepository<AssessmentMappingTier, Long> {

    List<AssessmentMappingTier> findByMappingIdOrderBySortOrderAsc(Long mappingId);

    List<AssessmentMappingTier> findByMappingIdAndIsActiveOrderBySortOrderAsc(Long mappingId, Boolean isActive);

    void deleteByMappingId(Long mappingId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE AssessmentMappingTier t SET t.currentCount = COALESCE(t.currentCount, 0) + 1 " +
           "WHERE t.tierId = :tierId AND (COALESCE(t.maxRegistrations, 0) = 0 OR COALESCE(t.currentCount, 0) < COALESCE(t.maxRegistrations, 0))")
    int tryIncrementCount(@Param("tierId") Long tierId);
}
```

- [ ] **Step 2: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/repository/Career9/AssessmentMappingTierRepository.java
git commit -m "feat: add AssessmentMappingTierRepository with atomic increment"
```

---

## Task 3: `AssessmentMappingTierService` — active-tier resolution (TDD)

The resolution algorithm is the highest-risk logic, so it is built test-first as a pure method that takes a tier list and returns the live tier (or null when all are exhausted).

**Files:**
- Create: `spring-social/src/main/java/com/kccitm/api/service/career9/AssessmentMappingTierService.java`
- Test: `spring-social/src/test/java/com/kccitm/api/service/career9/AssessmentMappingTierServiceTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.kccitm.api.service.career9;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.kccitm.api.model.career9.AssessmentMappingTier;

class AssessmentMappingTierServiceTest {

    private final AssessmentMappingTierService service = new AssessmentMappingTierService();

    private AssessmentMappingTier tier(String name, int sortOrder, Integer max, int current, boolean active) {
        AssessmentMappingTier t = new AssessmentMappingTier();
        t.setName(name);
        t.setSortOrder(sortOrder);
        t.setMaxRegistrations(max);
        t.setCurrentCount(current);
        t.setIsActive(active);
        return t;
    }

    @Test
    void picksLowestSortOrderTierUnderCap() {
        List<AssessmentMappingTier> tiers = Arrays.asList(
            tier("Main", 2, null, 0, true),
            tier("Pilot", 1, 100, 50, true));
        assertEquals("Pilot", service.resolveActiveTier(tiers).getName());
    }

    @Test
    void switchesToNextTierWhenFirstExhausted() {
        List<AssessmentMappingTier> tiers = Arrays.asList(
            tier("Pilot", 1, 100, 100, true),
            tier("Main", 2, null, 0, true));
        assertEquals("Main", service.resolveActiveTier(tiers).getName());
    }

    @Test
    void skipsInactiveTiers() {
        List<AssessmentMappingTier> tiers = Arrays.asList(
            tier("Pilot", 1, 100, 0, false),
            tier("Main", 2, null, 0, true));
        assertEquals("Main", service.resolveActiveTier(tiers).getName());
    }

    @Test
    void treatsNullAndZeroMaxAsUnlimited() {
        List<AssessmentMappingTier> tiers = Arrays.asList(
            tier("Unlimited", 1, 0, 9999, true));
        assertEquals("Unlimited", service.resolveActiveTier(tiers).getName());
    }

    @Test
    void returnsNullWhenAllCappedTiersFull() {
        List<AssessmentMappingTier> tiers = Arrays.asList(
            tier("Pilot", 1, 100, 100, true),
            tier("Main", 2, 50, 50, true));
        assertNull(service.resolveActiveTier(tiers));
    }

    @Test
    void returnsNullForEmptyList() {
        assertNull(service.resolveActiveTier(Collections.emptyList()));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd spring-social && mvn -q test -Dtest=AssessmentMappingTierServiceTest`
Expected: FAIL — compilation error, `AssessmentMappingTierService` does not exist.

- [ ] **Step 3: Write the service**

```java
package com.kccitm.api.service.career9;

import java.util.Comparator;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.AssessmentMappingTier;
import com.kccitm.api.repository.Career9.AssessmentMappingTierRepository;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;

@Service
public class AssessmentMappingTierService {

    @Autowired(required = false)
    private AssessmentMappingTierRepository tierRepository;

    @Autowired(required = false)
    private PaymentTransactionRepository paymentTransactionRepository;

    /**
     * Pure resolution: the live tier is the active tier with the lowest sortOrder
     * whose currentCount is below its cap. A null/0 maxRegistrations is unlimited.
     * Returns null when every active tier is capped and full (registration closed).
     */
    public AssessmentMappingTier resolveActiveTier(List<AssessmentMappingTier> tiers) {
        if (tiers == null) return null;
        return tiers.stream()
            .filter(t -> Boolean.TRUE.equals(t.getIsActive()))
            .sorted(Comparator.comparingInt(t ->
                t.getSortOrder() == null ? Integer.MAX_VALUE : t.getSortOrder()))
            .filter(t -> {
                Integer max = t.getMaxRegistrations();
                int cur = t.getCurrentCount() == null ? 0 : t.getCurrentCount();
                return max == null || max == 0 || cur < max;
            })
            .findFirst()
            .orElse(null);
    }

    /** Convenience: load a mapping's tiers and resolve the live one. */
    public AssessmentMappingTier resolveActiveTierForMapping(Long mappingId) {
        return resolveActiveTier(
            tierRepository.findByMappingIdOrderBySortOrderAsc(mappingId));
    }

    /** Drift backstop: rebuild currentCount from completed (paid) transactions. */
    public int recountTier(Long tierId) {
        AssessmentMappingTier tier = tierRepository.findById(tierId)
            .orElseThrow(() -> new IllegalArgumentException("Tier not found: " + tierId));
        long count = paymentTransactionRepository.countByMappingTierIdAndStatus(tierId, "paid");
        tier.setCurrentCount((int) count);
        tierRepository.save(tier);
        return tier.getCurrentCount();
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd spring-social && mvn -q test -Dtest=AssessmentMappingTierServiceTest`
Expected: PASS — all 6 tests green. (`recountTier`/`resolveActiveTierForMapping` use repos but are not exercised by these pure-logic tests, so no Spring context is loaded.)

- [ ] **Step 5: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/service/career9/AssessmentMappingTierService.java \
        spring-social/src/test/java/com/kccitm/api/service/career9/AssessmentMappingTierServiceTest.java
git commit -m "feat: AssessmentMappingTierService with tested active-tier resolution"
```

---

## Task 4: `PaymentTransaction.mappingTierId` + repo count method

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/model/career9/PaymentTransaction.java`
- Modify: `spring-social/src/main/java/com/kccitm/api/repository/Career9/PaymentTransactionRepository.java`

- [ ] **Step 1: Add the column field to `PaymentTransaction`**

Insert after the `campaignAssessmentTierId` field (around line 91):

```java
    @Column(name = "mapping_tier_id")
    private Long mappingTierId;
```

- [ ] **Step 2: Add accessors to `PaymentTransaction`**

Insert after the `setCampaignAssessmentTierId` accessor (around line 195):

```java
    public Long getMappingTierId() { return mappingTierId; }
    public void setMappingTierId(Long mappingTierId) { this.mappingTierId = mappingTierId; }
```

- [ ] **Step 3: Add the count query to `PaymentTransactionRepository`**

Add this method inside the `PaymentTransactionRepository` interface:

```java
    long countByMappingTierIdAndStatus(Long mappingTierId, String status);
```

- [ ] **Step 4: Verify compilation**

Run: `cd spring-social && mvn -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/model/career9/PaymentTransaction.java \
        spring-social/src/main/java/com/kccitm/api/repository/Career9/PaymentTransactionRepository.java
git commit -m "feat: add mappingTierId to PaymentTransaction + count-by-tier query"
```

---

## Task 5: Tier CRUD endpoints in `AssessmentInstituteMappingController`

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentInstituteMappingController.java`

- [ ] **Step 1: Add imports and autowired dependencies**

Add to the imports block:

```java
import com.kccitm.api.model.career9.AssessmentMappingTier;
import com.kccitm.api.repository.Career9.AssessmentMappingTierRepository;
import com.kccitm.api.service.career9.AssessmentMappingTierService;
import org.springframework.web.bind.annotation.PatchMapping;
```

Add inside the class, after the `promoCodeRepository` field (around line 103):

```java
    @Autowired
    private AssessmentMappingTierRepository tierRepository;

    @Autowired
    private AssessmentMappingTierService tierService;
```

- [ ] **Step 2: Add the tier CRUD endpoints**

Insert at the end of the `// ============ ADMIN ENDPOINTS ============` section, immediately before the `// ============ PUBLIC ENDPOINTS ============` comment (around line 173):

```java
    // ----- Pricing tiers (unprotected, matching sibling mapping admin endpoints) -----

    @GetMapping("/{mappingId}/tiers")
    public ResponseEntity<?> listTiers(@PathVariable Long mappingId) {
        if (!mappingRepository.existsById(mappingId)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(tierRepository.findByMappingIdOrderBySortOrderAsc(mappingId));
    }

    @PostMapping("/{mappingId}/tiers")
    public ResponseEntity<?> createTier(@PathVariable Long mappingId,
            @RequestBody AssessmentMappingTier tier) {
        if (!mappingRepository.existsById(mappingId)) {
            return ResponseEntity.notFound().build();
        }
        if (tier.getName() == null || tier.getName().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Tier name is required");
        }
        if (tier.getSortOrder() == null) {
            return ResponseEntity.badRequest().body("Sort order is required");
        }
        tier.setMappingId(mappingId);
        tier.setCurrentCount(0);
        return ResponseEntity.ok(tierRepository.save(tier));
    }

    @PutMapping("/tiers/{tierId}")
    public ResponseEntity<?> updateTier(@PathVariable Long tierId,
            @RequestBody AssessmentMappingTier updated) {
        Optional<AssessmentMappingTier> existingOpt = tierRepository.findById(tierId);
        if (!existingOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        AssessmentMappingTier existing = existingOpt.get();
        if (updated.getName() != null) existing.setName(updated.getName());
        if (updated.getAmount() != null) existing.setAmount(updated.getAmount());
        if (updated.getSortOrder() != null) existing.setSortOrder(updated.getSortOrder());
        // maxRegistrations is nullable-meaningful: always copy it through
        existing.setMaxRegistrations(updated.getMaxRegistrations());
        if (updated.getIsActive() != null) existing.setIsActive(updated.getIsActive());
        return ResponseEntity.ok(tierRepository.save(existing));
    }

    @PatchMapping("/tiers/{tierId}/toggle")
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
    public ResponseEntity<?> deleteTier(@PathVariable Long tierId) {
        if (!tierRepository.existsById(tierId)) {
            return ResponseEntity.notFound().build();
        }
        tierRepository.deleteById(tierId);
        return ResponseEntity.ok("Tier deleted successfully");
    }

    @PostMapping("/tiers/{tierId}/recount")
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
```

- [ ] **Step 3: Verify compilation**

Run: `cd spring-social && mvn -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentInstituteMappingController.java
git commit -m "feat: tier CRUD + recount endpoints on assessment-mapping controller"
```

---

## Task 6: Tier-aware `public/info/{token}`

Resolve the active tier server-side and surface it. `amount` stays for backward compatibility (now = active tier amount); add `activeTierName` and `registrationClosed`.

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentInstituteMappingController.java:185-188`

- [ ] **Step 1: Replace the `amount` line in `getMappingInfoByToken`**

Find (around line 186-188):

```java
        Map<String, Object> info = new HashMap<>();
        info.put("mappingLevel", mapping.getMappingLevel());
        info.put("assessmentId", mapping.getAssessmentId());
        info.put("amount", mapping.getAmount() != null ? mapping.getAmount() : 0);
```

Replace with:

```java
        Map<String, Object> info = new HashMap<>();
        info.put("mappingLevel", mapping.getMappingLevel());
        info.put("assessmentId", mapping.getAssessmentId());

        // Tier-aware pricing: resolve the live tier; fall back to mapping.amount
        // when no tiers are configured (backward compatible).
        List<AssessmentMappingTier> tiers =
                tierRepository.findByMappingIdOrderBySortOrderAsc(mapping.getMappingId());
        if (tiers.isEmpty()) {
            info.put("amount", mapping.getAmount() != null ? mapping.getAmount() : 0);
            info.put("registrationClosed", false);
        } else {
            AssessmentMappingTier active = tierService.resolveActiveTier(tiers);
            if (active == null) {
                info.put("amount", 0);
                info.put("registrationClosed", true);
            } else {
                info.put("amount", active.getAmount() != null ? active.getAmount() : 0);
                info.put("activeTierName", active.getName());
                info.put("registrationClosed", false);
            }
        }
```

- [ ] **Step 2: Verify compilation**

Run: `cd spring-social && mvn -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Manual verification**

Start the app (`mvn spring-boot:run`), then for a mapping token with two tiers (Pilot ₹0 cap 1, Main ₹499 unlimited):
```bash
curl -s http://localhost:8091/assessment-mapping/public/info/<token> | python3 -m json.tool
```
Expected: `"amount": 0`, `"activeTierName": "Pilot"`, `"registrationClosed": false`.

- [ ] **Step 4: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentInstituteMappingController.java
git commit -m "feat: public/info resolves active pricing tier"
```

---

## Task 7: Tier-aware `public/register/{token}` (resolve + stamp + free increment)

Resolve the active tier server-side, use its amount as the price, stamp `mappingTierId` on every transaction, and on free completion both increment the tally and record a zero-amount paid transaction (so `recount` has a single source).

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentInstituteMappingController.java`

- [ ] **Step 1: Replace the amount/payment-decision block**

Find (around lines 301-303):

```java
        // 4. Check if payment is required
        Long mappingAmount = mapping.getAmount(); // amount in rupees
        boolean paymentRequired = mappingAmount != null && mappingAmount > 0;
```

Replace with:

```java
        // 4. Resolve the active pricing tier (falls back to mapping.amount when
        //    no tiers configured). amount in rupees.
        List<AssessmentMappingTier> tiers =
                tierRepository.findByMappingIdOrderBySortOrderAsc(mapping.getMappingId());
        Long mappingAmount;
        Long activeTierId = null;
        if (tiers.isEmpty()) {
            mappingAmount = mapping.getAmount();
        } else {
            AssessmentMappingTier active = tierService.resolveActiveTier(tiers);
            if (active == null) {
                return ResponseEntity.badRequest().body("Registrations are closed for this link");
            }
            mappingAmount = active.getAmount();
            activeTierId = active.getTierId();
        }
        boolean paymentRequired = mappingAmount != null && mappingAmount > 0;
```

- [ ] **Step 2: Pass `activeTierId` into the paid path**

Find (around lines 367-372):

```java
        // 8. If payment required and finalAmount > 0, create payment transaction and redirect
        if (paymentRequired && finalAmount > 0) {
            return createPaymentAndRedirect(mapping.getMappingId(), assessmentId, instituteCode,
                    finalAmount, originalAmount, promoCodeStr, promoDiscountPercent,
                    name, email, dob, dobStr, phone, gender);
        }
```

Replace with:

```java
        // 8. If payment required and finalAmount > 0, create payment transaction and redirect
        if (paymentRequired && finalAmount > 0) {
            return createPaymentAndRedirect(mapping.getMappingId(), assessmentId, instituteCode,
                    finalAmount, originalAmount, promoCodeStr, promoDiscountPercent,
                    name, email, dob, dobStr, phone, gender, activeTierId);
        }
```

- [ ] **Step 3: Update the `createPaymentAndRedirect` signature and stamp the tier**

Find the method declaration (around line 449):

```java
    private ResponseEntity<?> createPaymentAndRedirect(Long mappingId, Long assessmentId, Integer instituteCode,
            Long finalAmountInr, Long originalAmountInr, String promoCodeStr, Integer promoDiscountPercent,
            String name, String email, Date dob, String dobStr, String phone, String gender) {
```

Replace with:

```java
    private ResponseEntity<?> createPaymentAndRedirect(Long mappingId, Long assessmentId, Integer instituteCode,
            Long finalAmountInr, Long originalAmountInr, String promoCodeStr, Integer promoDiscountPercent,
            String name, String email, Date dob, String dobStr, String phone, String gender, Long mappingTierId) {
```

Then find the transaction setup inside that method (around line 484), after `txn.setStatus("created");`:

```java
            txn.setStatus("created");
```

Insert immediately after it:

```java
            txn.setMappingTierId(mappingTierId);
```

- [ ] **Step 4: Update the existing-student paid path to pass the tier**

Find `handleExistingStudentWithPayment` — its call to `createPaymentAndRedirect` (around lines 533-535):

```java
        return createPaymentAndRedirect(mappingId, assessmentId, instituteCode,
                finalAmountInr, originalAmountInr, promoCodeStr, promoDiscountPercent,
                name, email, dob, dobStr, phone, null);
```

Replace with (thread the tier id through the method):

```java
        return createPaymentAndRedirect(mappingId, assessmentId, instituteCode,
                finalAmountInr, originalAmountInr, promoCodeStr, promoDiscountPercent,
                name, email, dob, dobStr, phone, null, mappingTierId);
```

And update `handleExistingStudentWithPayment`'s signature (around line 510) to accept it:

```java
    private ResponseEntity<?> handleExistingStudentWithPayment(StudentInfo existingStudentInfo, Long assessmentId,
            Integer instituteCode, Long mappingId, Long finalAmountInr, Long originalAmountInr,
            String promoCodeStr, Integer promoDiscountPercent,
            String name, String email, Date dob, String phone) {
```

becomes:

```java
    private ResponseEntity<?> handleExistingStudentWithPayment(StudentInfo existingStudentInfo, Long assessmentId,
            Integer instituteCode, Long mappingId, Long finalAmountInr, Long originalAmountInr,
            String promoCodeStr, Integer promoDiscountPercent,
            String name, String email, Date dob, String phone, Long mappingTierId) {
```

Then update the two call sites of `handleExistingStudentWithPayment` (around lines 346 and 359) to pass `activeTierId` as the final argument:

```java
                return handleExistingStudentWithPayment(existing, assessmentId, instituteCode,
                        mapping.getMappingId(), finalAmount, originalAmount, promoCodeStr, promoDiscountPercent,
                        name, email, dob, phone, activeTierId);
```

and

```java
                    return handleExistingStudentWithPayment(byDob.get(0), assessmentId, instituteCode,
                            mapping.getMappingId(), finalAmount, originalAmount, promoCodeStr, promoDiscountPercent,
                            name, email, dob, phone, activeTierId);
```

- [ ] **Step 5: Free completion — increment tally and record a zero-amount paid transaction**

Find the free-registration block (around lines 374-391):

```java
        // 9. Free registration (no amount, or 100% promo discount) — create student directly
        // If 100% promo was used, record a zero-amount transaction
        if (paymentRequired && finalAmount != null && finalAmount == 0 && promoCodeStr != null) {
            PaymentTransaction txn = new PaymentTransaction();
            txn.setMappingId(mapping.getMappingId());
            txn.setAmount(0L);
            txn.setOriginalAmount(originalAmount);
            txn.setPromoCode(promoCodeStr.trim().toUpperCase());
            txn.setPromoDiscountPercent(promoDiscountPercent);
            txn.setStatus("paid");
            txn.setAssessmentId(assessmentId);
            txn.setInstituteCode(instituteCode);
            txn.setStudentName(name);
            txn.setStudentEmail(email);
            txn.setStudentDob(dob);
            txn.setStudentPhone(phone);
            paymentTransactionRepository.save(txn);
        }
```

Replace with (always record a zero-amount paid txn stamped with the tier, and increment the tally):

```java
        // 9. Free registration (no amount, or 100% promo discount) — create student directly.
        // Record a zero-amount paid transaction stamped with the tier so recount has a
        // single source, and increment the tier tally (no-op when no tier).
        if (activeTierId != null) {
            tierRepository.tryIncrementCount(activeTierId);
        }
        if (!tiers.isEmpty() || (paymentRequired && finalAmount != null && finalAmount == 0 && promoCodeStr != null)) {
            PaymentTransaction txn = new PaymentTransaction();
            txn.setMappingId(mapping.getMappingId());
            txn.setMappingTierId(activeTierId);
            txn.setAmount(0L);
            txn.setOriginalAmount(originalAmount);
            if (promoCodeStr != null && !promoCodeStr.trim().isEmpty()) {
                txn.setPromoCode(promoCodeStr.trim().toUpperCase());
                txn.setPromoDiscountPercent(promoDiscountPercent);
            }
            txn.setStatus("paid");
            txn.setAssessmentId(assessmentId);
            txn.setInstituteCode(instituteCode);
            txn.setStudentName(name);
            txn.setStudentEmail(email);
            txn.setStudentDob(dob);
            txn.setStudentPhone(phone);
            paymentTransactionRepository.save(txn);
        }
```

- [ ] **Step 6: Verify compilation**

Run: `cd spring-social && mvn -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 7: Manual verification (free tier auto-switch)**

With a mapping that has Pilot ₹0 (cap 1) + Main ₹499 (unlimited):
```bash
# First free registration consumes the Pilot slot
curl -s -X POST http://localhost:8091/assessment-mapping/public/register/<token> \
  -H 'Content-Type: application/json' \
  -d '{"name":"A","email":"a@x.com","dob":"01-01-2008","phone":"9999999999","gender":"M"}'
# Now info should show the Main tier price
curl -s http://localhost:8091/assessment-mapping/public/info/<token> | python3 -m json.tool
```
Expected: after the first registration, info shows `"amount": 499`, `"activeTierName": "Main"`.

- [ ] **Step 8: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/controller/career9/AssessmentInstituteMappingController.java
git commit -m "feat: register resolves active tier, stamps tier id, increments free tally"
```

---

## Task 8: Increment tier tally on paid completion (webhook)

**Files:**
- Modify: `spring-social/src/main/java/com/kccitm/api/controller/career9/PaymentWebhookController.java`

- [ ] **Step 1: Add the repository dependency**

Add to the imports:

```java
import com.kccitm.api.repository.Career9.AssessmentMappingTierRepository;
```

Add an autowired field after `schoolRegistrationLinkRepository` (around line 70):

```java
    @Autowired private AssessmentMappingTierRepository assessmentMappingTierRepository;
```

- [ ] **Step 2: Add a `tryIncrementMappingTier` helper**

Insert immediately after the `tryIncrementSchoolLink` method (around line 711), mirroring its shape:

```java
    private void tryIncrementMappingTier(PaymentTransaction txn) {
        if (txn == null || txn.getMappingTierId() == null) return;
        int rows = assessmentMappingTierRepository.tryIncrementCount(txn.getMappingTierId());
        logger.info("Mapping tier increment (webhook): tierId={}, rowsAffected={}",
                txn.getMappingTierId(), rows);
        if (rows == 0) {
            logger.warn("Cap already hit on AssessmentMappingTier {} when processing paid txn {}; allowing this paid registration through.",
                    txn.getMappingTierId(), txn.getTransactionId());
        }
    }
```

- [ ] **Step 3: Call it on paid provisioning**

In `createStudentAndAllotAssessment`, find the new-student block (around line 611) where the school link is incremented:

```java
            tryIncrementSchoolLink(txn);

            StudentAssessmentMapping sam = new StudentAssessmentMapping(
                    userStudent.getUserStudentId(), assessmentId);
```

Replace with:

```java
            tryIncrementSchoolLink(txn);
            tryIncrementMappingTier(txn);

            StudentAssessmentMapping sam = new StudentAssessmentMapping(
                    userStudent.getUserStudentId(), assessmentId);
```

Then in `handleExistingStudentPayment`, find (around line 654):

```java
            tryIncrementSchoolLink(txn);
            userStudents = List.of(newUs);
```

Replace with:

```java
            tryIncrementSchoolLink(txn);
            tryIncrementMappingTier(txn);
            userStudents = List.of(newUs);
```

> Note: the existing-student branch only increments inside the "no UserStudent yet" path, mirroring the existing `tryIncrementSchoolLink` placement, so a genuinely-new paying student is counted once and a re-registration of an already-provisioned student is not double-counted.

- [ ] **Step 4: Verify compilation**

Run: `cd spring-social && mvn -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add spring-social/src/main/java/com/kccitm/api/controller/career9/PaymentWebhookController.java
git commit -m "feat: increment mapping tier tally on paid completion via webhook"
```

---

## Task 9: Data migration — backfill default tiers

**Files:**
- Create: `spring-social/migrations/2026-05-22-backfill-mapping-tiers.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Backfill a single unlimited "Standard" tier for every existing mapping that has
-- a non-null amount. Unlimited cap => pricing is unchanged. Mappings with no amount
-- stay free (no tier; the controller falls back to mapping.amount / free).
-- Hibernate ddl-auto:update creates the assessment_mapping_tier table on boot;
-- run this AFTER the app has started once against the target DB.
INSERT INTO assessment_mapping_tier
    (mapping_id, name, amount, sort_order, max_registrations, current_count, is_active, created_at, updated_at)
SELECT m.mapping_id, 'Standard', m.amount, 1, NULL, 0, TRUE, NOW(), NOW()
FROM assessment_institute_mapping m
WHERE m.amount IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM assessment_mapping_tier t WHERE t.mapping_id = m.mapping_id
  );
```

- [ ] **Step 2: Commit**

```bash
git add spring-social/migrations/2026-05-22-backfill-mapping-tiers.sql
git commit -m "chore: migration to backfill default pricing tier for existing mappings"
```

> Execution note (not a code step): after deploying the backend (so the table exists) run this SQL against each environment's DB before relying on tier pricing. It is idempotent via the `NOT EXISTS` guard.

---

## Task 10: Frontend tier API functions + type

**Files:**
- Modify: `react-social/src/app/pages/AssessmentMapping/API/AssessmentMapping_APIs.ts`

- [ ] **Step 1: Add the `AssessmentMappingTier` type and tier API functions**

Append to the end of the file:

```typescript
// ============ PRICING TIERS ============

export interface AssessmentMappingTier {
  tierId?: number;
  mappingId?: number;
  name: string;
  amount: number | null;
  sortOrder: number;
  maxRegistrations: number | null;
  currentCount?: number;
  isActive?: boolean;
}

export function getTiers(mappingId: number) {
  return axios.get<AssessmentMappingTier[]>(
    `${API_URL}/assessment-mapping/${mappingId}/tiers`
  );
}

export function createTier(mappingId: number, tier: AssessmentMappingTier) {
  return axios.post<AssessmentMappingTier>(
    `${API_URL}/assessment-mapping/${mappingId}/tiers`,
    tier
  );
}

export function updateTier(tierId: number, tier: Partial<AssessmentMappingTier>) {
  return axios.put<AssessmentMappingTier>(
    `${API_URL}/assessment-mapping/tiers/${tierId}`,
    tier
  );
}

export function toggleTier(tierId: number) {
  return axios.patch<AssessmentMappingTier>(
    `${API_URL}/assessment-mapping/tiers/${tierId}/toggle`
  );
}

export function deleteTier(tierId: number) {
  return axios.delete(`${API_URL}/assessment-mapping/tiers/${tierId}`);
}

export function recountTier(tierId: number) {
  return axios.post(`${API_URL}/assessment-mapping/tiers/${tierId}/recount`);
}
```

- [ ] **Step 2: Commit**

```bash
git add react-social/src/app/pages/AssessmentMapping/API/AssessmentMapping_APIs.ts
git commit -m "feat: frontend API functions for assessment mapping pricing tiers"
```

---

## Task 11: `TierManagementModal` component (list + toggle + add/edit form)

**Files:**
- Create: `react-social/src/app/pages/College/components/TierManagementModal.tsx`

- [ ] **Step 1: Create the component**

A list modal with an embedded add/edit form modal. Styling mirrors the QR modal in `AssessmentMappingPanel.tsx`.

```typescript
import { useEffect, useState, useCallback } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import {
  AssessmentMappingTier,
  getTiers,
  createTier,
  updateTier,
  toggleTier,
  deleteTier,
} from "../../AssessmentMapping/API/AssessmentMapping_APIs";
import { showErrorToast } from "../../../utils/toast";

interface Props {
  mappingId: number;
  show: boolean;
  onHide: () => void;
}

const emptyForm: AssessmentMappingTier = {
  name: "",
  amount: 0,
  sortOrder: 1,
  maxRegistrations: null,
  isActive: true,
};

const TierManagementModal = ({ mappingId, show, onHide }: Props) => {
  const [tiers, setTiers] = useState<AssessmentMappingTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AssessmentMappingTier>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!mappingId) return;
    setLoading(true);
    try {
      const res = await getTiers(mappingId);
      setTiers(res.data || []);
    } catch (e) {
      console.error("Failed to load tiers", e);
    } finally {
      setLoading(false);
    }
  }, [mappingId]);

  useEffect(() => {
    if (show) load();
  }, [show, load]);

  const openAdd = () => {
    const nextSort = tiers.length
      ? Math.max(...tiers.map((t) => t.sortOrder || 0)) + 1
      : 1;
    setForm({ ...emptyForm, sortOrder: nextSort });
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (t: AssessmentMappingTier) => {
    setForm({ ...t });
    setEditingId(t.tierId ?? null);
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      showErrorToast("Tier name is required");
      return;
    }
    setSaving(true);
    try {
      const payload: AssessmentMappingTier = {
        name: form.name.trim(),
        amount: form.amount === null || form.amount === undefined ? 0 : Math.round(Number(form.amount)),
        sortOrder: Number(form.sortOrder),
        maxRegistrations:
          form.maxRegistrations === null ||
          form.maxRegistrations === undefined ||
          String(form.maxRegistrations) === ""
            ? null
            : Math.round(Number(form.maxRegistrations)),
        isActive: form.isActive,
      };
      if (editingId) {
        await updateTier(editingId, payload);
      } else {
        await createTier(mappingId, payload);
      }
      setFormOpen(false);
      await load();
    } catch (e: any) {
      showErrorToast("Failed to save tier: " + (e.response?.data || e.message));
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (t: AssessmentMappingTier) => {
    if (!t.tierId) return;
    try {
      await toggleTier(t.tierId);
      await load();
    } catch (e) {
      console.error("Failed to toggle tier", e);
    }
  };

  const onDelete = async (t: AssessmentMappingTier) => {
    if (!t.tierId) return;
    if (!window.confirm(`Delete tier "${t.name}"?`)) return;
    try {
      await deleteTier(t.tierId);
      await load();
    } catch (e) {
      console.error("Failed to delete tier", e);
    }
  };

  // The live tier = lowest-sortOrder active tier still under cap (mirrors backend).
  const liveTierId = (() => {
    const candidate = [...tiers]
      .filter((t) => t.isActive)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .find((t) => {
        const max = t.maxRegistrations;
        const cur = t.currentCount || 0;
        return max === null || max === 0 || cur < max;
      });
    return candidate?.tierId ?? null;
  })();

  return (
    <>
      <Modal show={show} onHide={onHide} centered size="lg">
        <Modal.Header closeButton style={{ borderBottom: "1px solid #f1f5f9", padding: "20px 28px" }}>
          <Modal.Title style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b" }}>
            Pricing Tiers
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "24px 28px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
              <Spinner animation="border" size="sm" /> Loading tiers...
            </div>
          ) : tiers.length === 0 ? (
            <div style={{
              padding: "32px 24px", textAlign: "center",
              border: "2px dashed #e2e8f0", borderRadius: 12, color: "#94a3b8",
            }}>
              No tiers yet. Add one to set pricing.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Order", "Name", "Amount", "Registrations", "Status", ""].map((h) => (
                    <th key={h} style={{
                      padding: "10px 12px", fontWeight: 700, fontSize: "0.75rem",
                      color: "#64748b", textAlign: "left", borderBottom: "2px solid #e2e8f0",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.tierId}>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>{t.sortOrder}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontWeight: 600 }}>
                      {t.name}
                      {t.tierId === liveTierId && (
                        <span style={{
                          marginLeft: 8, background: "#dcfce7", color: "#059669",
                          padding: "2px 8px", borderRadius: 12, fontSize: "0.65rem", fontWeight: 700,
                        }}>LIVE</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {t.amount && t.amount > 0 ? `INR ${t.amount}` : "Free"}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      {t.currentCount || 0} / {t.maxRegistrations && t.maxRegistrations > 0 ? t.maxRegistrations : "∞"}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      <Form.Check
                        type="switch"
                        checked={!!t.isActive}
                        onChange={() => onToggle(t)}
                      />
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                      <Button size="sm" variant="link" onClick={() => openEdit(t)}>Edit</Button>
                      <Button size="sm" variant="link" style={{ color: "#ef4444" }} onClick={() => onDelete(t)}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal.Body>
        <Modal.Footer style={{ justifyContent: "space-between", padding: "16px 28px", borderTop: "1px solid #f1f5f9" }}>
          <Button onClick={openAdd} style={{
            background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)",
            border: "none", borderRadius: 10, padding: "8px 20px", fontWeight: 600,
          }}>+ Add Tier</Button>
          <Button variant="light" onClick={onHide} style={{ borderRadius: 10, padding: "8px 20px", fontWeight: 600 }}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Add / Edit tier form */}
      <Modal show={formOpen} onHide={() => setFormOpen(false)} centered>
        <Modal.Header closeButton style={{ borderBottom: "1px solid #f1f5f9" }}>
          <Modal.Title style={{ fontSize: "1rem", fontWeight: 700 }}>
            {editingId ? "Edit Tier" : "Add Tier"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem" }}>Name</Form.Label>
            <Form.Control
              value={form.name}
              placeholder="e.g. Pilot"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem" }}>Amount (INR) — 0 = Free</Form.Label>
            <Form.Control
              type="number" min="0"
              value={form.amount ?? 0}
              onChange={(e) => setForm({ ...form, amount: e.target.value === "" ? 0 : Number(e.target.value) })}
            />
          </div>
          <div>
            <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem" }}>Sort Order</Form.Label>
            <Form.Control
              type="number" min="1"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
            />
          </div>
          <div>
            <Form.Label style={{ fontWeight: 600, fontSize: "0.8rem" }}>
              Max Registrations <span style={{ color: "#94a3b8", fontWeight: 400 }}>— blank = unlimited</span>
            </Form.Label>
            <Form.Control
              type="number" min="0"
              value={form.maxRegistrations ?? ""}
              onChange={(e) => setForm({ ...form, maxRegistrations: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
          <Form.Check
            type="switch"
            label="Active"
            checked={!!form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
        </Modal.Body>
        <Modal.Footer style={{ borderTop: "1px solid #f1f5f9" }}>
          <Button variant="light" onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button
            disabled={saving}
            onClick={save}
            style={{ background: "linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)", border: "none", fontWeight: 600 }}
          >
            {saving ? <><Spinner animation="border" size="sm" /> Saving...</> : "Save Tier"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default TierManagementModal;
```

- [ ] **Step 2: Commit**

```bash
git add react-social/src/app/pages/College/components/TierManagementModal.tsx
git commit -m "feat: TierManagementModal for assessment mapping pricing tiers"
```

---

## Task 12: Wire tiers into `AssessmentMappingPanel`

Replace the single amount input with a tier summary; create the mapping then open the tier modal; let users manage tiers per existing mapping; show the live tier in the table.

**Files:**
- Modify: `react-social/src/app/pages/College/components/AssessmentMappingPanel.tsx`

- [ ] **Step 1: Import the modal and add tier-modal state**

Add to the import block near the top (after the existing imports, around line 13):

```typescript
import TierManagementModal from "./TierManagementModal";
```

Add state alongside the other `useState` hooks (after line 37):

```typescript
  const [tierModalMappingId, setTierModalMappingId] = useState<number | null>(null);
```

- [ ] **Step 2: Remove the amount field from the create form**

Delete the entire "Amount (INR)" form group (lines 252-264, the `<div>` containing the `Form.Label` "Amount (INR)" and its `Form.Control`). Change the grid above it (line 216) from three columns to two:

Find:
```typescript
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 20 }}>
```
Replace with:
```typescript
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
```

- [ ] **Step 3: Stop sending `amount` and open the tier modal after create**

In `handleCreate`, delete this block (lines 105-107):

```typescript
    if (amount && Number(amount) > 0) {
      data.amount = Math.round(Number(amount));
    }
```

Then change the create call (lines 111-118) from:

```typescript
      await createAssessmentMapping(data);
      const res = await getAssessmentMappingsByInstitute(instituteCode);
      setMappings(res.data || []);
      setSelectedAssessment("");
      setSelectedSession("");
      setSelectedClass("");
      setSelectedSection("");
      setAmount("");
```

to (capture the new mappingId and open the tier modal so the admin sets pricing immediately):

```typescript
      const createRes = await createAssessmentMapping(data);
      const res = await getAssessmentMappingsByInstitute(instituteCode);
      setMappings(res.data || []);
      setSelectedAssessment("");
      setSelectedSession("");
      setSelectedClass("");
      setSelectedSection("");
      const newMappingId = createRes?.data?.mappingId;
      if (newMappingId) setTierModalMappingId(newMappingId);
```

- [ ] **Step 4: Remove the now-unused `amount` state**

Delete the declaration (line 34):

```typescript
  const [amount, setAmount] = useState<string>("");
```

- [ ] **Step 5: Replace the Amount column with a Tiers action**

In the table header array (line 389), replace `"Amount"` with `"Pricing"`:

```typescript
                      {["Assessment", "Level", "Details", "Pricing", "Status", "Free Link (Assessment)", "Paid Link (Dashboard)", "Actions"].map((h) => (
```

Replace the amount cell (lines 428-439) — the `<td>` rendering the INR/Free badge — with a "Manage Tiers" button:

```typescript
                        <td style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                          <button
                            onClick={() => setTierModalMappingId(mapping.mappingId)}
                            style={{
                              padding: "5px 14px", borderRadius: 8,
                              border: "1.5px solid #e2e8f0", background: "#f8fafc",
                              color: "#4361ee", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
                            }}
                          >
                            Manage Tiers
                          </button>
                        </td>
```

- [ ] **Step 6: Render the tier modal**

Immediately before the closing `</div>` that wraps the component's return (right after the QR `</Modal>`, around line 645), add:

```typescript
      {tierModalMappingId !== null && (
        <TierManagementModal
          mappingId={tierModalMappingId}
          show={tierModalMappingId !== null}
          onHide={() => setTierModalMappingId(null)}
        />
      )}
```

- [ ] **Step 7: Manual verification (per CLAUDE.md, do not run tsc/build)**

Visual review of the diff:
- The create form has Assessment + Mapping Level on the first row (two columns), no amount input.
- `amount` state and all its references are gone (search the file for `amount` — only `mapping.amount` may remain if referenced elsewhere; the `getLevelLabel`/links do not use it, so there should be none left in this file).
- The table shows a "Manage Tiers" button per row; clicking opens `TierManagementModal`.
- After creating a mapping, the tier modal opens for the new mapping id.

- [ ] **Step 8: Commit**

```bash
git add react-social/src/app/pages/College/components/AssessmentMappingPanel.tsx
git commit -m "feat: replace amount field with pricing-tier management in mapping panel"
```

---

## Self-review notes (addressed)

- **Spec coverage:** data model (Task 1), per-mapping ownership (Task 1 FK + unique constraint), active-tier resolution counter (Tasks 2-3), slot-on-completion free + paid (Tasks 7-8), tier attribution single source via `mappingTierId` on `PaymentTransaction` (Tasks 4, 7), recount backstop (Tasks 3, 5), tier CRUD + toggle (Task 5), backward-compatible public info with `amount`/`activeTierName`/`registrationClosed` (Task 6), migration (Task 9), frontend modals + panel wiring (Tasks 10-12), auth left unprotected to match siblings (Task 5 — no `@PreAuthorize` added).
- **Deviation from spec (improvement):** the spec mentioned an optional `tiers[]` on `POST /create`. This plan instead uses **create-then-add** (frontend creates the mapping, captures `mappingId`, then opens the tier modal) to avoid changing the shared `/create` request body and the existing flat payload. Same end result; lower risk. Non-atomic, but a mapping with no tiers safely falls back to free and the admin can add tiers via "Manage Tiers".
- **Type consistency:** `mappingTierId` used consistently across `PaymentTransaction`, controller, webhook; `tryIncrementCount(tierId)` signature matches between repo and callers; `resolveActiveTier(List)` signature matches test and controller usage.
- **Decrement-on-delete safeguard:** the spec lists decrement on delete/refund "where detectable". This plan ships the **recount** backstop (the reliable mechanism) but does not wire per-event decrements, since the current registration-delete/refund flows are out of this feature's code paths. Recount fully reconciles drift on demand; per-event decrement can be added if a delete/refund UI is built later.
```
