package com.kccitm.api.service.whatsapp;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import com.kccitm.api.model.email.EmailType;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * The WhatsApp side of the send catalog.
 *
 * <p>The rule these hold to is short: if an email goes out, a WhatsApp goes with it. No
 * scenario is email-only, so there is nothing here that asserts an exception — the tests exist
 * to make sure one cannot appear by accident, including for an {@code EmailType} added years
 * from now by someone who has never read this file.
 */
class WhatsAppCampaignsTest {

    private WhatsAppCampaigns campaigns(String... propertyPairs) {
        MockEnvironment env = new MockEnvironment();
        for (int i = 0; i + 1 < propertyPairs.length; i += 2) {
            env.setProperty(propertyPairs[i], propertyPairs[i + 1]);
        }
        return new WhatsAppCampaigns(env);
    }

    /**
     * The central guarantee: every scenario in the catalog has a template to send on. A new
     * {@code EmailType} that nobody maps still resolves, via the generic fallback — it can never
     * come back null, which is what "email only" would look like.
     */
    @Test
    void everyScenarioSendsWhatsAppToo() {
        WhatsAppCampaigns c = campaigns();
        for (EmailType type : EmailType.values()) {
            String campaign = c.forType(type);
            assertNotNull(campaign, type + " has no WhatsApp campaign — every email sends both channels");
            assertFalse(campaign.trim().isEmpty(), type + " resolved to a blank campaign");
        }
    }

    /** Including the internal ops alerts, which are the ones most worth reaching a phone. */
    @Test
    void internalAlertsSendWhatsAppAsWell() {
        WhatsAppCampaigns c = campaigns();
        assertNotNull(c.forType(EmailType.LEAD_NOTIFICATION));
        assertNotNull(c.forType(EmailType.COUNSELLOR_DEACTIVATED_ALERT));
        assertNotNull(c.forType(EmailType.ACCOUNT_TEST));
    }

    /** An unmapped scenario still reaches the recipient, on the generic template. */
    @Test
    void unmappedScenarioFallsBackToTheGenericTemplate() {
        assertEquals(WhatsAppCampaigns.GENERIC_CAMPAIGN, campaigns().forType(EmailType.GENERIC));
    }

    /** A template can be renamed in AiSensy and pointed at from config, without a deploy. */
    @Test
    void propertyOverridesTheBuiltInDefault() {
        WhatsAppCampaigns c = campaigns(
                "app.whatsapp.campaigns.PAYMENT_SUCCESS", "career9_payment_success_v2");
        assertEquals("career9_payment_success_v2", c.forType(EmailType.PAYMENT_SUCCESS));
    }

    /** The property wins over the environment variable, which wins over the built-in default. */
    @Test
    void overridePrecedenceIsMostSpecificFirst() {
        WhatsAppCampaigns envOnly = campaigns(
                "AISENSY_CAMPAIGN_REPORT_READY", "from_env");
        assertEquals("from_env", envOnly.forType(EmailType.REPORT_READY));

        WhatsAppCampaigns both = campaigns(
                "AISENSY_CAMPAIGN_REPORT_READY", "from_env",
                "app.whatsapp.campaigns.REPORT_READY", "from_property");
        assertEquals("from_property", both.forType(EmailType.REPORT_READY));
    }

    /** A blank override is not an override — it must not blank out a working campaign. */
    @Test
    void blankOverrideIsIgnored() {
        WhatsAppCampaigns c = campaigns("app.whatsapp.campaigns.REPORT_READY", "   ");
        assertEquals(campaigns().forType(EmailType.REPORT_READY), c.forType(EmailType.REPORT_READY));
    }

    /** A null type is the ad-hoc case; it still resolves rather than throwing. */
    @Test
    void nullTypeResolvesToTheGenericTemplate() {
        assertEquals(WhatsAppCampaigns.GENERIC_CAMPAIGN, campaigns().forType(null));
    }
}
