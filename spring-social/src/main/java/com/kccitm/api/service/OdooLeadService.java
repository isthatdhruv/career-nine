package com.kccitm.api.service;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.Lead;
import com.kccitm.api.model.career9.OdooSyncStatus;
import com.kccitm.api.repository.Career9.LeadRepository;

@Service
public class OdooLeadService {

    private static final Logger logger = LoggerFactory.getLogger(OdooLeadService.class);

    @Value("${app.odoo.url}")
    private String odooUrl;

    @Value("${app.odoo.database}")
    private String odooDatabase;

    @Value("${app.odoo.username}")
    private String odooUsername;

    @Value("${app.odoo.password}")
    private String odooPassword;

    @Autowired
    private LeadRepository leadRepository;

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public OdooLeadService() {
        this.webClient = WebClient.builder().build();
        this.objectMapper = new ObjectMapper();
    }

    @Async
    public void syncLeadToOdoo(Lead lead) {
        try {
            // Step 1: Authenticate with Odoo
            String sessionId = authenticate();
            if (sessionId == null) {
                markFailed(lead, "Odoo authentication failed");
                return;
            }

            // Step 2: Create crm.lead record
            Long odooLeadId = createCrmLead(sessionId, lead);

            // Step 3: Update local record
            lead.setOdooSyncStatus(OdooSyncStatus.SYNCED);
            lead.setOdooLeadId(odooLeadId);
            lead.setOdooSyncError(null);
            leadRepository.save(lead);

            logger.info("Lead {} synced to Odoo as crm.lead ID {}", lead.getId(), odooLeadId);

        } catch (Exception e) {
            logger.error("Failed to sync lead {} to Odoo: {}", lead.getId(), e.getMessage());
            markFailed(lead, e.getMessage());
        }
    }

    private String authenticate() {
        try {
            Map<String, Object> params = new HashMap<>();
            params.put("db", odooDatabase);
            params.put("login", odooUsername);
            params.put("password", odooPassword);

            Map<String, Object> payload = buildJsonRpcPayload("call", params);

            String responseBody = webClient.post()
                    .uri(odooUrl + "/web/session/authenticate")
                    .header("Content-Type", "application/json")
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode root = objectMapper.readTree(responseBody);

            // Check for error
            if (root.has("error")) {
                String errorMsg = root.get("error").has("data")
                        ? root.get("error").get("data").get("message").asText()
                        : root.get("error").toString();
                logger.error("Odoo auth error: {}", errorMsg);
                return null;
            }

            JsonNode result = root.get("result");
            if (result != null && result.has("session_id")) {
                return result.get("session_id").asText();
            }

            // Some Odoo versions: check uid is valid (non-false)
            if (result != null && result.has("uid") && !result.get("uid").isNull()
                    && !result.get("uid").asText().equals("false")) {
                // session_id may be embedded differently; try to extract
                if (result.has("session_id")) {
                    return result.get("session_id").asText();
                }
            }

            logger.error("Odoo auth: no session_id in response");
            return null;
        } catch (Exception e) {
            logger.error("Odoo auth exception: {}", e.getMessage());
            return null;
        }
    }

    private Long createCrmLead(String sessionId, Lead lead) throws Exception {
        // Build vals for crm.lead
        Map<String, Object> vals = new HashMap<>();
        vals.put("name", buildLeadName(lead));
        vals.put("contact_name", lead.getFullName());
        vals.put("email_from", lead.getEmail());
        vals.put("phone", lead.getPhone());
        vals.put("type", "lead");
        vals.put("description", buildDescription(lead));

        // Map dedicated fields to Odoo fields
        if (lead.getCity() != null) {
            vals.put("city", lead.getCity());
        }
        if (lead.getSchoolName() != null) {
            vals.put("partner_name", lead.getSchoolName());
        }

        // Build JSON-RPC call_kw payload
        Map<String, Object> kwargs = new HashMap<>();
        kwargs.put("context", new HashMap<>());

        Map<String, Object> params = new HashMap<>();
        params.put("model", "crm.lead");
        params.put("method", "create");
        params.put("args", new Object[]{ vals });
        params.put("kwargs", kwargs);

        Map<String, Object> payload = buildJsonRpcPayload("call", params);

        String responseBody = webClient.post()
                .uri(odooUrl + "/web/dataset/call_kw")
                .header("Content-Type", "application/json")
                .cookie("session_id", sessionId)
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(String.class)
                .block();

        JsonNode root = objectMapper.readTree(responseBody);
        if (root.has("error")) {
            String errorMsg = root.get("error").has("data")
                    ? root.get("error").get("data").get("message").asText()
                    : root.get("error").toString();
            throw new RuntimeException("Odoo create failed: " + errorMsg);
        }

        JsonNode result = root.get("result");
        return result.asLong();
    }

    private Map<String, Object> buildJsonRpcPayload(String method, Map<String, Object> params) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("jsonrpc", "2.0");
        payload.put("method", method);
        payload.put("id", 1);
        payload.put("params", params);
        return payload;
    }

    private String buildLeadName(Lead lead) {
        return "[" + lead.getLeadType().name() + "] " + lead.getFullName()
                + (lead.getSource() != null ? " - " + lead.getSource() : "");
    }

    private String buildDescription(Lead lead) {
        StringBuilder sb = new StringBuilder();
        sb.append("Lead Type: ").append(lead.getLeadType().name()).append("\n");
        if (lead.getSource() != null) {
            sb.append("Source: ").append(lead.getSource()).append("\n");
        }
        if (lead.getExtras() != null) {
            sb.append("\nAdditional Data:\n").append(lead.getExtras());
        }
        return sb.toString();
    }

    private void markFailed(Lead lead, String error) {
        lead.setOdooSyncStatus(OdooSyncStatus.FAILED);
        lead.setOdooSyncError(error != null && error.length() > 2000 ? error.substring(0, 2000) : error);
        leadRepository.save(lead);
    }
}
