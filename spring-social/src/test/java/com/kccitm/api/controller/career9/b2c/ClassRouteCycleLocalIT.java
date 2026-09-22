package com.kccitm.api.controller.career9.b2c;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.b2c.Campaign;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentMapping;
import com.kccitm.api.model.career9.b2c.CampaignAssessmentTier;
import com.kccitm.api.model.career9.b2c.CampaignClassAssessment;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignAssessmentTierRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignClassAssessmentRepository;
import com.kccitm.api.repository.Career9.b2c.CampaignRepository;
import com.kccitm.api.security.AuthorizationService;

/**
 * Drives the real admin endpoints against the local dev database: map a class,
 * remove it, map it again — repeatedly — and check after every step that the
 * public registration page agrees.
 *
 * <p>The unit test beside this one only re-states the reactivation rule; this
 * one actually calls {@code upsertClassRoute} / {@code deleteClassRoute} and
 * reads the class list back out of {@code CampaignPublicController}, which is
 * the thing that was broken. Runs inside a transaction that rolls back, so the
 * dev database is left untouched.
 *
 * <pre>mvnw test -Dtest=ClassRouteCycleLocalIT -Dclassroute.it=true</pre>
 */
@SpringBootTest
@ActiveProfiles("dev")
@Transactional
@EnabledIfSystemProperty(named = "classroute.it", matches = "true")
class ClassRouteCycleLocalIT {

    private static final long ASSESSMENT_ID = 2L;   // "ASSESSMENT TEST", active
    private static final int CLASS_ID = 5;          // "Class 3"
    private static final long PRICING_TIER_ID = 1L; // "Tier 1 - Reports Only"

    /**
     * The admin endpoints are @PreAuthorize-guarded; calling them as beans has no
     * authenticated principal, so the permission check is stubbed open. The rule
     * under test is the class-route lifecycle, not who may run it.
     */
    @MockBean private AuthorizationService auth;

    @Autowired private CampaignController adminController;
    @Autowired private CampaignPublicController publicController;
    @Autowired private CampaignRepository campaignRepository;
    @Autowired private CampaignAssessmentMappingRepository mappingRepository;
    @Autowired private CampaignAssessmentTierRepository tierRepository;
    @Autowired private CampaignClassAssessmentRepository classRouteRepository;

    private Campaign campaign;

