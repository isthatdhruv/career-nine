package com.kccitm.api.service;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.Lead;
import com.kccitm.api.model.email.EmailPlaceholder;
import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.service.email.EmailDispatchService;
import com.kccitm.api.service.email.EmailNotificationRecipientService;

/**
 * Tells people a lead has arrived.
 *
 * <p>Two messages, both optional and independently controlled:
 *
 * <ul>
 *   <li><b>Internal alert</b> ({@link EmailType#LEAD_NOTIFICATION}) to whoever is listed in
 *       {@code email_notification_recipient}. Nothing is sent when the list is empty, so the
 *       feature is inert until an admin adds an address — no surprise mail on deploy.</li>
 *   <li><b>Acknowledgement</b> ({@link EmailType#LEAD_WELCOME}) to the person who filled the
 *       form, unless {@code app.leads.send-acknowledgement} is false.</li>
 * </ul>
 *
 * <p>Runs {@code @Async} and swallows everything, like the Odoo sync and the student
 * provisioning beside it: the public capture endpoint returns 201 on the strength of the
 * saved row, and no mail problem may turn that into a failed submission for the visitor.
 *
 * <p>Both messages go through {@link EmailDispatchService}, so they pick up the configured
 * sending account, the admin-editable template, and a row in {@code email_send_log} — a
 * notification nobody received is then visible on the Email Log page rather than only in
 * the server log.
 */
