package com.kccitm.api.model.reminder;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.EnumType;
import javax.persistence.Enumerated;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

@Entity
@Table(name = "reminder_config")
public class ReminderConfig implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "service_type", length = 40, nullable = false, unique = true)
    private ReminderServiceType serviceType;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled = Boolean.TRUE;

    @Column(name = "cron_expression", length = 64, nullable = false)
    private String cronExpression;

    @Column(name = "lead_time_minutes")
    private Integer leadTimeMinutes;

    @Column(name = "max_sends_per_recipient")
    private Integer maxSendsPerRecipient;

    @Column(name = "subject_template", length = 500, nullable = false)
    private String subjectTemplate;

    @Column(name = "body_template", columnDefinition = "MEDIUMTEXT", nullable = false)
    private String bodyTemplate;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "updated_at", nullable = false)
    private Date updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = new Date();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public ReminderServiceType getServiceType() { return serviceType; }
    public void setServiceType(ReminderServiceType serviceType) { this.serviceType = serviceType; }
    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    public String getCronExpression() { return cronExpression; }
    public void setCronExpression(String cronExpression) { this.cronExpression = cronExpression; }
    public Integer getLeadTimeMinutes() { return leadTimeMinutes; }
    public void setLeadTimeMinutes(Integer leadTimeMinutes) { this.leadTimeMinutes = leadTimeMinutes; }
    public Integer getMaxSendsPerRecipient() { return maxSendsPerRecipient; }
    public void setMaxSendsPerRecipient(Integer maxSendsPerRecipient) { this.maxSendsPerRecipient = maxSendsPerRecipient; }
    public String getSubjectTemplate() { return subjectTemplate; }
    public void setSubjectTemplate(String subjectTemplate) { this.subjectTemplate = subjectTemplate; }
    public String getBodyTemplate() { return bodyTemplate; }
    public void setBodyTemplate(String bodyTemplate) { this.bodyTemplate = bodyTemplate; }
    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }
    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long updatedBy) { this.updatedBy = updatedBy; }
}
