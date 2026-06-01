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
@Table(name = "reminder_suppression")
public class ReminderSuppression implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_student_id", nullable = false)
    private Long userStudentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "service_type", length = 40, nullable = false)
    private ReminderServiceType serviceType;

    @Column(name = "reason", length = 500)
    private String reason;

    @Column(name = "suppressed_by")
    private Long suppressedBy;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "suppressed_at", nullable = false)
    private Date suppressedAt;

    @PrePersist
    public void prePersist() {
        if (suppressedAt == null) suppressedAt = new Date();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }
    public ReminderServiceType getServiceType() { return serviceType; }
    public void setServiceType(ReminderServiceType serviceType) { this.serviceType = serviceType; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Long getSuppressedBy() { return suppressedBy; }
    public void setSuppressedBy(Long suppressedBy) { this.suppressedBy = suppressedBy; }
    public Date getSuppressedAt() { return suppressedAt; }
    public void setSuppressedAt(Date suppressedAt) { this.suppressedAt = suppressedAt; }
}
