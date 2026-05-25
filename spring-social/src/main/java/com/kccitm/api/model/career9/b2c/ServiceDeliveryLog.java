package com.kccitm.api.model.career9.b2c;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * One row per outbound service notification (email/sms/whatsapp) tied to an entitlement.
 * Distinct from CommunicationLog which is broader/unified across the app — this one
 * carries entitlement-specific fields (service_type, link_url, opens/clicks).
 */
@Entity
@Table(name = "service_delivery_log")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class ServiceDeliveryLog implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "entitlement_id")
    private Long entitlementId;

    @Column(name = "user_student_id")
    private Long userStudentId;

    @Column(name = "service_type", length = 40, nullable = false)
    private String serviceType;

    @Column(name = "channel", length = 20, nullable = false)
    private String channel;

    @Column(name = "recipient", length = 200)
    private String recipient;

    @Column(name = "subject", length = 300)
    private String subject;

    @Column(name = "link_url", length = 1000)
    private String linkUrl;

    @Column(name = "template_key", length = 100)
    private String templateKey;

    @Column(name = "provider_message_id", length = 100)
    private String providerMessageId;

    @Column(name = "delivery_status", length = 30, columnDefinition = "varchar(30) default 'queued'")
    private String deliveryStatus = "queued";

    @Column(name = "failure_reason", length = 500)
    private String failureReason;

    @Column(name = "sent_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date sentAt;

    @Column(name = "opened_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date openedAt;

    @Column(name = "clicked_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date clickedAt;

    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = new Date();
        if (deliveryStatus == null) deliveryStatus = "queued";
    }

    public ServiceDeliveryLog() {}

    public Long getId() { return id; }
    public void setId(Long v) { this.id = v; }
    public Long getEntitlementId() { return entitlementId; }
    public void setEntitlementId(Long v) { this.entitlementId = v; }
    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long v) { this.userStudentId = v; }
    public String getServiceType() { return serviceType; }
    public void setServiceType(String v) { this.serviceType = v; }
    public String getChannel() { return channel; }
    public void setChannel(String v) { this.channel = v; }
    public String getRecipient() { return recipient; }
    public void setRecipient(String v) { this.recipient = v; }
    public String getSubject() { return subject; }
    public void setSubject(String v) { this.subject = v; }
    public String getLinkUrl() { return linkUrl; }
    public void setLinkUrl(String v) { this.linkUrl = v; }
    public String getTemplateKey() { return templateKey; }
    public void setTemplateKey(String v) { this.templateKey = v; }
    public String getProviderMessageId() { return providerMessageId; }
    public void setProviderMessageId(String v) { this.providerMessageId = v; }
    public String getDeliveryStatus() { return deliveryStatus; }
    public void setDeliveryStatus(String v) { this.deliveryStatus = v; }
    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String v) { this.failureReason = v; }
    public Date getSentAt() { return sentAt; }
    public void setSentAt(Date v) { this.sentAt = v; }
    public Date getOpenedAt() { return openedAt; }
    public void setOpenedAt(Date v) { this.openedAt = v; }
    public Date getClickedAt() { return clickedAt; }
    public void setClickedAt(Date v) { this.clickedAt = v; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date v) { this.createdAt = v; }
}
