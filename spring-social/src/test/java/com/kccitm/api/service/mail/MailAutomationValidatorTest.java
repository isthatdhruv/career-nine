package com.kccitm.api.service.mail;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.kccitm.api.model.email.EmailTemplate;
import com.kccitm.api.model.email.PortState;
import com.kccitm.api.model.mail.MailAutomation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MailAutomationValidatorTest {

    private static EmailTemplate template(String body) {
        EmailTemplate t = new EmailTemplate();
        t.setId(7L);
        t.setName("t");
        t.setEmailType("ENTITLEMENT_GRANTED");
        t.setSubjectTemplate("Hi {{first_name}}");
        t.setBodyTemplate(body);
        t.setActive(true);
        t.setPortState(PortState.CONTENT_ONLY);
        return t;
    }

    private static MailAutomation valid() {
        MailAutomation a = new MailAutomation();
        a.setName("Nudge");
        a.setTriggerEvents("entitlement.granted");
        a.setConditions("assessment_not_started");
        a.setDelayMinutes(1440);
        a.setRepeatEveryMinutes(1440);
        a.setMaxSends(2);
        a.setTemplateId(7L);
        a.setRecipientRoles("STUDENT");
        return a;
    }

    @Test
    void validPasses() {
        MailAutomationValidator.validate(valid(), template("<p>{{assessment_name}} {{action_link}}</p>"), false);
    }

    @Test
    @DisplayName("conditions, roles and date fields must belong to the trigger event")
    void eventBound() {
        MailAutomation a = valid();
        a.setConditions("payment_still_pending");
        assertThrows(IllegalArgumentException.class, () -> MailAutomationValidator.validate(a, template("x"), false));
        MailAutomation b = valid();
        b.setRecipientRoles("COUNSELLOR");
        assertThrows(IllegalArgumentException.class, () -> MailAutomationValidator.validate(b, template("x"), false));
        MailAutomation c = valid();
        c.setRepeatEveryMinutes(null);
        c.setRelativeToField("session_start");
        c.setRelativeOffsetsMinutes("-120");
        assertThrows(IllegalArgumentException.class, () -> MailAutomationValidator.validate(c, template("x"), false));
    }

    @Test
    @DisplayName("repeat needs a cap; schedules need a valid cron and a known audience")
    void timingRules() {
        MailAutomation a = valid();
        a.setMaxSends(null);
        assertThrows(IllegalArgumentException.class, () -> MailAutomationValidator.validate(a, template("x"), false));
        MailAutomation s = valid();
        s.setTriggerEvents(null);
        s.setConditions(null);
        s.setRepeatEveryMinutes(null);
        s.setMaxSends(null);
        s.setCron("0 0 20 * * *");
        s.setAudienceKey("counsellor_digest");
        assertThrows(IllegalArgumentException.class, () -> MailAutomationValidator.validate(s, template("x"), false));
        MailAutomationValidator.validate(s, template("x"), true);
        s.setCron("not a cron");
        assertThrows(IllegalArgumentException.class, () -> MailAutomationValidator.validate(s, template("x"), true));
    }

    @Test
    @DisplayName("warnings name placeholders the trigger does not supply")
    void warnings() {
        List<String> w = MailAutomationValidator.warnings(valid(), template("<p>{{assessment_name}} {{checkin_code}} {{#has_x}}{{/has_x}}</p>"));
        assertTrue(w.stream().anyMatch(x -> x.contains("checkin_code")));
        assertTrue(w.stream().noneMatch(x -> x.contains("assessment_name")));
        assertTrue(w.stream().anyMatch(x -> x.contains("ported from code")));
        assertEquals(1, MailAutomationValidator.warnings(valid(), null).size());
    }
}
