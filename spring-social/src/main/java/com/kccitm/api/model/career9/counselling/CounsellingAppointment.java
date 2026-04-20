package com.kccitm.api.model.career9.counselling;

import java.io.Serializable;
import java.time.LocalDateTime;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.OneToOne;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.UserStudent;

@Entity
@Table(name = "counselling_appointment")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class CounsellingAppointment implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "slot_id", nullable = false)
    private CounsellingSlot slot;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "student_id", nullable = false)
    private UserStudent student;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "counsellor_id", nullable = true)
    private Counsellor counsellor;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "assigned_by", nullable = true)
    private User assignedBy;

    @Column(name = "status", nullable = false, columnDefinition = "VARCHAR(20) DEFAULT 'PENDING'")
    private String status = "PENDING";

    @Column(name = "student_reason", columnDefinition = "TEXT")
    private String studentReason;

    @Column(name = "meeting_link", length = 500)
    private String meetingLink;

    @Column(name = "meeting_link_source", columnDefinition = "VARCHAR(10) DEFAULT 'AUTO'")
    private String meetingLinkSource = "AUTO";

    @Column(name = "reminder_24h_sent")
    private Boolean reminder24hSent = false;

    @Column(name = "reminder_1h_sent")
    private Boolean reminder1hSent = false;

    @Column(name = "rescheduled_from_appointment_id")
    private Long rescheduledFromAppointmentId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (this.createdAt == null) this.createdAt = now;
        this.updatedAt = now;
        if (this.status == null) this.status = "PENDING";
        if (this.meetingLinkSource == null) this.meetingLinkSource = "AUTO";
        if (this.reminder24hSent == null) this.reminder24hSent = false;
        if (this.reminder1hSent == null) this.reminder1hSent = false;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public CounsellingAppointment() {
    }

    // Getters and Setters

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public CounsellingSlot getSlot() {
        return slot;
    }

    public void setSlot(CounsellingSlot slot) {
        this.slot = slot;
    }

    public UserStudent getStudent() {
        return student;
    }

    public void setStudent(UserStudent student) {
        this.student = student;
    }

    public Counsellor getCounsellor() {
        return counsellor;
    }

    public void setCounsellor(Counsellor counsellor) {
        this.counsellor = counsellor;
    }

    public User getAssignedBy() {
        return assignedBy;
    }

    public void setAssignedBy(User assignedBy) {
        this.assignedBy = assignedBy;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getStudentReason() {
        return studentReason;
    }

    public void setStudentReason(String studentReason) {
        this.studentReason = studentReason;
    }

    public String getMeetingLink() {
        return meetingLink;
    }

    public void setMeetingLink(String meetingLink) {
        this.meetingLink = meetingLink;
    }

    public String getMeetingLinkSource() {
        return meetingLinkSource;
    }

    public void setMeetingLinkSource(String meetingLinkSource) {
        this.meetingLinkSource = meetingLinkSource;
    }

    public Boolean getReminder24hSent() {
        return reminder24hSent;
    }

    public void setReminder24hSent(Boolean reminder24hSent) {
        this.reminder24hSent = reminder24hSent;
    }

    public Boolean getReminder1hSent() {
        return reminder1hSent;
    }

    public void setReminder1hSent(Boolean reminder1hSent) {
        this.reminder1hSent = reminder1hSent;
    }

    public Long getRescheduledFromAppointmentId() {
        return rescheduledFromAppointmentId;
    }

    public void setRescheduledFromAppointmentId(Long rescheduledFromAppointmentId) {
        this.rescheduledFromAppointmentId = rescheduledFromAppointmentId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
