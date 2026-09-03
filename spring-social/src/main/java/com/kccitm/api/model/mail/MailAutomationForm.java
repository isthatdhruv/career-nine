package com.kccitm.api.model.mail;

import java.util.List;

/** Create/update payload for a {@link MailAutomation} from the admin editor. Null fields are left unchanged on update. */
public class MailAutomationForm {
    public String name;
    public String description;
    public List<String> triggerEvents;
    public String cron;
    public String audienceKey;
    public List<String> conditions;
    public Integer delayMinutes;
    public String relativeToField;
    public List<Integer> relativeOffsetsMinutes;
    public Integer repeatEveryMinutes;
    public Integer maxSends;
    public Long templateId;
    public String emailType;
    public List<String> recipientRoles;
    public List<String> extraRecipients;
    public List<String> cancelOnEvents;
    public String deliveryMode;
    public Boolean recheckBeforeSend;
    public Boolean respectQuietHours;
    public String channel;
    public List<Integer> scopeInstitutes;
    public String topic;
    public Boolean enabled;
    public Boolean paused;
}
