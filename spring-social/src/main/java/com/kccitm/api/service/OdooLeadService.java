package com.kccitm.api.service;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.Lead;
import com.kccitm.api.model.career9.OdooSyncStatus;
import com.kccitm.api.repository.Career9.LeadRepository;

/**
 * Syncs leads to Odoo CRM using the /jsonrpc External RPC API.
 * Uses API key in place of password for authentication.
 * See: https://www.odoo.com/documentation/19.0/developer/reference/external_rpc_api.html
 */
@Service
public class OdooLeadService {

    private static final Logger logger = LoggerFactory.getLogger(OdooLeadService.class);

    @Value("${app.odoo.url}")
    private String odooUrl;

    @Value("${app.odoo.database}")
    private String odooDatabase;

    @Value("${app.odoo.username}")
    private String odooUsername;

    @Value("${app.odoo.api-key}")
    private String odooApiKey;

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
            // Step 1: Authenticate to get uid
            Integer uid = authenticate();
            if (uid == null) {
                markFailed(lead, "Odoo authentication failed");
                return;
            }

            // Step 2: Create crm.lead record
            Long odooLeadId = createCrmLead(uid, lead);

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

    /**
     * Authenticate via /jsonrpc → service "common", method "authenticate".
     * Returns the user ID (uid) on success, null on failure.
     * API key is used in place of password.
     */
    private Integer authenticate() {
        try {
            Map<String, Object> payload = buildJsonRpcPayload(
                    "common", "authenticate",
                    new Object[]{ odooDatabase, odooUsername, odooApiKey, new HashMap<>() }
            );

            String responseBody = postJsonRpc(payload);
            JsonNode root = objectMapper.readTree(responseBody);

            if (root.has("error")) {
                String errorMsg = extractError(root);
                logger.error("Odoo auth error: {}", errorMsg);
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
     * Create a crm.lead record via /jsonrpc → service "object", method "execute_kw".
     */
    private Long createCrmLead(Integer uid, Lead lead) throws Exception {
        Map<String, Object> vals = new HashMap<>();
        vals.put("name", buildLeadName(lead));
        vals.put("contact_name", lead.getFullName());
        vals.put("email_from", lead.getEmail());
        vals.put("phone", lead.getPhone());
        vals.put("type", "lead");
        vals.put("description", buildDescription(lead));

        if (lead.getCity() != null) {
            vals.put("city", lead.getCity());
        }
        if (lead.getSchoolName() != null) {
            vals.put("partner_name", lead.getSchoolName());
        }

        Map<String, Object> payload = buildJsonRpcPayload(
                "object", "execute_kw",
                new Object[]{
                        odooDatabase, uid, odooApiKey,
                        "crm.lead", "create",
                        Arrays.asList(vals)
                }
        );

        String responseBody = postJsonRpc(payload);
        JsonNode root = objectMapper.readTree(responseBody);

        if (root.has("error")) {
            throw new RuntimeException("Odoo create failed: " + extractError(root));
        }

        JsonNode result = root.get("result");
        if (result == null || result.isNull()) {
            throw new RuntimeException("Odoo create: no result in response");
        }

        return result.asLong();
    }

    /**
     * POST to /jsonrpc endpoint.
     */
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

    /**
     * Build a JSON-RPC 2.0 payload for the /jsonrpc endpoint.
     *
     * Format:
     * {
     *   "jsonrpc": "2.0",
     *   "method": "call",
     *   "id": 1,
     *   "params": {
     *     "service": "common" | "object",
     *     "method": "authenticate" | "execute_kw",
     *     "args": [...]
     *   }
     * }
     */
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

    private String buildLeadName(Lead lead) {
        return "[" + lead.getLeadType().name() + "] " + lead.getFullName()
                + (lead.getSource() != null ? " - " + lead.getSource() : "");
    }

    private String buildDescription(Lead lead) {
        StringBuilder sb = new StringBuilder();
        sb.append("Lead Type: ").append(lead.getLeadType().name()).append("\n");
        if (lead.getDesignation() != null) {
            sb.append("Designation: ").append(lead.getDesignation()).append("\n");
        }
        if (lead.getCbseAffiliationNo() != null) {
            sb.append("CBSE Affiliation No: ").append(lead.getCbseAffiliationNo()).append("\n");
        }
        if (lead.getTotalStudents() != null) {
            sb.append("Total Students: ").append(lead.getTotalStudents()).append("\n");
        }
        if (lead.getClassesOffered() != null) {
            sb.append("Classes Offered: ").append(lead.getClassesOffered()).append("\n");
        }
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
