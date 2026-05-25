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
