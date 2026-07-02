package com.kccitm.api.service.email;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.email.EmailAccount;
import com.kccitm.api.model.email.EmailAccountCredentials;
import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;

/**
 * Per-account Odoo sender (JSON-RPC {@code mail.mail}) — generalizes {@code OdooEmailService}
 * to take url/database/username/api-key from the account config. Synchronous + throws on
 * failure (the dispatcher decides sync vs async).
 *
 * <p>Flow: authenticate → create {@code mail.mail} → (optional) {@code ir.attachment} → send.
 */
public class OdooSender implements ConfiguredEmailSender {

    private final String odooUrl;
    private final String odooDatabase;
    private final String odooUsername;
    private final String odooApiKey;
    private final String fromName;

    private final WebClient webClient = WebClient.builder().build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    OdooSender(EmailAccount account, EmailAccountCredentials creds) {
        this.odooUrl = creds.getOdooUrl();
        this.odooDatabase = creds.getOdooDatabase();
        this.odooUsername = creds.getOdooUsername();
        this.odooApiKey = creds.getOdooApiKey();
        this.fromName = account.getFromName();
    }

    @Override
    public void send(SmtpEmailRequest req) throws Exception {
        if (odooUrl == null || odooDatabase == null || odooUsername == null || odooApiKey == null) {
            throw new IllegalStateException("Odoo account is missing url/database/username/api-key");
        }
        Integer uid = authenticate();
        if (uid == null) {
            throw new IllegalStateException("Odoo authentication failed");
        }

        String to = String.join(",", req.getTo());
        String cc = req.getCc() != null && !req.getCc().isEmpty() ? String.join(",", req.getCc()) : null;
        String bcc = req.getBcc() != null && !req.getBcc().isEmpty() ? String.join(",", req.getBcc()) : null;
        String body = req.getHtmlContent() != null ? req.getHtmlContent() : wrapPlainText(req.getTextContent());

        String name = req.getFromName() != null ? req.getFromName() : fromName;
        String emailFrom = (name != null && !name.trim().isEmpty())
                ? "\"" + name.replaceAll("[\"\\p{Cntrl}]", "").trim() + "\" <" + odooUsername + ">"
                : "\"Career-9\" <" + odooUsername + ">";

        Long mailId = createMailRecord(uid, to, cc, bcc, req.getSubject(), body, emailFrom);

        if (req.getAttachments() != null && !req.getAttachments().isEmpty()) {
            List<Long> attachmentIds = new ArrayList<>();
            for (SmtpEmailRequest.EmailAttachment att : req.getAttachments()) {
                Long id = createAttachment(uid, att.getFilename(), att.getContent(), mailId);
                if (id != null) {
                    attachmentIds.add(id);
                }
            }
            if (!attachmentIds.isEmpty()) {
                linkAttachmentsToMail(uid, mailId, attachmentIds);
            }
        }
        sendMail(uid, mailId);
    }

    private Integer authenticate() throws Exception {
        Map<String, Object> payload = buildJsonRpcPayload("common", "authenticate",
                new Object[]{ odooDatabase, odooUsername, odooApiKey, new HashMap<>() });
        JsonNode root = objectMapper.readTree(postJsonRpc(payload));
        if (root.has("error")) {
            throw new IllegalStateException("Odoo auth error: " + extractError(root));
        }
        JsonNode result = root.get("result");
        if (result == null || result.isNull() || result.asText().equals("false")) {
            return null;
        }
        return result.asInt();
    }

    private Long createMailRecord(Integer uid, String emailTo, String emailCc, String emailBcc,
                                  String subject, String bodyHtml, String emailFrom) throws Exception {
        Map<String, Object> vals = new HashMap<>();
        vals.put("email_to", emailTo);
        vals.put("subject", subject);
        vals.put("body_html", bodyHtml != null ? bodyHtml : "");
        vals.put("auto_delete", true);
        vals.put("email_from", emailFrom != null ? emailFrom : "\"Career-9\" <" + odooUsername + ">");
        if (emailCc != null && !emailCc.isEmpty()) {
            vals.put("email_cc", emailCc);
        }
        if (emailBcc != null && !emailBcc.isEmpty()) {
            vals.put("email_bcc", emailBcc);
        }

        Map<String, Object> payload = buildJsonRpcPayload("object", "execute_kw",
                new Object[]{ odooDatabase, uid, odooApiKey, "mail.mail", "create", Arrays.asList(vals) });
        JsonNode root = objectMapper.readTree(postJsonRpc(payload));
        if (root.has("error")) {
            throw new IllegalStateException("Odoo mail.mail create failed: " + extractError(root));
        }
        JsonNode result = root.get("result");
        if (result == null || result.isNull()) {
            throw new IllegalStateException("Odoo mail.mail create: no result");
        }
        return result.asLong();
    }

    private void sendMail(Integer uid, Long mailId) throws Exception {
        Map<String, Object> payload = buildJsonRpcPayload("object", "execute_kw",
                new Object[]{ odooDatabase, uid, odooApiKey, "mail.mail", "send",
                        Arrays.asList(Arrays.asList(mailId)) });
        JsonNode root = objectMapper.readTree(postJsonRpc(payload));
        if (root.has("error")) {
            throw new IllegalStateException("Odoo mail.mail send failed: " + extractError(root));
        }
    }

    private Long createAttachment(Integer uid, String filename, byte[] content, Long mailId) throws Exception {
        Map<String, Object> vals = new HashMap<>();
        vals.put("name", filename);
        vals.put("datas", Base64.getEncoder().encodeToString(content));
        vals.put("res_model", "mail.mail");
        vals.put("res_id", mailId);

        Map<String, Object> payload = buildJsonRpcPayload("object", "execute_kw",
                new Object[]{ odooDatabase, uid, odooApiKey, "ir.attachment", "create", Arrays.asList(vals) });
        JsonNode root = objectMapper.readTree(postJsonRpc(payload));
        if (root.has("error")) {
            throw new IllegalStateException("Odoo ir.attachment create failed: " + extractError(root));
        }
        return root.get("result").asLong();
    }

    private void linkAttachmentsToMail(Integer uid, Long mailId, List<Long> attachmentIds) throws Exception {
        List<Object[]> commands = new ArrayList<>();
        for (Long attId : attachmentIds) {
            commands.add(new Object[]{ 4, attId, 0 });
        }
        Map<String, Object> vals = new HashMap<>();
        vals.put("attachment_ids", commands);

        Map<String, Object> payload = buildJsonRpcPayload("object", "execute_kw",
                new Object[]{ odooDatabase, uid, odooApiKey, "mail.mail", "write",
                        Arrays.asList(Arrays.asList(mailId), vals) });
        JsonNode root = objectMapper.readTree(postJsonRpc(payload));
        if (root.has("error")) {
            throw new IllegalStateException("Odoo link attachments failed: " + extractError(root));
        }
    }

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
            throw new IllegalStateException("Odoo HTTP error " + e.getStatusCode() + ": "
                    + e.getResponseBodyAsString());
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
        if (error != null && error.has("data") && error.get("data").has("message")) {
            return error.get("data").get("message").asText();
        }
        return error != null ? error.toString() : "unknown";
    }

    private String wrapPlainText(String text) {
        if (text == null) {
            return "";
        }
        return "<p>" + text.replace("\n", "<br/>") + "</p>";
    }
}
