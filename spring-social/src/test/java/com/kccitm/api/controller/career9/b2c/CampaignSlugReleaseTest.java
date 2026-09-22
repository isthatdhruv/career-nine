package com.kccitm.api.controller.career9.b2c;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.kccitm.api.model.career9.b2c.Campaign;

/**
 * Deleting a campaign must hand its slug back.
 *
 * <p>{@code campaigns.slug} is UNIQUE and the create check does not filter
 * deleted rows, so a deleted campaign used to reserve its name for ever — with
 * no way to free it, since a deleted campaign is hidden from the list and 404s
 * on get and update.
 */
class CampaignSlugReleaseTest {

    private static Campaign campaign(long id, String slug) {
        Campaign c = new Campaign();
        c.setCampaignId(id);
        c.setSlug(slug);
        return c;
    }

    @Test
    void theOriginalSlugBecomesAvailableAgain() {
        Campaign c = campaign(20L, "bgsips-dwarka");
        String released = CampaignController.releasedSlug(c);
        assertEquals("bgsips-dwarka-deleted-20", released);
        assertTrue(!released.equals("bgsips-dwarka"), "the name must be freed");
    }

    /** Deleting an already-deleted campaign must not stack suffixes. */
    @Test
    void releasingTwiceIsIdempotent() {
        Campaign c = campaign(20L, "bgsips-dwarka-deleted-20");
        assertEquals("bgsips-dwarka-deleted-20", CampaignController.releasedSlug(c));
    }

    /** The column holds 100 characters; the suffix must not push past it. */
    @Test
    void theResultFitsTheColumn() {
        StringBuilder long95 = new StringBuilder();
        for (int i = 0; i < 95; i++) long95.append('a');
        Campaign c = campaign(123456L, long95.toString());
        String released = CampaignController.releasedSlug(c);
        assertTrue(released.length() <= 100, "slug is " + released.length() + " chars");
        assertTrue(released.endsWith("-deleted-123456"), released);
    }

    @Test
    void aBlankSlugStillProducesSomethingUnique() {
        assertEquals("-deleted-7", CampaignController.releasedSlug(campaign(7L, null)));
    }
}
