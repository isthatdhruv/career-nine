package com.kccitm.api.model.career9.counselling;

import java.io.Serializable;
import java.time.LocalDateTime;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;

/**
 * Idempotency ledger for the multi-offset counselling reminder scheduler.
 * One row is written per reminder actually dispatched, keyed by
 * (appointment, audience, offset), so re-running the hourly/5-minute job never
 * double-sends the same reminder.
 */
@Entity
@Table(name = "counselling_reminder_sent",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_reminder_sent",
                columnNames = {"appointment_id", "audience", "offset_code"}))
public class CounsellingReminderSent implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "appointment_id", nullable = false)
    private Long appointmentId;

    /** STUDENT | COUNSELLOR */
    @Column(name = "audience", nullable = false, length = 20)
    private String audience;

    /** T12H | T4H | T2H | T15M */
    @Column(name = "offset_code", nullable = false, length = 10)
    private String offsetCode;

    @Column(name = "sent_at", nullable = false)
    private LocalDateTime sentAt;

    @PrePersist
    public void prePersist() {
        if (this.sentAt == null) this.sentAt = LocalDateTime.now();
    }

    public CounsellingReminderSent() {
    }

    public CounsellingReminderSent(Long appointmentId, String audience, String offsetCode) {
        this.appointmentId = appointmentId;
        this.audience = audience;
        this.offsetCode = offsetCode;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAppointmentId() { return appointmentId; }
    public void setAppointmentId(Long appointmentId) { this.appointmentId = appointmentId; }

    public String getAudience() { return audience; }
    public void setAudience(String audience) { this.audience = audience; }

    public String getOffsetCode() { return offsetCode; }
    public void setOffsetCode(String offsetCode) { this.offsetCode = offsetCode; }

    public LocalDateTime getSentAt() { return sentAt; }
    public void setSentAt(LocalDateTime sentAt) { this.sentAt = sentAt; }
}
