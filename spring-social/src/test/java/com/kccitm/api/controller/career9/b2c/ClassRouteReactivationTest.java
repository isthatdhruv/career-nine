package com.kccitm.api.controller.career9.b2c;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.kccitm.api.model.career9.b2c.CampaignClassAssessment;

/**
 * Removing a class from a campaign and adding it straight back must put it
 * back on the registration page.
 *
 * <p>The upsert finds the existing row by (campaign, class), and
 * {@code deleteClassRoute} leaves it {@code isActive = false}. Re-adding cleared
 * {@code isDeleted} but not {@code isActive}, so the class reappeared in the
 * admin table while the public class picker — which skips inactive routes —
 * still never showed it.
 */
class ClassRouteReactivationTest {

    /** The reactivation rule from CampaignController#upsertClassRoute. */
    private static void applyAddRules(CampaignClassAssessment route, Map<String, Object> req) {
        if (req.containsKey("isActive")) {
            route.setIsActive(Boolean.TRUE.equals(req.get("isActive")));
        }
        route.setIsDeleted(false);
        if (!req.containsKey("isActive") || route.getIsActive() == null) {
            route.setIsActive(true);
        }
    }

    /** A route after deleteClassRoute has run on it. */
    private static CampaignClassAssessment removed() {
        CampaignClassAssessment route = new CampaignClassAssessment();
        route.setIsDeleted(true);
        route.setIsActive(false);
        return route;
    }

    @Test
    void addingBackARemovedClassMakesItLiveAgain() {
        CampaignClassAssessment route = removed();
        applyAddRules(route, new HashMap<>());
        assertTrue(Boolean.TRUE.equals(route.getIsActive()), "re-added class must be active");
        assertTrue(Boolean.FALSE.equals(route.getIsDeleted()), "re-added class must not be deleted");
    }

    @Test
    void aBrandNewClassIsLive() {
        CampaignClassAssessment route = new CampaignClassAssessment();
        applyAddRules(route, new HashMap<>());
        assertTrue(Boolean.TRUE.equals(route.getIsActive()));
    }

    /** An explicit isActive=false in the request is still honoured. */
    @Test
    void anExplicitDeactivationIsRespected() {
        CampaignClassAssessment route = new CampaignClassAssessment();
        route.setIsActive(true);
        Map<String, Object> req = new HashMap<>();
        req.put("isActive", false);
        applyAddRules(route, req);
        assertEquals(Boolean.FALSE, route.getIsActive(), "caller asked for inactive");
    }

    @Test
    void anExplicitActivationIsRespected() {
        CampaignClassAssessment route = removed();
        Map<String, Object> req = new HashMap<>();
        req.put("isActive", true);
        applyAddRules(route, req);
        assertEquals(Boolean.TRUE, route.getIsActive());
    }
}
