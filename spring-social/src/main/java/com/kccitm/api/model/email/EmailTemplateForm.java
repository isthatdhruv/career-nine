package com.kccitm.api.model.email;

import java.util.List;
import java.util.Map;

/**
 * Create/update payload for an {@link EmailTemplate} from the admin template editor. The
 * {@code preview*} fields are read only by the preview and lint endpoints and ignored on save.
 */
public class EmailTemplateForm {
    public String name;
    public String emailType;
    public String mailKey;
    public String subjectTemplate;
    public String bodyTemplate;
    public String textTemplate;
    public String mailClass;
    public List<String> variantFlags;
    public Boolean isDefault;
    public EmailDeliveryMode deliveryMode;
    public Boolean active;

    /** Preview only: placeholder or {{#flag}} values to force ("true" renders a section, "" hides it). */
    public Map<String, String> previewOverrides;
    /** Preview only: render with a sample whitelabel school instead of standard Career-9 branding. */
    public Boolean whitelabel;
}
