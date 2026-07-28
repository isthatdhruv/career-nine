package com.kccitm.api.model.email;

/** Create/update payload for an {@link EmailTemplate} from the admin template editor. */
public class EmailTemplateForm {

    public String name;
    public String emailType;
    public String subjectTemplate;
    public String bodyTemplate;
    public Boolean isDefault;
    public EmailDeliveryMode deliveryMode;
    public Boolean active;
}
