package com.kccitm.api.model.career9.counselling;

import java.io.Serializable;
import java.time.LocalDateTime;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;

/**
 * Wrong-OTP counter for one student, used when an offline counsellor types the student's
 * counselling code on the "Mark done" form.
 *
 * <p>Keyed by the student, not by an appointment or a mapping row. The code is derived from the
 * DOB and never changes, so the cap has to follow the student: keyed on the mapping it would
 * reset every time the student is re-mapped, and keyed on an appointment there is nothing to
 * key on before the record exists. No FK to {@code user_student} for the same reason the
 * migration gives: that table may not exist yet when Flyway runs on a fresh database.
 *
 * <p>All timestamps are {@link com.kccitm.api.service.counselling.CounsellingClock} (IST
 * wall-clock) values, so the lock times shown to the counsellor read in their own time.
 */
@Entity
@Table(name = "counselling_otp_guard")
public class CounsellingOtpGuard implements Serializable {

    private static final long serialVersionUID = 1L;

    /** user_student.user_student_id. */
    @Id
    @Column(name = "student_id")
    private Long studentId;

    /** Wrong codes in the current window; cleared when the window lapses or a lock is set. */
    @Column(name = "failed_attempts", nullable = false)
    private Integer failedAttempts = 0;

    @Column(name = "window_started_at")
    private LocalDateTime windowStartedAt;

    /** Every wrong code ever typed for this student. Never reset — it drives the permanent lock. */
    @Column(name = "total_failures", nullable = false)
    private Integer totalFailures = 0;

    @Column(name = "locked_until")
    private LocalDateTime lockedUntil;

    @Column(name = "last_failed_by_counsellor_id")
    private Long lastFailedByCounsellorId;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        if (this.failedAttempts == null) this.failedAttempts = 0;
        if (this.totalFailures == null) this.totalFailures = 0;
        this.updatedAt = LocalDateTime.now();
    }

    public CounsellingOtpGuard() {
    }

    public CounsellingOtpGuard(Long studentId) {
        this.studentId = studentId;
    }

    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }

    public int getFailedAttempts() { return failedAttempts == null ? 0 : failedAttempts; }
    public void setFailedAttempts(Integer failedAttempts) { this.failedAttempts = failedAttempts; }

    public LocalDateTime getWindowStartedAt() { return windowStartedAt; }
    public void setWindowStartedAt(LocalDateTime windowStartedAt) { this.windowStartedAt = windowStartedAt; }

    public int getTotalFailures() { return totalFailures == null ? 0 : totalFailures; }
    public void setTotalFailures(Integer totalFailures) { this.totalFailures = totalFailures; }

    public LocalDateTime getLockedUntil() { return lockedUntil; }
    public void setLockedUntil(LocalDateTime lockedUntil) { this.lockedUntil = lockedUntil; }

    public Long getLastFailedByCounsellorId() { return lastFailedByCounsellorId; }
    public void setLastFailedByCounsellorId(Long lastFailedByCounsellorId) {
        this.lastFailedByCounsellorId = lastFailedByCounsellorId;
    }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
