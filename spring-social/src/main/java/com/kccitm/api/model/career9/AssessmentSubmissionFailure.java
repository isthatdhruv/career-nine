package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.time.Instant;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.Lob;
import javax.persistence.PrePersist;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;

/**
 * Tracks async submission processor failures for a (student, assessment) pair.
 * One row per mapping; updated on each attempt. Used by the admin dashboard
 * to surface stuck submissions and by ops for alerting.
 */
@Entity
@Table(
    name = "assessment_submission_failure",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_student_id", "assessment_id"}),
    indexes = {
        @Index(name = "idx_asf_last_attempt", columnList = "last_attempt_at"),
        @Index(name = "idx_asf_first_failed", columnList = "first_failed_at")
    }
)
public class AssessmentSubmissionFailure implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_student_id", nullable = false)
    private Long userStudentId;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @Column(name = "first_failed_at", nullable = false)
    private Instant firstFailedAt;

    @Column(name = "last_attempt_at", nullable = false)
    private Instant lastAttemptAt;

    @Column(name = "next_retry_at")
    private Instant nextRetryAt;

    @Column(name = "attempt_count", nullable = false)
    private Integer attemptCount;

    @Column(name = "consecutive_non_transient_count", nullable = false)
    private Integer consecutiveNonTransientCount;

    @Column(name = "last_error_class", length = 255)
    private String lastErrorClass;

    @Lob
    @Column(name = "last_error_message")
    private String lastErrorMessage;

    @Column(name = "last_error_kind", length = 32)
    private String lastErrorKind;  // "transient" | "non_transient"

    @Column(name = "resolved", nullable = false)
    private Boolean resolved;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @PrePersist
    public void prePersist() {
        if (attemptCount == null) attemptCount = 0;
        if (consecutiveNonTransientCount == null) consecutiveNonTransientCount = 0;
        if (resolved == null) resolved = false;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long v) { this.userStudentId = v; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long v) { this.assessmentId = v; }

    public Instant getFirstFailedAt() { return firstFailedAt; }
    public void setFirstFailedAt(Instant v) { this.firstFailedAt = v; }

    public Instant getLastAttemptAt() { return lastAttemptAt; }
    public void setLastAttemptAt(Instant v) { this.lastAttemptAt = v; }

    public Instant getNextRetryAt() { return nextRetryAt; }
    public void setNextRetryAt(Instant v) { this.nextRetryAt = v; }

    public Integer getAttemptCount() { return attemptCount; }
    public void setAttemptCount(Integer v) { this.attemptCount = v; }

    public Integer getConsecutiveNonTransientCount() { return consecutiveNonTransientCount; }
    public void setConsecutiveNonTransientCount(Integer v) { this.consecutiveNonTransientCount = v; }

    public String getLastErrorClass() { return lastErrorClass; }
    public void setLastErrorClass(String v) { this.lastErrorClass = v; }

    public String getLastErrorMessage() { return lastErrorMessage; }
    public void setLastErrorMessage(String v) { this.lastErrorMessage = v; }

    public String getLastErrorKind() { return lastErrorKind; }
    public void setLastErrorKind(String v) { this.lastErrorKind = v; }

    public Boolean getResolved() { return resolved; }
    public void setResolved(Boolean v) { this.resolved = v; }

    public Instant getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Instant v) { this.resolvedAt = v; }
}
