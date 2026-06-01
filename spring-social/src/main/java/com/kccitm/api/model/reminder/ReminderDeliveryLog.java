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
import javax.persistence.PrePersist;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

@Entity
@Table(name = "reminder_delivery_log")
public class ReminderDeliveryLog implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "service_type", length = 40, nullable = false)
    private ReminderServiceType serviceType;

    @Column(name = "recipient", length = 200)
    private String recipient;

    @Column(name = "user_student_id")
    private Long userStudentId;

    @Column(name = "institute_code")
    private Integer instituteCode;

    @Column(name = "subject", length = 300)
    private String subject;

    @Column(name = "body_snapshot", columnDefinition = "MEDIUMTEXT")
    private String bodySnapshot;

    @Column(name = "link_url", length = 1000)
    private String linkUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_status", length = 20, nullable = false)
    private ReminderDeliveryStatus deliveryStatus = ReminderDeliveryStatus.SENT;

    @Column(name = "failure_reason", length = 500)
    private String failureReason;

    @Enumerated(EnumType.STRING)
    @Column(name = "triggered_by", length = 20, nullable = false)
    private ReminderTriggerSource triggeredBy = ReminderTriggerSource.SCHEDULED;

    @Column(name = "triggered_by_user_id")
    private Long triggeredByUserId;

    @Column(name = "entitlement_id")
    private Long entitlementId;

    @Column(name = "appointment_id")
    private Long appointmentId;

    @Column(name = "assessment_mapping_id")
    private Long assessmentMappingId;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "sent_at")
    private Date sentAt;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", nullable = false)
    private Date createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = new Date();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public ReminderServiceType getServiceType() { return serviceType; }
    public void setServiceType(ReminderServiceType serviceType) { this.serviceType = serviceType; }
    public String getRecipient() { return recipient; }
    public void setRecipient(String recipient) { this.recipient = recipient; }
    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }
    public Integer getInstituteCode() { return instituteCode; }
    public void setInstituteCode(Integer instituteCode) { this.instituteCode = instituteCode; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getBodySnapshot() { return bodySnapshot; }
    public void setBodySnapshot(String bodySnapshot) { this.bodySnapshot = bodySnapshot; }
    public String getLinkUrl() { return linkUrl; }
    public void setLinkUrl(String linkUrl) { this.linkUrl = linkUrl; }
    public ReminderDeliveryStatus getDeliveryStatus() { return deliveryStatus; }
    public void setDeliveryStatus(ReminderDeliveryStatus deliveryStatus) { this.deliveryStatus = deliveryStatus; }
    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }
    public ReminderTriggerSource getTriggeredBy() { return triggeredBy; }
    public void setTriggeredBy(ReminderTriggerSource triggeredBy) { this.triggeredBy = triggeredBy; }
    public Long getTriggeredByUserId() { return triggeredByUserId; }
    public void setTriggeredByUserId(Long triggeredByUserId) { this.triggeredByUserId = triggeredByUserId; }
    public Long getEntitlementId() { return entitlementId; }
    public void setEntitlementId(Long entitlementId) { this.entitlementId = entitlementId; }
    public Long getAppointmentId() { return appointmentId; }
    public void setAppointmentId(Long appointmentId) { this.appointmentId = appointmentId; }
    public Long getAssessmentMappingId() { return assessmentMappingId; }
    public void setAssessmentMappingId(Long assessmentMappingId) { this.assessmentMappingId = assessmentMappingId; }
    public Date getSentAt() { return sentAt; }
    public void setSentAt(Date sentAt) { this.sentAt = sentAt; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
}
