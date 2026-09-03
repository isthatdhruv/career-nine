package com.kccitm.api.service.mail;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.scheduling.support.CronExpression;

import com.kccitm.api.model.email.EmailPlaceholder;
import com.kccitm.api.model.email.EmailTemplate;
import com.kccitm.api.model.email.PortState;
import com.kccitm.api.model.mail.MailAutomation;
import com.kccitm.api.model.mail.MailEvent;
import com.kccitm.api.model.mail.MailPredicate;
import com.kccitm.api.model.mail.MailRecipientRole;

/**
 * Pure checks on an automation: hard errors that block a save, and warnings the editor shows
 * (a template using placeholders the trigger does not supply is the important one).
 */
public final class MailAutomationValidator {

    private static final Pattern TOKEN = Pattern.compile("\\{\\{([#^/]?)([A-Za-z0-9_]+)\\}\\}");

    /** Keys the engine or resolver supplies for every send, whatever the event. */
    static final Set<String> ALWAYS_SUPPLIED = new HashSet<>(Arrays.asList(
            "email_header", "email_footer", "school_name", "logo_url", "dashboard_link", "first_name",
            "recipient_name", "original_recipient", "has_parent_email", "event_key"));

    private MailAutomationValidator() {
    }

    public static List<MailEvent> triggerEvents(MailAutomation a) {
        List<MailEvent> out = new ArrayList<>();
        for (String key : a.triggerEventList()) {
            MailEvent e = MailEvent.fromKey(key);
            if (e == null) throw new IllegalArgumentException("unknown trigger event: " + key);
            if (e == MailEvent.SCHEDULED) throw new IllegalArgumentException("schedule.tick is not a trigger; use a cron schedule");
            out.add(e);
        }
        return out;
    }

    public static void validate(MailAutomation a, EmailTemplate template, boolean audienceKnown) {
        if (a.getName() == null || a.getName().trim().isEmpty()) {
            throw new IllegalArgumentException("name is required");
        }
        boolean scheduled = a.isScheduled();
        List<MailEvent> events = triggerEvents(a);
        if (scheduled && !events.isEmpty()) {
            throw new IllegalArgumentException("an automation is triggered by events or by a schedule, not both");
        }
        if (!scheduled && events.isEmpty()) {
            throw new IllegalArgumentException("pick at least one trigger event, or a schedule");
        }
        if (scheduled) {
            if (!CronExpression.isValidExpression(a.getCron())) {
                throw new IllegalArgumentException("cron expression is not valid (6 fields, seconds first): " + a.getCron());
            }
            if (a.getAudienceKey() == null || a.getAudienceKey().trim().isEmpty()) {
                throw new IllegalArgumentException("a scheduled automation needs an audience");
            }
            if (!audienceKnown) {
                throw new IllegalArgumentException("unknown audience: " + a.getAudienceKey());
            }
        }

        Set<String> allowedPredicates = new HashSet<>();
        Set<String> allowedRoles = new HashSet<>();
        Set<String> allowedDates = new HashSet<>();
        for (MailEvent e : events) {
            for (MailPredicate p : e.predicates()) allowedPredicates.add(p.key());
            for (MailRecipientRole r : e.roles()) allowedRoles.add(r.name());
            allowedDates.addAll(e.dateFields());
        }
        if (scheduled) {
            for (MailRecipientRole r : MailRecipientRole.values()) allowedRoles.add(r.name());
        }
        for (String c : a.conditionList()) {
            if (MailPredicate.fromKey(c) == null) throw new IllegalArgumentException("unknown condition: " + c);
            if (!scheduled && !allowedPredicates.contains(c)) {
                throw new IllegalArgumentException("condition '" + c + "' does not apply to the chosen trigger event(s)");
            }
        }
        for (String r : a.roleList()) {
            if (MailRecipientRole.from(r) == null) throw new IllegalArgumentException("unknown recipient role: " + r);
            if (!allowedRoles.contains(r.toUpperCase())) {
                throw new IllegalArgumentException("recipient role '" + r + "' is not offered by the chosen trigger event(s)");
            }
        }
        if (a.roleList().isEmpty() && a.extraRecipientList().isEmpty()) {
            throw new IllegalArgumentException("choose at least one recipient role or an extra address");
        }
        for (String extra : a.extraRecipientList()) {
            if (!extra.contains("@")) throw new IllegalArgumentException("not an email address: " + extra);
        }
        for (String c : a.cancelEventList()) {
            if (MailEvent.fromKey(c) == null) throw new IllegalArgumentException("unknown cancel event: " + c);
        }
        if (a.getDelayMinutes() != null && a.getDelayMinutes() < 0) {
            throw new IllegalArgumentException("delay cannot be negative");
        }
        if (a.getRepeatEveryMinutes() != null && a.getRepeatEveryMinutes() <= 0) {
            throw new IllegalArgumentException("repeat interval must be positive");
        }
        if (a.getMaxSends() != null && a.getMaxSends() <= 0) {
            throw new IllegalArgumentException("max sends must be positive");
        }
        if (a.getRepeatEveryMinutes() != null && a.getMaxSends() == null) {
            throw new IllegalArgumentException("a repeating automation needs a max sends limit");
        }
        String rel = a.getRelativeToField();
        if (rel != null && !rel.trim().isEmpty()) {
            if (!scheduled && !allowedDates.contains(rel.trim())) {
                throw new IllegalArgumentException("date field '" + rel + "' is not supplied by the chosen trigger event(s)");
            }
            if (a.offsetList().isEmpty()) {
                throw new IllegalArgumentException("relative timing needs at least one offset in minutes");
            }
            if (a.getRepeatEveryMinutes() != null) {
                throw new IllegalArgumentException("relative timing and repeat cannot be combined");
            }
        }
        if (a.getTemplateId() == null) {
            throw new IllegalArgumentException("pick a template");
        }
        if (template == null) {
            throw new IllegalArgumentException("template " + a.getTemplateId() + " does not exist");
        }
        if (a.getChannel() != null && !"EMAIL".equalsIgnoreCase(a.getChannel())) {
            throw new IllegalArgumentException("only the EMAIL channel is available in this release");
        }
    }

