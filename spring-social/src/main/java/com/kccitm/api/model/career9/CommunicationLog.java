package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.time.LocalDateTime;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.Table;

/**
 * Unified log entry for email and WhatsApp messages sent from the app.
 * One row per send attempt (per recipient for bulk sends).
 */
@Entity
@Table(name = "communication_log")
public class CommunicationLog implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "log_id")
    private Long logId;

    /** "EMAIL" or "WHATSAPP" */
    @Column(name = "channel", length = 20, nullable = false)
    private String channel;

    @Column(name = "recipient_name", length = 255)
    private String recipientName;

    @Column(name = "recipient_email", length = 255)
    private String recipientEmail;

    @Column(name = "recipient_phone", length = 50)
    private String recipientPhone;

    /** Categorization: REPORT, CONTACT_ASSIGNMENT, ID_CARD, EMAIL_OTP, WELCOME, OTHER */
    @Column(name = "message_type", length = 50, nullable = false)
    private String messageType;

    /** "SENT" or "FAILED" */
    @Column(name = "status", length = 20, nullable = false)
    private String status;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "sent_by", length = 255)
    private String sentBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /**
     * Stamps the row in IST when nothing else has.
     *
     * <p>This was {@code LocalDateTime.now()}, and on this application that is wrong by five and
     * a half hours. The JVM is forced to UTC at startup, and a {@code LocalDateTime} carries no
     * zone — so a UTC wall-clock reading went into a plain datetime column and came back out
     * looking like local time. Every email and WhatsApp in the Communication Log read as having
     * been sent five and a half hours before it actually was, which for a message sent at
     * 9:00 am reads as 3:30 am the same morning.
     *
     * <p>{@code CommunicationLogService} normally sets this before the entity gets here, from the
     * configured zone. This is the fallback for anything constructing the entity directly, and it
     * uses the same zone so the two cannot disagree.
     */
    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now(java.time.ZoneId.of("Asia/Kolkata"));
        }
    }

    public CommunicationLog() {}

    // Getters and setters
    public Long getLogId() { return logId; }
    public void setLogId(Long logId) { this.logId = logId; }

    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }

    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }

    public String getRecipientEmail() { return recipientEmail; }
    public void setRecipientEmail(String recipientEmail) { this.recipientEmail = recipientEmail; }

    public String getRecipientPhone() { return recipientPhone; }
    public void setRecipientPhone(String recipientPhone) { this.recipientPhone = recipientPhone; }

    public String getMessageType() { return messageType; }
    public void setMessageType(String messageType) { this.messageType = messageType; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public String getSentBy() { return sentBy; }
    public void setSentBy(String sentBy) { this.sentBy = sentBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