    /**
     * @PreAuthorize needs both an authenticated principal in the context and a
     * permission check that says yes; without the first it rejects before the
     * method is ever entered.
     */
    @BeforeEach
    void allowAdmin() {
        org.mockito.Mockito.when(auth.allows(org.mockito.ArgumentMatchers.anyString())).thenReturn(true);
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        "it-admin", "n/a",
                        java.util.Collections.singletonList(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN"))));
    }

    @AfterEach
    void clearAuth() {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
    }

    private void seed() {
        campaign = new Campaign();
        campaign.setName("IT class-route cycle");
        campaign.setSlug("it-class-route-cycle-" + System.nanoTime());
        campaign.setIsActive(true);
        campaign.setIsDeleted(false);
        campaign.setDefaultPurchasePath("A"); // pay-first, so the tier below is what makes it usable
        campaign = campaignRepository.save(campaign);

        CampaignAssessmentMapping mapping = new CampaignAssessmentMapping();
        mapping.setCampaignId(campaign.getCampaignId());
        mapping.setAssessmentId(ASSESSMENT_ID);
        mapping.setIsActive(true);
        mapping.setIsDeleted(false);
        mapping = mappingRepository.save(mapping);

        CampaignAssessmentTier tier = new CampaignAssessmentTier();
        tier.setCampaignAssessmentMappingId(mapping.getId());
        tier.setPricingTierId(PRICING_TIER_ID);
        tier.setIsActive(true);
        tier.setIsDefault(true);
        tierRepository.save(tier);
    }

    /** Class ids the public registration page currently offers. */
    @SuppressWarnings("unchecked")
    private List<Integer> classesOnRegistrationPage() {
        ResponseEntity<?> res = publicController.infoBySlug(campaign.getSlug());
        assertEquals(200, res.getStatusCodeValue(), "public info failed: " + res.getBody());
        Map<String, Object> body = (Map<String, Object>) res.getBody();
        List<Map<String, Object>> classes =
                (List<Map<String, Object>>) body.getOrDefault("classes", new ArrayList<>());
        List<Integer> ids = new ArrayList<>();
        for (Map<String, Object> c : classes) ids.add(((Number) c.get("classId")).intValue());
        return ids;
    }

    private void mapClass() {
        Map<String, Object> req = new HashMap<>();
        req.put("classId", CLASS_ID);
        req.put("assessmentId", ASSESSMENT_ID);
        ResponseEntity<?> res = adminController.upsertClassRoute(campaign.getCampaignId(), req);
        assertEquals(200, res.getStatusCodeValue(), "mapping the class failed: " + res.getBody());
    }

    private void removeClass() {
        CampaignClassAssessment route = classRouteRepository
                .findByCampaignIdAndClassId(campaign.getCampaignId(), CLASS_ID).orElse(null);
        assertNotNull(route, "no route to remove");
        ResponseEntity<?> res = adminController.deleteClassRoute(route.getId());
        assertEquals(200, res.getStatusCodeValue(), "removing the class failed: " + res.getBody());
    }

    @Test
    void aClassCanBeRemovedAndMappedAgainRepeatedly() {
        seed();

        // Nothing mapped yet.
        assertTrue(classesOnRegistrationPage().isEmpty(), "expected no classes before mapping");

        // Five full cycles — the bug showed from the second mapping onwards.
        for (int cycle = 1; cycle <= 5; cycle++) {
            mapClass();
            assertTrue(classesOnRegistrationPage().contains(CLASS_ID),
                    "cycle " + cycle + ": class missing from the registration page after mapping");

            removeClass();
            assertTrue(!classesOnRegistrationPage().contains(CLASS_ID),
                    "cycle " + cycle + ": class still on the registration page after removal");
        }

        // Ends mapped, and still visible.
        mapClass();
        assertTrue(classesOnRegistrationPage().contains(CLASS_ID), "final mapping not visible");

        // One row reused throughout rather than a pile of duplicates.
        List<CampaignClassAssessment> all = new ArrayList<>();
        for (CampaignClassAssessment r : classRouteRepository
                .findByCampaignIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(campaign.getCampaignId())) {
            if (r.getClassId() != null && r.getClassId() == CLASS_ID) all.add(r);
        }
        assertEquals(1, all.size(), "re-mapping should reuse the row, not duplicate it");
        assertEquals(Boolean.TRUE, all.get(0).getIsActive());
        assertEquals(Boolean.FALSE, all.get(0).getIsDeleted());
    }

    /** Sections still ride along on the class after a remove/add cycle. */
    @Test
    @SuppressWarnings("unchecked")
    void sectionsSurviveTheCycle() {
        seed();
        mapClass();
        removeClass();
        mapClass();

        ResponseEntity<?> res = publicController.infoBySlug(campaign.getSlug());
        Map<String, Object> body = (Map<String, Object>) res.getBody();
        List<Map<String, Object>> classes = (List<Map<String, Object>>) body.get("classes");
        Map<String, Object> cls = classes.stream()
                .filter(c -> ((Number) c.get("classId")).intValue() == CLASS_ID)
                .findFirst().orElse(null);
        assertNotNull(cls, "class missing after cycle");
        // The key must always be present; the list is empty when the class has
        // no sections, which is a valid configuration.
        assertTrue(cls.containsKey("sections"), "sections key missing from the class payload");
        System.out.println("sections for class " + CLASS_ID + ": " + cls.get("sections"));
    }
}
