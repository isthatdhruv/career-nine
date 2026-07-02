package com.kccitm.api.model.email;

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

/**
 * One row per send attempt routed through {@code EmailDispatchService} — the universal
 * audit trail surfaced on the frontend Email Log page. Written for every email type, mode,
 * and outcome.
 */
@Entity
@Table(name = "email_send_log")
public class EmailSendLog implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "email_type", length = 60)
    private String emailType;

    @Column(name = "recipient", length = 320)
    private String recipient;

    @Column(name = "subject", length = 500)
    private String subject;

    @Column(name = "account_id")
    private Long accountId;

    @Column(name = "template_id")
    private Long templateId;

    @Column(name = "institute_code")
    private Integer instituteCode;

    @Column(name = "user_student_id")
    private Long userStudentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_mode", length = 10)
    private EmailDeliveryMode deliveryMode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 10, nullable = false)
    private EmailSendStatus status;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", nullable = false)
    private Date createdAt;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "sent_at")
    private Date sentAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = new Date();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getEmailType() { return emailType; }
    public void setEmailType(String emailType) { this.emailType = emailType; }
    public String getRecipient() { return recipient; }
    public void setRecipient(String recipient) { this.recipient = recipient; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public Long getAccountId() { return accountId; }
    public void setAccountId(Long accountId) { this.accountId = accountId; }
    public Long getTemplateId() { return templateId; }
    public void setTemplateId(Long templateId) { this.templateId = templateId; }
    public Integer getInstituteCode() { return instituteCode; }
    public void setInstituteCode(Integer instituteCode) { this.instituteCode = instituteCode; }
    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }
    public EmailDeliveryMode getDeliveryMode() { return deliveryMode; }
    public void setDeliveryMode(EmailDeliveryMode deliveryMode) { this.deliveryMode = deliveryMode; }
    public EmailSendStatus getStatus() { return status; }
    public void setStatus(EmailSendStatus status) { this.status = status; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
    public Date getSentAt() { return sentAt; }
    public void setSentAt(Date sentAt) { this.sentAt = sentAt; }
}
