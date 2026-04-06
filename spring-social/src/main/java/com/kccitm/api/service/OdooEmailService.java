package com.kccitm.api.service;

import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;

/**
 * Sends emails via Odoo's mail.mail model using the /jsonrpc External RPC API.
 * Uses API key in place of password for authentication.
 *
 * Flow:
 *   1. Authenticate → get uid
 *   2. Create mail.mail record with recipients, subject, body
 *   3. (Optional) Attach files via ir.attachment
 *   4. Call mail.mail send() to dispatch
 */
@Service
public class OdooEmailService {

    private static final Logger logger = LoggerFactory.getLogger(OdooEmailService.class);

    @Value("${app.odoo.url}")
    private String odooUrl;

    @Value("${app.odoo.database}")
    private String odooDatabase;

    @Value("${app.odoo.username}")
    private String odooUsername;

    @Value("${app.odoo.api-key}")
    private String odooApiKey;

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public OdooEmailService() {
        this.webClient = WebClient.builder().build();
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Send a simple text email via Odoo.
     */
    @Async
    public void sendSimpleEmail(String to, String subject, String text) {
        try {
            Integer uid = authenticate();
            if (uid == null) {
                logger.error("Odoo email: authentication failed");
                return;
            }

            Long mailId = createMailRecord(uid, to, null, null, subject, wrapPlainText(text), null);
            sendMail(uid, mailId);
            logger.info("Odoo email sent to {} (mail.mail ID {})", to, mailId);

        } catch (Exception e) {
            logger.error("Odoo email failed to {}: {}", to, e.getMessage());
        }
    }

    /**
     * Send an HTML email via Odoo.
     */
    @Async
    public void sendHtmlEmail(String to, String subject, String htmlContent) {
        try {
            Integer uid = authenticate();
            if (uid == null) {
                logger.error("Odoo email: authentication failed");
                return;
            }

            Long mailId = createMailRecord(uid, to, null, null, subject, htmlContent, null);
            sendMail(uid, mailId);
            logger.info("Odoo HTML email sent to {} (mail.mail ID {})", to, mailId);

        } catch (Exception e) {
            logger.error("Odoo HTML email failed to {}: {}", to, e.getMessage());
        }
    }

    /**
     * Send a full email using SmtpEmailRequest (supports multiple recipients, CC, BCC, attachments).
     */
    @Async
    public void sendEmail(SmtpEmailRequest request) {
        try {
            Integer uid = authenticate();
            if (uid == null) {
                logger.error("Odoo email: authentication failed");
                return;
            }

            String toAddresses = String.join(",", request.getTo());
            String ccAddresses = request.getCc() != null ? String.join(",", request.getCc()) : null;
            String bccAddresses = request.getBcc() != null ? String.join(",", request.getBcc()) : null;

            String body = request.getHtmlContent() != null
                    ? request.getHtmlContent()
                    : wrapPlainText(request.getTextContent());

            String emailFrom = request.getFromEmail() != null
                    ? (request.getFromName() != null
                        ? "\"" + request.getFromName() + "\" <" + request.getFromEmail() + ">"
                        : request.getFromEmail())
                    : null;

            Long mailId = createMailRecord(uid, toAddresses, ccAddresses, bccAddresses,
                    request.getSubject(), body, emailFrom);

            // Attach files if present
            if (request.getAttachments() != null && !request.getAttachments().isEmpty()) {
                List<Long> attachmentIds = request.getAttachments().stream()
                        .map(att -> {
                            try {
                                return createAttachment(uid, att.getFilename(),
                                        att.getContent(), mailId);
                            } catch (Exception e) {
                                logger.error("Failed to create Odoo attachment '{}': {}",
                                        att.getFilename(), e.getMessage());
                                return null;
                            }
                        })
                        .filter(id -> id != null)
                        .collect(Collectors.toList());

                if (!attachmentIds.isEmpty()) {
                    linkAttachmentsToMail(uid, mailId, attachmentIds);
                }
            }

            sendMail(uid, mailId);
            logger.info("Odoo email sent to {} (mail.mail ID {})", toAddresses, mailId);

        } catch (Exception e) {
            logger.error("Odoo email send failed: {}", e.getMessage());
        }
    }

    /**
     * Send email with a single attachment via Odoo.
     */
    @Async
    public void sendEmailWithAttachment(String to, String subject, String text,
                                        String attachmentFilename, byte[] attachmentContent,
                                        String attachmentContentType) {
        SmtpEmailRequest request = new SmtpEmailRequest();
        request.setTo(Arrays.asList(to));
        request.setSubject(subject);
        request.setTextContent(text);
        request.setAttachments(Arrays.asList(
                new SmtpEmailRequest.EmailAttachment(attachmentFilename, attachmentContent, attachmentContentType)
        ));
        sendEmail(request);
    }

    // ─── Odoo JSON-RPC helpers ───────────────────────────────────────────

    private Integer authenticate() {
        try {
            Map<String, Object> payload = buildJsonRpcPayload(
                    "common", "authenticate",
                    new Object[]{ odooDatabase, odooUsername, odooApiKey, new HashMap<>() }
            );

            String responseBody = postJsonRpc(payload);
            JsonNode root = objectMapper.readTree(responseBody);

            if (root.has("error")) {
                logger.error("Odoo auth error: {}", extractError(root));
                return null;
            }

            JsonNode result = root.get("result");
            if (result == null || result.isNull() || result.asText().equals("false")) {
                logger.error("Odoo auth failed: invalid credentials or API key");
                return null;
            }

            return result.asInt();
        } catch (Exception e) {
            logger.error("Odoo auth exception: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Create a mail.mail record in Odoo.
     */
    private Long createMailRecord(Integer uid, String emailTo, String emailCc,
                                  String emailBcc, String subject, String bodyHtml,
                                  String emailFrom) throws Exception {
        Map<String, Object> vals = new HashMap<>();
        vals.put("email_to", emailTo);
        vals.put("subject", subject);
        vals.put("body_html", bodyHtml != null ? bodyHtml : "");
        vals.put("auto_delete", true);

        if (emailFrom != null) {
            vals.put("email_from", emailFrom);
        } else {
            vals.put("email_from", "\"Career-9\" <" + odooUsername + ">");
        }
        if (emailCc != null && !emailCc.isEmpty()) {
            vals.put("email_cc", emailCc);
        }
        if (emailBcc != null && !emailBcc.isEmpty()) {
            vals.put("email_bcc", emailBcc);
        }

        Map<String, Object> payload = buildJsonRpcPayload(
                "object", "execute_kw",
                new Object[]{
                        odooDatabase, uid, odooApiKey,
                        "mail.mail", "create",
                        Arrays.asList(vals)
                }
        );

        String responseBody = postJsonRpc(payload);
        JsonNode root = objectMapper.readTree(responseBody);

        if (root.has("error")) {
            throw new RuntimeException("Odoo mail.mail create failed: " + extractError(root));
        }

        JsonNode result = root.get("result");
        if (result == null || result.isNull()) {
            throw new RuntimeException("Odoo mail.mail create: no result in response");
        }

        return result.asLong();
    }

    /**
     * Call mail.mail send() to dispatch the email.
     */
    private void sendMail(Integer uid, Long mailId) throws Exception {
        Map<String, Object> payload = buildJsonRpcPayload(
                "object", "execute_kw",
                new Object[]{
                        odooDatabase, uid, odooApiKey,
                        "mail.mail", "send",
                        Arrays.asList(Arrays.asList(mailId))
                }
        );

        String responseBody = postJsonRpc(payload);
        JsonNode root = objectMapper.readTree(responseBody);

        if (root.has("error")) {
            throw new RuntimeException("Odoo mail.mail send failed: " + extractError(root));
        }
    }

    /**
     * Create an ir.attachment record linked to the mail.mail record.
     */
    private Long createAttachment(Integer uid, String filename, byte[] content,
                                  Long mailId) throws Exception {
        Map<String, Object> vals = new HashMap<>();
        vals.put("name", filename);
        vals.put("datas", Base64.getEncoder().encodeToString(content));
        vals.put("res_model", "mail.mail");
        vals.put("res_id", mailId);

        Map<String, Object> payload = buildJsonRpcPayload(
                "object", "execute_kw",
                new Object[]{
                        odooDatabase, uid, odooApiKey,
                        "ir.attachment", "create",
                        Arrays.asList(vals)
                }
        );

        String responseBody = postJsonRpc(payload);
        JsonNode root = objectMapper.readTree(responseBody);

        if (root.has("error")) {
            throw new RuntimeException("Odoo ir.attachment create failed: " + extractError(root));
        }

        return root.get("result").asLong();
    }

    /**
     * Link attachment IDs to a mail.mail record via the attachment_ids many2many field.
     * Uses command (4, id, 0) to add existing records.
     */
    private void linkAttachmentsToMail(Integer uid, Long mailId, List<Long> attachmentIds) throws Exception {
        // Odoo many2many write: [(4, attachment_id, 0)] adds a link
        List<Object[]> commands = attachmentIds.stream()
                .map(attId -> new Object[]{ 4, attId, 0 })
                .collect(Collectors.toList());

        Map<String, Object> vals = new HashMap<>();
        vals.put("attachment_ids", commands);

        Map<String, Object> payload = buildJsonRpcPayload(
                "object", "execute_kw",
                new Object[]{
                        odooDatabase, uid, odooApiKey,
                        "mail.mail", "write",
                        Arrays.asList(Arrays.asList(mailId), vals)
                }
        );

        String responseBody = postJsonRpc(payload);
        JsonNode root = objectMapper.readTree(responseBody);

        if (root.has("error")) {
            logger.error("Odoo link attachments failed: {}", extractError(root));
        }
    }

    // ─── Utility methods ─────────────────────────────────────────────────

    private String postJsonRpc(Map<String, Object> payload) {
        try {
            return webClient.post()
                    .uri(odooUrl + "/jsonrpc")
                    .header("Content-Type", "application/json")
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
        } catch (WebClientResponseException e) {
            throw new RuntimeException("Odoo HTTP error " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
        }
    }

    private Map<String, Object> buildJsonRpcPayload(String service, String method, Object[] args) {
        Map<String, Object> params = new HashMap<>();
        params.put("service", service);
        params.put("method", method);
        params.put("args", args);

        Map<String, Object> payload = new HashMap<>();
        payload.put("jsonrpc", "2.0");
        payload.put("method", "call");
        payload.put("id", 1);
        payload.put("params", params);
        return payload;
    }

    private String extractError(JsonNode root) {
        JsonNode error = root.get("error");
        if (error.has("data") && error.get("data").has("message")) {
            return error.get("data").get("message").asText();
        }
        return error.toString();
    }

    private String wrapPlainText(String text) {
        if (text == null) return "";
        return "<p>" + text.replace("\n", "<br/>") + "</p>";
    }
}
