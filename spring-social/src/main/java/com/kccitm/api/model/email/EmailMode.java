package com.kccitm.api.model.email;

/**
 * How a {@link EmailProvider#GMAIL} account talks to Google.
 *
 * <p>{@code API} uses the Gmail API over HTTPS (works where outbound SMTP ports are
 * blocked, e.g. DigitalOcean — this is what production must use). {@code SMTP} uses
 * {@code smtp.gmail.com} with an app password (simple, but needs port-587 egress).
 * Ignored for {@link EmailProvider#ODOO} (always JSON-RPC).
 */
public enum EmailMode {
    API,
    SMTP
}
