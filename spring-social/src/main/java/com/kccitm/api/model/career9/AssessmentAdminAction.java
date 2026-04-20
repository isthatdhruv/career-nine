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
import javax.persistence.Table;

/**
 * Audit log for destructive admin actions on assessment submissions.
 * Records who did what, when, and (when relevant) the before/after state
 * so forensics are possible months later.
 *
 * actionType values:
 *   "reset"                 — admin wiped submission, student must retake
 *   "reconcile_persisted"   — admin flipped persistenceState to persisted
 *                             (data already in DB, flag was stale)
 *   "cleanup_redis"         — admin deleted Redis keys when DB already had full data
 *   "retry_now"             — admin forced an immediate retry
 *   "auto_expire"           — auto-expire sweep reset an old failed submission
 */
@Entity
@Table(
    name = "assessment_admin_action",
    indexes = {
        @Index(name = "idx_aaa_mapping", columnList = "user_student_id,assessment_id"),
        @Index(name = "idx_aaa_action_at", columnList = "action_at")
    }
)
public class AssessmentAdminAction implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "action_type", nullable = false, length = 32)
    private String actionType;

    @Column(name = "user_student_id", nullable = false)
    private Long userStudentId;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    // nullable — "system" actor for auto-expire sweeps
    @Column(name = "admin_user_id")
    private Long adminUserId;

    @Column(name = "action_at", nullable = false)
    private Instant actionAt;

    @Column(name = "reason", length = 500)
    private String reason;

    @Lob
    @Column(name = "before_state_json")
    private String beforeStateJson;

    @Lob
    @Column(name = "after_state_json")
    private String afterStateJson;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getActionType() { return actionType; }
    public void setActionType(String v) { this.actionType = v; }

    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long v) { this.userStudentId = v; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long v) { this.assessmentId = v; }

    public Long getAdminUserId() { return adminUserId; }
    public void setAdminUserId(Long v) { this.adminUserId = v; }

    public Instant getActionAt() { return actionAt; }
    public void setActionAt(Instant v) { this.actionAt = v; }

    public String getReason() { return reason; }
    public void setReason(String v) { this.reason = v; }

    public String getBeforeStateJson() { return beforeStateJson; }
    public void setBeforeStateJson(String v) { this.beforeStateJson = v; }

    public String getAfterStateJson() { return afterStateJson; }
    public void setAfterStateJson(String v) { this.afterStateJson = v; }
}
