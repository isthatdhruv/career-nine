package com.kccitm.api.model.career9;

import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

/**
 * One step of one scope during a dashboard release.
 *
 * <p>A release walks many scopes off-thread and each scope goes through several stages,
 * the expensive one being an OpenAI call that can fail for reasons an admin needs to read
 * — a missing key, a rate limit, a timeout. The status on {@link PrincipalDashboardData}
 * records where a scope ended up; this records how it got there and, when it failed, why.
 *
 * <p>Rows are written and never updated. A step that fails is a new row rather than an
 * edit to the step that started it, so the trace stays a trace.
 */
@Entity
@Table(name = "principal_dashboard_release_log")
public class PrincipalDashboardReleaseLog {

    /** Steps in the order they happen. Two of them bracket the run itself. */
    public static final String STEP_RELEASE_STARTED = "RELEASE_STARTED";
    public static final String STEP_PLANNED = "PLANNED";
    public static final String STEP_SNAPSHOT = "SNAPSHOT";
    public static final String STEP_METRICS = "METRICS";
    public static final String STEP_AI_REQUEST = "AI_REQUEST";
    public static final String STEP_AI_RESPONSE = "AI_RESPONSE";
    public static final String STEP_SAVED = "SAVED";
    public static final String STEP_SKIPPED = "SKIPPED";
    public static final String STEP_FAILED = "FAILED";
    public static final String STEP_RELEASE_FINISHED = "RELEASE_FINISHED";
    public static final String STEP_UNPUBLISHED = "UNPUBLISHED";
    public static final String STEP_REPUBLISHED = "REPUBLISHED";
    public static final String STEP_EMAILED = "EMAILED";

    public static final String OUTCOME_OK = "OK";
    public static final String OUTCOME_FAILED = "FAILED";
    public static final String OUTCOME_SKIPPED = "SKIPPED";

    /** MySQL TEXT truncates silently; a stack-trace-laden message is clipped on purpose. */
    private static final int MAX_MESSAGE = 4000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "release_id", nullable = false, length = 64)
    private String releaseId;

    @Column(name = "institute_code", nullable = false)
    private Long instituteCode;

    @Column(name = "assessment_id")
    private Long assessmentId;

    /** Null for events that belong to the run rather than to one cohort. */
    @Column(name = "scope_key", length = 255)
    private String scopeKey;

    @Column(name = "scope_label", length = 255)
    private String scopeLabel;

    @Column(name = "step", nullable = false, length = 32)
    private String step;

    @Column(name = "outcome", nullable = false, length = 16)
    private String outcome;

    @Column(name = "message", columnDefinition = "TEXT")
    private String message;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", nullable = false)
    private Date createdAt = new Date();

    public PrincipalDashboardReleaseLog() {
    }

    public static PrincipalDashboardReleaseLog of(String releaseId, Long instituteCode,
            Long assessmentId, String scopeKey, String scopeLabel,
            String step, String outcome, String message, Long durationMs) {
        PrincipalDashboardReleaseLog entry = new PrincipalDashboardReleaseLog();
        entry.releaseId = releaseId;
        entry.instituteCode = instituteCode;
        entry.assessmentId = assessmentId;
        entry.scopeKey = scopeKey;
        entry.scopeLabel = scopeLabel;
        entry.step = step;
        entry.outcome = outcome;
        entry.setMessage(message);
        entry.durationMs = durationMs;
        entry.createdAt = new Date();
        return entry;
    }

    public Long getId() {
        return id;
    }

    public String getReleaseId() {
        return releaseId;
    }

    public Long getInstituteCode() {
        return instituteCode;
    }

    public Long getAssessmentId() {
        return assessmentId;
    }

    public String getScopeKey() {
        return scopeKey;
    }

    public String getScopeLabel() {
        return scopeLabel;
    }

    public String getStep() {
        return step;
    }

    public String getOutcome() {
        return outcome;
    }

    public String getMessage() {
        return message;
    }

    /** Clipped rather than allowed to fail the insert — a truncated reason still explains. */
    public void setMessage(String message) {
        if (message != null && message.length() > MAX_MESSAGE) {
            this.message = message.substring(0, MAX_MESSAGE) + " …[truncated]";
        } else {
            this.message = message;
        }
    }

    public Long getDurationMs() {
        return durationMs;
    }

    public Date getCreatedAt() {
        return createdAt;
    }
}
