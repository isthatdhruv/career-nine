package com.kccitm.api.model.email;

/**
 * Create/update payload for an {@link EmailAccount} from the admin dashboard. On update,
 * a null/empty {@link #credentials} means "keep the existing secrets" — credentials are
 * write-only and never returned to the frontend, so an edit that doesn't re-enter them
 * must not wipe them.
 */
public class EmailAccountForm {

    public String name;
    public EmailProvider provider;
    public EmailMode mode;
    public String fromEmail;
    public String fromName;
    public Boolean isGlobalDefault;
    public Boolean active;
    public EmailAccountCredentials credentials;
}
