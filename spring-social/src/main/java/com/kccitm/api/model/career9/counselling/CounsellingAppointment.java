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

    // Delivery mode snapshot taken from the slot at booking time: ONLINE | OFFLINE.
    @Column(name = "mode", length = 20)
    private String mode;

    // For OFFLINE sessions: the counsellor's office address copied at booking
    // time, so the confirmation email and the student's record stay stable even
    // if the counsellor later edits their profile.
    @Column(name = "location", columnDefinition = "TEXT")
    private String location;

    // Contact details the student fills in when booking. Captured per booking
    // (the student may want to be reached on a different number/email than the
    // one on their assessment record).
    @Column(name = "student_contact_name", length = 255)
    private String studentContactName;

    @Column(name = "student_contact_email", length = 255)
    private String studentContactEmail;

    @Column(name = "student_contact_phone", length = 30)
    private String studentContactPhone;

    // Optional parent/guardian contact — confirmation + reminders go here too.
    @Column(name = "parent_email", length = 255)
    private String parentEmail;

    @Column(name = "parent_phone", length = 30)
    private String parentPhone;

    // EMAIL | PHONE | WHATSAPP
    @Column(name = "preferred_contact_method", length = 20)
    private String preferredContactMethod;

    @Column(name = "reminder_24h_sent")
    private Boolean reminder24hSent = false;

    @Column(name = "reminder_1h_sent")
    private Boolean reminder1hSent = false;

    @Column(name = "rescheduled_from_appointment_id")
    private Long rescheduledFromAppointmentId;

    // Tracks how many times THE STUDENT has rescheduled this booking chain.
    // Counts only student-initiated reschedules; admin reschedules do not
    // increment this so admins remain unlimited (item 7). Value carries forward
    // when a new appointment is created via reschedule (chain it from the old).
    @Column(name = "student_reschedule_count", columnDefinition = "INT DEFAULT 0")
    private Integer studentRescheduleCount = 0;

    // Session check-in / attendance — set when the counsellor verifies the
    // student's OTP at the start of the session.
    @Column(name = "session_started_at")
    private LocalDateTime sessionStartedAt;

    @Column(name = "checkin_verified_at")
    private LocalDateTime checkinVerifiedAt;

    @Column(name = "attended")
    private Boolean attended;

    // The entitlement this booking drew its counselling session from. Used by the
    // lifecycle sweep to credit the session back on a no-show (always rebookable).
    @Column(name = "entitlement_id")
    private Long entitlementId;

    // ─── Cancellation attribution ────────────────────────────────────────────────
    // Who cancelled decides everything downstream: whether it costs the student one of her
    // misses, and whether the vacated slot reopens (student/admin) or is blocked because
    // the counsellor is not there. See docs/COUNSELLING_CANCELLATION.md §2.
    @Column(name = "cancelled_by_role", length = 20)
    private String cancelledByRole;

    @Column(name = "cancelled_by_user_id")
    private Long cancelledByUserId;

    @Column(name = "cancellation_reason", length = 50)
    private String cancellationReason;

    @Column(name = "cancellation_note", columnDefinition = "TEXT")
    private String cancellationNote;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    // ─── No-show attribution ─────────────────────────────────────────────────────
    // STUDENT when the counsellor marked her absent; COUNSELLOR when neither the OTP nor an
    // absent mark was recorded. Silence means the party holding both tools was not there.
    @Column(name = "missed_by_role", length = 20)
    private String missedByRole;

    @Column(name = "marked_absent_at")
    private LocalDateTime markedAbsentAt;

    @Column(name = "marked_absent_by")
    private Long markedAbsentBy;

    // ─── Dispute ─────────────────────────────────────────────────────────────────
    // A raised-but-unresolved dispute suspends the strike. An open dispute is not evidence
    // against the student, so it must never be counted.
    @Column(name = "dispute_raised_at")
    private LocalDateTime disputeRaisedAt;

    @Column(name = "dispute_resolved_at")
    private LocalDateTime disputeResolvedAt;

    @Column(name = "dispute_resolved_by")
    private Long disputeResolvedBy;

    // ─── Counsellor-caused reschedule ────────────────────────────────────────────
    // True when the system moved this session because the counsellor cancelled or failed to
    // appear. The student never chose this time, so it is exempt from her 2-hour window and
    // a cancellation on it does not count as a miss.
    @Column(name = "force_shifted")
    private Boolean forceShifted = false;

    @Column(name = "shifted_from_start")
    private LocalDateTime shiftedFromStart;

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
        if (this.studentRescheduleCount == null) this.studentRescheduleCount = 0;
        if (this.forceShifted == null) this.forceShifted = false;
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

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getStudentContactName() {
        return studentContactName;
    }

    public void setStudentContactName(String studentContactName) {
        this.studentContactName = studentContactName;
    }

    public String getStudentContactEmail() {
        return studentContactEmail;
    }

    public void setStudentContactEmail(String studentContactEmail) {
        this.studentContactEmail = studentContactEmail;
    }

    public String getStudentContactPhone() {
        return studentContactPhone;
    }

    public void setStudentContactPhone(String studentContactPhone) {
        this.studentContactPhone = studentContactPhone;
    }

    public String getParentEmail() {
        return parentEmail;
    }

    public void setParentEmail(String parentEmail) {
        this.parentEmail = parentEmail;
    }

    public String getParentPhone() {
        return parentPhone;
    }

    public void setParentPhone(String parentPhone) {
        this.parentPhone = parentPhone;
    }

    public String getPreferredContactMethod() {
        return preferredContactMethod;
    }

    public void setPreferredContactMethod(String preferredContactMethod) {
        this.preferredContactMethod = preferredContactMethod;
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

    public Integer getStudentRescheduleCount() {
        return studentRescheduleCount == null ? 0 : studentRescheduleCount;
    }

    public void setStudentRescheduleCount(Integer studentRescheduleCount) {
        this.studentRescheduleCount = studentRescheduleCount;
    }

    public LocalDateTime getSessionStartedAt() {
        return sessionStartedAt;
    }

    public void setSessionStartedAt(LocalDateTime sessionStartedAt) {
        this.sessionStartedAt = sessionStartedAt;
    }

    public LocalDateTime getCheckinVerifiedAt() {
        return checkinVerifiedAt;
    }

    public void setCheckinVerifiedAt(LocalDateTime checkinVerifiedAt) {
        this.checkinVerifiedAt = checkinVerifiedAt;
    }

    public Boolean getAttended() {
        return attended;
    }

    public void setAttended(Boolean attended) {
        this.attended = attended;
    }

    public Long getEntitlementId() {
        return entitlementId;
    }

    public void setEntitlementId(Long entitlementId) {
        this.entitlementId = entitlementId;
    }

    public String getCancelledByRole() {
        return cancelledByRole;
    }

    public void setCancelledByRole(String cancelledByRole) {
        this.cancelledByRole = cancelledByRole;
    }

    public Long getCancelledByUserId() {
        return cancelledByUserId;
    }

    public void setCancelledByUserId(Long cancelledByUserId) {
        this.cancelledByUserId = cancelledByUserId;
    }

    public String getCancellationReason() {
        return cancellationReason;
    }

    public void setCancellationReason(String cancellationReason) {
        this.cancellationReason = cancellationReason;
    }

    public String getCancellationNote() {
        return cancellationNote;
    }

    public void setCancellationNote(String cancellationNote) {
        this.cancellationNote = cancellationNote;
    }

    public LocalDateTime getCancelledAt() {
        return cancelledAt;
    }

    public void setCancelledAt(LocalDateTime cancelledAt) {
        this.cancelledAt = cancelledAt;
    }

    public String getMissedByRole() {
        return missedByRole;
    }

    public void setMissedByRole(String missedByRole) {
        this.missedByRole = missedByRole;
    }

    public LocalDateTime getMarkedAbsentAt() {
        return markedAbsentAt;
    }

    public void setMarkedAbsentAt(LocalDateTime markedAbsentAt) {
        this.markedAbsentAt = markedAbsentAt;
    }

    public Long getMarkedAbsentBy() {
        return markedAbsentBy;
    }

    public void setMarkedAbsentBy(Long markedAbsentBy) {
        this.markedAbsentBy = markedAbsentBy;
    }

    public LocalDateTime getDisputeRaisedAt() {
        return disputeRaisedAt;
    }

    public void setDisputeRaisedAt(LocalDateTime disputeRaisedAt) {
        this.disputeRaisedAt = disputeRaisedAt;
    }

    public LocalDateTime getDisputeResolvedAt() {
        return disputeResolvedAt;
    }

    public void setDisputeResolvedAt(LocalDateTime disputeResolvedAt) {
        this.disputeResolvedAt = disputeResolvedAt;
    }

    public Long getDisputeResolvedBy() {
        return disputeResolvedBy;
    }

    public void setDisputeResolvedBy(Long disputeResolvedBy) {
        this.disputeResolvedBy = disputeResolvedBy;
    }

    public Boolean getForceShifted() {
        return forceShifted != null && forceShifted;
    }

    public void setForceShifted(Boolean forceShifted) {
        this.forceShifted = forceShifted;
    }

    public LocalDateTime getShiftedFromStart() {
        return shiftedFromStart;
    }

    public void setShiftedFromStart(LocalDateTime shiftedFromStart) {
        this.shiftedFromStart = shiftedFromStart;
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