@Service
public class LeadNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(LeadNotificationService.class);

    /**
     * Leads are read by an India-based team and the JVM runs UTC in its container, so an
     * un-zoned timestamp in an alert would read two-and-a-half hours early. Formatted here
     * rather than left to the template, which has no way to zone anything.
     */
    private static final TimeZone LEAD_TZ = TimeZone.getTimeZone("Asia/Kolkata");
    private static final String RECEIVED_AT_PATTERN = "d MMM yyyy, h:mm a";

    /** Keys already surfaced as their own placeholder; not repeated in the details table. */
    private static final List<String> EXTRAS_HIDDEN = List.of("recaptchaToken");

    @Value("${app.leads.send-acknowledgement:true}")
    private boolean sendAcknowledgement;

    /** Used to build a deep link into the CRM record; blank when Odoo is not configured. */
    @Value("${app.odoo.url:}")
    private String odooUrl;

    @Autowired
    private EmailDispatchService emailDispatchService;

    @Autowired
    private EmailNotificationRecipientService recipientService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Async
    public void notifyNewLead(Lead lead) {
        if (lead == null) {
            return;
        }
        try {
            sendInternalAlert(lead);
        } catch (Exception e) {
            logger.error("Lead {}: internal new-lead alert failed: {}", lead.getId(), e.getMessage(), e);
        }
        try {
            sendAcknowledgement(lead);
        } catch (Exception e) {
            logger.error("Lead {}: acknowledgement email failed: {}", lead.getId(), e.getMessage(), e);
        }
    }

    // ─── internal alert ──────────────────────────────────────────────────

    private void sendInternalAlert(Lead lead) {
        String leadType = lead.getLeadType() != null ? lead.getLeadType().name() : null;
        EmailNotificationRecipientService.Resolved who =
                recipientService.resolve(EmailType.LEAD_NOTIFICATION, leadType, lead.getSource());

        if (who.isEmpty()) {
            // Not an error, and deliberately not logged as a skipped send: an unconfigured
            // list would otherwise write a row to email_send_log for every lead forever.
            logger.debug("Lead {}: no notification recipients configured — no alert sent", lead.getId());
            return;
        }

        EmailSendRequest req = new EmailSendRequest();
        req.setEmailType(EmailType.LEAD_NOTIFICATION);
        req.setTo(who.to);
        req.setCc(who.cc);
        req.setBcc(who.bcc);
        req.setTemplateContext(context(lead));

        // Fallback content, used only until a LEAD_NOTIFICATION template exists. The seeder
        // creates one on boot, so in practice this is the safety net for a deployment where
        // the template was deleted rather than the normal path.
        req.setSubject(fallbackAlertSubject(lead));
        req.setHtmlContent(fallbackAlertBody(lead));

        emailDispatchService.send(req);
        logger.info("Lead {}: new-lead alert queued to {} recipient(s)", lead.getId(), who.size());
    }

    // ─── acknowledgement to the person who enquired ──────────────────────

    private void sendAcknowledgement(Lead lead) {
        if (!sendAcknowledgement) {
            return;
        }
        String to = lead.getEmail() == null ? null : lead.getEmail().trim();
        if (to == null || to.isEmpty()) {
            return;
        }

        EmailSendRequest req = new EmailSendRequest();
        req.setEmailType(EmailType.LEAD_WELCOME);
        req.getTo().add(to);
        req.setTemplateContext(context(lead));
        req.setSubject("Thanks for getting in touch with Career-9");
        req.setHtmlContent(fallbackAcknowledgementBody(lead));

        emailDispatchService.send(req);
        logger.info("Lead {}: acknowledgement queued to {}", lead.getId(), to);
    }

    // ─── placeholder context ─────────────────────────────────────────────

    /**
     * The values every lead template can reference.
     *
     * <p>{@code student_name} / {@code first_name} are populated from the lead's own name as
     * well, because the acknowledgement shares the branded templates that use them and a
     * greeting reading "Hi ," is worse than a slightly loose variable name.
     */
    private Map<String, String> context(Lead lead) {
        Map<String, String> ctx = new LinkedHashMap<>();
        put(ctx, EmailPlaceholder.LEAD_ID, lead.getId() == null ? "" : String.valueOf(lead.getId()));
        put(ctx, EmailPlaceholder.LEAD_NAME, lead.getFullName());
        put(ctx, EmailPlaceholder.LEAD_EMAIL, lead.getEmail());
        put(ctx, EmailPlaceholder.LEAD_PHONE, lead.getPhone());
        put(ctx, EmailPlaceholder.LEAD_TYPE, lead.getLeadType() != null ? lead.getLeadType().name() : "");
        put(ctx, EmailPlaceholder.LEAD_SOURCE, lead.getSource());
        put(ctx, EmailPlaceholder.LEAD_SCHOOL, lead.getSchoolName());
        put(ctx, EmailPlaceholder.LEAD_CITY, lead.getCity());
        put(ctx, EmailPlaceholder.LEAD_DESIGNATION, lead.getDesignation());
        put(ctx, EmailPlaceholder.LEAD_RECEIVED_AT, receivedAt(lead));
        put(ctx, EmailPlaceholder.LEAD_CRM_LINK, crmLink(lead));
        put(ctx, EmailPlaceholder.LEAD_DETAILS, detailsTable(lead));

        // Shared greeting placeholders, so the branded templates work unchanged.
        put(ctx, EmailPlaceholder.STUDENT_NAME, lead.getFullName());
        return ctx;
    }

    private static void put(Map<String, String> ctx, EmailPlaceholder key, String value) {
        ctx.put(key.key(), value == null ? "" : value);
    }

    private String receivedAt(Lead lead) {
        Date when = lead.getCreatedAt() != null ? lead.getCreatedAt() : new Date();
        SimpleDateFormat fmt = new SimpleDateFormat(RECEIVED_AT_PATTERN);
        fmt.setTimeZone(LEAD_TZ);
        return fmt.format(when) + " IST";
    }

    /**
     * A deep link to the record in Odoo.
     *
     * <p>Empty far more often than not: the CRM sync runs on its own thread and this alert
     * is sent as soon as the lead is saved, so at send time the id usually is not back yet.
     * That is the right trade — an alert that waits for a third-party round trip is an alert
     * that never arrives when the third party is down. The template treats a blank value as
     * "look it up by name".
     */
    private String crmLink(Lead lead) {
        if (lead.getOdooLeadId() == null || odooUrl == null || odooUrl.trim().isEmpty()) {
            return "";
        }
        String base = odooUrl.trim().replaceAll("/+$", "");
        return base + "/web#id=" + lead.getOdooLeadId() + "&model=crm.lead&view_type=form";
    }

    /**
     * Every submitted field as a two-column table, including whatever the form put in
     * {@code extras}.
     *
     * <p>This is the reason the alert is worth reading: the columns on {@code leads} are the
     * fields we thought of, and the interesting part of an enquiry is usually in the free
     * text beside them. Every cell is HTML-escaped here — the block is marked raw HTML in
     * {@code PlaceholderResolver}, so escaping is this method's responsibility.
     */
    private String detailsTable(Lead lead) {
        Map<String, String> fields = new LinkedHashMap<>();
        addField(fields, "Name", lead.getFullName());
        addField(fields, "Email", lead.getEmail());
        addField(fields, "Phone", lead.getPhone());
        addField(fields, "Enquiry type", lead.getLeadType() != null ? lead.getLeadType().name() : null);
        addField(fields, "Source", lead.getSource());
        addField(fields, "Designation", lead.getDesignation());
        addField(fields, "School", lead.getSchoolName());
        addField(fields, "City", lead.getCity());
        addField(fields, "CBSE affiliation no.", lead.getCbseAffiliationNo());
        addField(fields, "Total students", lead.getTotalStudents());
        addField(fields, "Classes offered", lead.getClassesOffered());
        addField(fields, "Date of birth", lead.getDob() == null
                ? null : new SimpleDateFormat("dd-MM-yyyy").format(lead.getDob()));
        addExtras(fields, lead.getExtras());

        StringBuilder sb = new StringBuilder();
        sb.append("<table style=\"border-collapse:collapse;width:100%;max-width:560px;"
                + "font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px\">");
        for (Map.Entry<String, String> e : fields.entrySet()) {
            sb.append("<tr>")
              .append("<td style=\"padding:7px 12px 7px 0;border-bottom:1px solid #e5e7eb;"
                      + "color:#4b5563;white-space:nowrap;vertical-align:top\">")
              .append(escape(e.getKey()))
              .append("</td>")
              .append("<td style=\"padding:7px 0;border-bottom:1px solid #e5e7eb;"
                      + "color:#111827;font-weight:600\">")
              .append(escape(e.getValue()))
              .append("</td></tr>");
        }
        sb.append("</table>");
        return sb.toString();
    }

    private static void addField(Map<String, String> fields, String label, String value) {
        if (value != null && !value.trim().isEmpty()) {
            fields.put(label, value.trim());
        }
    }

    /**
     * Flatten the extras JSON into the same table.
     *
     * <p>The capture endpoint sweeps every unrecognised form field into this blob, so it is
     * where a new question added to the website lands until somebody gives it a column. An
     * unparseable blob is shown verbatim rather than dropped — the point of the alert is
     * that a human sees what was submitted.
     */
    private void addExtras(Map<String, String> fields, String extrasJson) {
        if (extrasJson == null || extrasJson.trim().isEmpty()) {
            return;
        }
        try {
            JsonNode root = objectMapper.readTree(extrasJson);
            if (!root.isObject()) {
                fields.put("Additional details", extrasJson);
                return;
            }
            Iterator<String> names = root.fieldNames();
            while (names.hasNext()) {
                String name = names.next();
                if (EXTRAS_HIDDEN.contains(name)) {
                    continue;
                }
                JsonNode value = root.get(name);
                if (value == null || value.isNull()) {
                    continue;
                }
                String text = value.isValueNode() ? value.asText() : value.toString();
                addField(fields, humanise(name), text);
            }
        } catch (Exception e) {
            logger.debug("Could not parse lead extras as JSON, showing raw: {}", e.getMessage());
            fields.put("Additional details", extrasJson);
        }
    }

    /** "schoolBoard" / "school_board" → "School board", for a table a person reads. */
    private static String humanise(String key) {
        String spaced = key.replaceAll("([a-z])([A-Z])", "$1 $2").replace('_', ' ').trim();
        if (spaced.isEmpty()) {
            return key;
        }
        return Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1).toLowerCase();
    }

    // ─── fallback content (used until a template is configured) ──────────

    private String fallbackAlertSubject(Lead lead) {
        String type = lead.getLeadType() != null ? lead.getLeadType().name() : "NEW";
        return "New " + type.toLowerCase() + " lead: " + safe(lead.getFullName());
    }

    private String fallbackAlertBody(Lead lead) {
        return "<div style=\"font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111827\">"
                + "<p style=\"font-size:16px;font-weight:700;margin:0 0 4px\">New enquiry from the website</p>"
                + "<p style=\"margin:0 0 18px;color:#4b5563;font-size:14px\">Received " + escape(receivedAt(lead))
                + "</p>"
                + detailsTable(lead)
                + "</div>";
    }

    private String fallbackAcknowledgementBody(Lead lead) {
        String name = safe(lead.getFullName());
        String first = name.contains(" ") ? name.substring(0, name.indexOf(' ')) : name;
        return "<div style=\"font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111827\">"
                + "<p>Hi " + escape(first) + ",</p>"
                + "<p>Thanks for getting in touch with Career-9. We have your enquiry and someone "
                + "from our team will be in contact shortly.</p>"
                + "<p style=\"color:#4b5563;font-size:14px\">Here is what you sent us:</p>"
                + detailsTable(lead)
                + "<p style=\"margin-top:18px\">Warm regards,<br>Team Career-9</p>"
                + "</div>";
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }

    private static String escape(String input) {
        if (input == null) {
            return "";
        }
        return input.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;");
    }
}
