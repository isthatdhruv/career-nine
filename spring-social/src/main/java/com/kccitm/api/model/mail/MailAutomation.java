package com.kccitm.api.model.mail;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.EnumType;
import javax.persistence.Enumerated;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

/**
 * An admin-configured rule: on one of {@link #triggerEvents} (or on {@link #cron} for an
 * audience), if {@link #conditions} hold, after {@link #delayMinutes} or at
 * {@link #relativeOffsetsMinutes} around {@link #relativeToField}, send {@link #templateId} to
 * {@link #recipientRoles}, at most {@link #maxSends} times, cancelled when one of
 * {@link #cancelOnEvents} arrives for the same subject. Multi-valued columns are CSV; the
 * list accessors are the API the engine uses.
 */
@Entity
@Table(name = "mail_automation")
public class MailAutomation implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Stable key for seeded automations (e.g. {@code b2c.assessment_invite_nudge}); null when admin-created. */
    @Column(name = "automation_key", length = 80)
    private String automationKey;

    @Column(name = "name", length = 160, nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "trigger_events", length = 600)
    private String triggerEvents;

    @Column(name = "cron_expression", length = 64)
    private String cron;

    @Column(name = "audience_key", length = 80)
    private String audienceKey;

    @Column(name = "conditions", length = 600)
    private String conditions;

    @Column(name = "delay_minutes", nullable = false)
    private Integer delayMinutes = 0;

    @Column(name = "relative_to_field", length = 60)
    private String relativeToField;

    @Column(name = "relative_offsets_minutes", length = 300)
    private String relativeOffsetsMinutes;

    @Column(name = "repeat_every_minutes")
    private Integer repeatEveryMinutes;

    @Column(name = "max_sends")
    private Integer maxSends;

    @Column(name = "template_id")
    private Long templateId;

    @Column(name = "email_type", length = 60)
    private String emailType;

    @Column(name = "recipient_roles", length = 200)
    private String recipientRoles;

    @Column(name = "extra_recipients", columnDefinition = "TEXT")
    private String extraRecipients;

    @Column(name = "cancel_on_events", length = 600)
    private String cancelOnEvents;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_mode", length = 12, nullable = false)
    private MailAutomationDelivery deliveryMode = MailAutomationDelivery.QUEUED;

    @Column(name = "recheck_before_send", nullable = false)
    private Boolean recheckBeforeSend = Boolean.FALSE;

    @Column(name = "respect_quiet_hours", nullable = false)
    private Boolean respectQuietHours = Boolean.TRUE;

    @Column(name = "channel", length = 20, nullable = false)
    private String channel = "EMAIL";

    /** CSV of institute codes; null means every institute. */
    @Column(name = "scope_institutes", columnDefinition = "TEXT")
    private String scopeInstitutes;

    @Column(name = "topic", length = 60)
    private String topic;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled = Boolean.TRUE;

    @Column(name = "paused", nullable = false)
    private Boolean paused = Boolean.FALSE;

    @Column(name = "seed_origin", length = 20)
    private String seedOrigin;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", nullable = false)
    private Date createdAt;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "updated_at", nullable = false)
    private Date updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;

    @PrePersist
    public void prePersist() {
        Date now = new Date();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
        if (delayMinutes == null) delayMinutes = 0;
        if (deliveryMode == null) deliveryMode = MailAutomationDelivery.QUEUED;
        if (recheckBeforeSend == null) recheckBeforeSend = Boolean.FALSE;
        if (respectQuietHours == null) respectQuietHours = Boolean.TRUE;
        if (channel == null) channel = "EMAIL";
        if (enabled == null) enabled = Boolean.TRUE;
        if (paused == null) paused = Boolean.FALSE;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = new Date();
    }

    // ─── list views over the CSV columns ──────────────────────────────────

    public static List<String> csvToList(String csv) {
        if (csv == null || csv.trim().isEmpty()) return Collections.emptyList();
        List<String> out = new ArrayList<>();
        for (String s : csv.split("[,\\n]")) {
            String t = s.trim();
            if (!t.isEmpty()) out.add(t);
        }
        return out;
    }

    public static String listToCsv(List<?> items) {
        if (items == null || items.isEmpty()) return null;
        StringBuilder sb = new StringBuilder();
        for (Object o : items) {
            if (o == null) continue;
            String t = String.valueOf(o).trim();
            if (t.isEmpty()) continue;
            if (sb.length() > 0) sb.append(',');
            sb.append(t);
        }
        return sb.length() == 0 ? null : sb.toString();
    }

    public List<String> triggerEventList() { return csvToList(triggerEvents); }
    public List<String> conditionList() { return csvToList(conditions); }
    public List<String> roleList() { return csvToList(recipientRoles); }
    public List<String> extraRecipientList() { return csvToList(extraRecipients); }
    public List<String> cancelEventList() { return csvToList(cancelOnEvents); }

    public List<Integer> offsetList() {
        List<Integer> out = new ArrayList<>();
        for (String s : csvToList(relativeOffsetsMinutes)) {
            try {
                out.add(Integer.parseInt(s));
            } catch (NumberFormatException ignored) {
                // skip junk
            }
        }
        return out;
    }

    /** Null when the automation applies everywhere. */
    public List<Integer> scopeList() {
        if (scopeInstitutes == null || scopeInstitutes.trim().isEmpty()) return null;
        List<Integer> out = new ArrayList<>();
        for (String s : csvToList(scopeInstitutes)) {
            try {
                out.add(Integer.parseInt(s));
            } catch (NumberFormatException ignored) {
                // skip junk
            }
        }
        return out;
    }

    public boolean isScheduled() {
        return cron != null && !cron.trim().isEmpty();
    }

    public boolean isActive() {
        return Boolean.TRUE.equals(enabled) && !Boolean.TRUE.equals(paused);
    }

    // ─── getters / setters ────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getAutomationKey() { return automationKey; }
    public void setAutomationKey(String automationKey) { this.automationKey = automationKey; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getTriggerEvents() { return triggerEvents; }
    public void setTriggerEvents(String triggerEvents) { this.triggerEvents = triggerEvents; }
    public String getCron() { return cron; }
    public void setCron(String cron) { this.cron = cron; }
    public String getAudienceKey() { return audienceKey; }
    public void setAudienceKey(String audienceKey) { this.audienceKey = audienceKey; }
    public String getConditions() { return conditions; }
    public void setConditions(String conditions) { this.conditions = conditions; }
    public Integer getDelayMinutes() { return delayMinutes; }
    public void setDelayMinutes(Integer delayMinutes) { this.delayMinutes = delayMinutes; }
    public String getRelativeToField() { return relativeToField; }
    public void setRelativeToField(String relativeToField) { this.relativeToField = relativeToField; }
    public String getRelativeOffsetsMinutes() { return relativeOffsetsMinutes; }
    public void setRelativeOffsetsMinutes(String relativeOffsetsMinutes) { this.relativeOffsetsMinutes = relativeOffsetsMinutes; }
    public Integer getRepeatEveryMinutes() { return repeatEveryMinutes; }
    public void setRepeatEveryMinutes(Integer repeatEveryMinutes) { this.repeatEveryMinutes = repeatEveryMinutes; }
    public Integer getMaxSends() { return maxSends; }
    public void setMaxSends(Integer maxSends) { this.maxSends = maxSends; }
    public Long getTemplateId() { return templateId; }
    public void setTemplateId(Long templateId) { this.templateId = templateId; }
    public String getEmailType() { return emailType; }
    public void setEmailType(String emailType) { this.emailType = emailType; }
    public String getRecipientRoles() { return recipientRoles; }
    public void setRecipientRoles(String recipientRoles) { this.recipientRoles = recipientRoles; }
    public String getExtraRecipients() { return extraRecipients; }
    public void setExtraRecipients(String extraRecipients) { this.extraRecipients = extraRecipients; }
    public String getCancelOnEvents() { return cancelOnEvents; }
    public void setCancelOnEvents(String cancelOnEvents) { this.cancelOnEvents = cancelOnEvents; }
    public MailAutomationDelivery getDeliveryMode() { return deliveryMode; }
    public void setDeliveryMode(MailAutomationDelivery deliveryMode) { this.deliveryMode = deliveryMode; }
    public Boolean getRecheckBeforeSend() { return recheckBeforeSend; }
    public void setRecheckBeforeSend(Boolean recheckBeforeSend) { this.recheckBeforeSend = recheckBeforeSend; }
    public Boolean getRespectQuietHours() { return respectQuietHours; }
    public void setRespectQuietHours(Boolean respectQuietHours) { this.respectQuietHours = respectQuietHours; }
    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }
    public String getScopeInstitutes() { return scopeInstitutes; }
    public void setScopeInstitutes(String scopeInstitutes) { this.scopeInstitutes = scopeInstitutes; }
    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }
    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    public Boolean getPaused() { return paused; }
    public void setPaused(Boolean paused) { this.paused = paused; }
    public String getSeedOrigin() { return seedOrigin; }
    public void setSeedOrigin(String seedOrigin) { this.seedOrigin = seedOrigin; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }
    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long updatedBy) { this.updatedBy = updatedBy; }
}
