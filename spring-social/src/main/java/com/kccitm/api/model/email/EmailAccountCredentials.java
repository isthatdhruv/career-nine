package com.kccitm.api.model.email;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Provider-specific secrets for an {@link EmailAccount}, stored as a JSON blob in the
 * (encrypted) {@code credentials_encrypted} column. Only the fields relevant to the
 * account's provider/mode are populated; the rest stay null.
 *
 * <ul>
 *   <li>GMAIL + API   → {@link #serviceAccountJson} (+ optional {@link #delegatedUser};
 *       defaults to the account's from-email). If {@link #useClasspathDefault} is true,
 *       the bundled {@code firebase-service-account.json} is used (bootstrap default).</li>
 *   <li>GMAIL + SMTP  → {@link #smtpHost} / {@link #smtpPort} / {@link #smtpUsername} /
 *       {@link #smtpPassword} / {@link #smtpStarttls}.</li>
 *   <li>ODOO          → {@link #odooUrl} / {@link #odooDatabase} / {@link #odooUsername} /
 *       {@link #odooApiKey}.</li>
 * </ul>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class EmailAccountCredentials {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    // Gmail API
    private Boolean useClasspathDefault;
    private String serviceAccountJson;
    private String delegatedUser;

    // Gmail SMTP
    private String smtpHost;
    private Integer smtpPort;
    private String smtpUsername;
    private String smtpPassword;
    private Boolean smtpStarttls;

    // Odoo JSON-RPC
    private String odooUrl;
    private String odooDatabase;
    private String odooUsername;
    private String odooApiKey;

    public static EmailAccountCredentials parse(String json) {
        if (json == null || json.trim().isEmpty()) {
            return new EmailAccountCredentials();
        }
        try {
            return MAPPER.readValue(json, EmailAccountCredentials.class);
        } catch (Exception e) {
            throw new IllegalStateException("Malformed email-account credentials JSON", e);
        }
    }

    public String toJson() {
        try {
            return MAPPER.writeValueAsString(this);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize email-account credentials", e);
        }
    }

    public boolean isUseClasspathDefault() {
        return Boolean.TRUE.equals(useClasspathDefault);
    }

    public Boolean getUseClasspathDefault() { return useClasspathDefault; }
    public void setUseClasspathDefault(Boolean useClasspathDefault) { this.useClasspathDefault = useClasspathDefault; }
    public String getServiceAccountJson() { return serviceAccountJson; }
    public void setServiceAccountJson(String serviceAccountJson) { this.serviceAccountJson = serviceAccountJson; }
    public String getDelegatedUser() { return delegatedUser; }
    public void setDelegatedUser(String delegatedUser) { this.delegatedUser = delegatedUser; }
    public String getSmtpHost() { return smtpHost; }
    public void setSmtpHost(String smtpHost) { this.smtpHost = smtpHost; }
    public Integer getSmtpPort() { return smtpPort; }
    public void setSmtpPort(Integer smtpPort) { this.smtpPort = smtpPort; }
    public String getSmtpUsername() { return smtpUsername; }
    public void setSmtpUsername(String smtpUsername) { this.smtpUsername = smtpUsername; }
    public String getSmtpPassword() { return smtpPassword; }
    public void setSmtpPassword(String smtpPassword) { this.smtpPassword = smtpPassword; }
    public Boolean getSmtpStarttls() { return smtpStarttls; }
    public void setSmtpStarttls(Boolean smtpStarttls) { this.smtpStarttls = smtpStarttls; }
    public String getOdooUrl() { return odooUrl; }
    public void setOdooUrl(String odooUrl) { this.odooUrl = odooUrl; }
    public String getOdooDatabase() { return odooDatabase; }
    public void setOdooDatabase(String odooDatabase) { this.odooDatabase = odooDatabase; }
    public String getOdooUsername() { return odooUsername; }
    public void setOdooUsername(String odooUsername) { this.odooUsername = odooUsername; }
    public String getOdooApiKey() { return odooApiKey; }
    public void setOdooApiKey(String odooApiKey) { this.odooApiKey = odooApiKey; }
}