    public static List<String> warnings(MailAutomation a, EmailTemplate template) {
        List<String> out = new ArrayList<>();
        if (template == null) {
            out.add("No template selected; nothing will be sent.");
            return out;
        }
        if (!Boolean.TRUE.equals(template.getActive())) {
            out.add("The selected template is inactive; sends will be skipped.");
        }
        if (template.getPortState() == PortState.CONTENT_ONLY) {
            out.add("This template was ported from code; the automation fills its placeholders from the event. Check the preview.");
        }
        if (a.isScheduled()) {
            out.add("Scheduled automations render whatever the audience supplies; placeholder coverage is not checked.");
            return out;
        }
        Set<String> supplied = new HashSet<>(ALWAYS_SUPPLIED);
        for (MailEvent e : triggerEvents(a)) {
            supplied.addAll(e.fields());
        }
        supplied.addAll(template.variantFlagList());
        Set<String> missing = new LinkedHashSet<>();
        for (String part : new String[] {template.getSubjectTemplate(), template.getBodyTemplate(), template.getTextTemplate()}) {
            if (part == null) continue;
            Matcher m = TOKEN.matcher(part);
            while (m.find()) {
                if (!m.group(1).isEmpty()) continue; // section flags default to off; not a data gap
                String key = m.group(2);
                if (!supplied.contains(key) && EmailPlaceholder.values().length > 0) {
                    missing.add(key);
                }
            }
        }
        if (!missing.isEmpty()) {
            out.add("Template uses placeholders the trigger event(s) do not supply, they will render empty: "
                    + String.join(", ", missing));
        }
        if (a.roleList().contains(MailRecipientRole.INTERNAL_LIST.name()) && a.getEmailType() == null) {
            out.add("Internal list recipients are resolved by email type; the template has none.");
        }
        return out;
    }
}
