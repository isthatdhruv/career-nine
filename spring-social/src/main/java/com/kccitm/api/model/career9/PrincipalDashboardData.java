package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * One generated dashboard for one scope of one institute.
 *
 * <p>A scope is a point on the filter lattice the principal's filter rail exposes —
 * the institute as a whole, a session, a class, a section, or a group. Releasing a
 * dashboard generates the whole lattice in a single batch, tagged with a shared
 * {@code releaseId}.
 *
 * <p><b>Identity is {@code scopeKey}, not the dimension columns.</b> MySQL treats
 * NULLs as distinct inside a unique index, so a composite key over the four nullable
 * dimensions would silently permit duplicate "all classes" rows. Every read and write
 * goes through {@link com.kccitm.api.service.dashboard.principal.ScopeKey} so the two
 * sides can never disagree about what a scope is called.
 *
 * <p><b>Boundary with {@link SchoolReport}:</b> that entity remains exclusively the
 * Cohort Insights store (institute + assessment, unscoped). This pipeline never writes
 * it, and CohortInsightGenerationService never writes this table.
 */
@Entity
@Table(name = "principal_dashboard_data",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_pdd_scope",
        columnNames = {"institute_code", "scope_key"}
    ),
    indexes = {
        @Index(name = "idx_pdd_release", columnList = "release_id"),
        @Index(name = "idx_pdd_institute_assessment", columnList = "institute_code,assessment_id"),
        @Index(name = "idx_pdd_status", columnList = "generation_status")
    }
)
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class PrincipalDashboardData implements Serializable {

    private static final long serialVersionUID = 1L;

    /** Lifecycle of a single scope. Per scope, never per release. */
    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_GENERATING = "GENERATING";
    public static final String STATUS_GENERATED = "GENERATED";
    public static final String STATUS_FAILED = "FAILED";
    /** Cohort below the configured floor: aggregates computed, AI narrative withheld. */
    public static final String STATUS_SKIPPED_SMALL_COHORT = "SKIPPED_SMALL_COHORT";

    public static final String LEVEL_INSTITUTE = "INSTITUTE";
    public static final String LEVEL_SESSION = "SESSION";
    public static final String LEVEL_CLASS = "CLASS";
    public static final String LEVEL_SECTION = "SECTION";
    public static final String LEVEL_GROUP = "GROUP";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "institute_code", nullable = false)
    private Long instituteCode;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @Column(name = "scope_key", nullable = false, length = 128)
    private String scopeKey;

    @Column(name = "scope_level", nullable = false, length = 16)
    private String scopeLevel;

    /** NULL on any dimension means "unconstrained", not "unknown". */
    @Column(name = "session_id")
    private Long sessionId;

    @Column(name = "class_id")
    private Long classId;

    @Column(name = "section_id")
    private Long sectionId;

    @Column(name = "group_id")
    private Long groupId;

    /** Deterministic aggregates — the same producers the Mira Desai exports use. */
    @Column(name = "internal_calculation", columnDefinition = "LONGTEXT")
    private String internalCalculation;

    /** Schema-constrained OpenAI JSON. Renders both the dashboard and the .docx. */
    @Column(name = "ai_response", columnDefinition = "LONGTEXT")
    private String aiResponse;

    /** Rendered from aiResponse, never requested from the API. Null until rendered. */
    @Column(name = "docx_path", length = 512)
    private String docxPath;

    @Column(name = "generation_status", nullable = false, length = 24)
    private String generationStatus = STATUS_PENDING;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    /**
     * When this content was produced. Deliberately distinct from {@link #updatedAt},
     * which moves on any write including a staleness flip — this is the timestamp the
     * dashboard shows the principal.
     */
    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "generated_at")
    private Date generatedAt;

    @Column(name = "generated_by")
    private Long generatedBy;

    @Column(name = "release_id", length = 36)
    private String releaseId;

    /** Scored students in this scope right now, refreshed on read. */
    @Column(name = "scored_count")
    private Integer scoredCount;

    /** Scored students at generation time — the staleness baseline for this scope. */
    @Column(name = "scored_at_generation")
    private Integer scoredAtGeneration;

    @Column(name = "min_cohort_size")
    private Integer minCohortSize;

    @Column(name = "stale_threshold")
    private Integer staleThreshold;

    @Column(name = "logic_version", length = 64)
    private String logicVersion;

    @Column(name = "prompt_version", length = 32)
    private String promptVersion;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "updated_at")
    private Date updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = new Date();
    }

    public PrincipalDashboardData() {}

    /**
     * True when enough new students have been scored since generation to make the
     * stored content worth regenerating.
     *
     * <p>Staleness is a flag, never a spend: nothing regenerates on its own, because
     * a regeneration costs money and rewrites wording a principal may already have
     * circulated. An admin decides.
     */
    public boolean isStale() {
        if (!STATUS_GENERATED.equals(generationStatus)) return false;
        if (scoredCount == null || scoredAtGeneration == null || staleThreshold == null) return false;
        return (scoredCount - scoredAtGeneration) >= staleThreshold;
    }

    /** New scored students since this scope was generated; 0 when unknown. */
    public int newStudentsSinceGeneration() {
        if (scoredCount == null || scoredAtGeneration == null) return 0;
        return Math.max(0, scoredCount - scoredAtGeneration);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getInstituteCode() { return instituteCode; }
    public void setInstituteCode(Long instituteCode) { this.instituteCode = instituteCode; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public String getScopeKey() { return scopeKey; }
    public void setScopeKey(String scopeKey) { this.scopeKey = scopeKey; }

    public String getScopeLevel() { return scopeLevel; }
    public void setScopeLevel(String scopeLevel) { this.scopeLevel = scopeLevel; }

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }

    public Long getClassId() { return classId; }
    public void setClassId(Long classId) { this.classId = classId; }

    public Long getSectionId() { return sectionId; }
    public void setSectionId(Long sectionId) { this.sectionId = sectionId; }

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }

    public String getInternalCalculation() { return internalCalculation; }
    public void setInternalCalculation(String internalCalculation) { this.internalCalculation = internalCalculation; }

    public String getAiResponse() { return aiResponse; }
    public void setAiResponse(String aiResponse) { this.aiResponse = aiResponse; }

    public String getDocxPath() { return docxPath; }
    public void setDocxPath(String docxPath) { this.docxPath = docxPath; }

    public String getGenerationStatus() { return generationStatus; }
    public void setGenerationStatus(String generationStatus) { this.generationStatus = generationStatus; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public Date getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(Date generatedAt) { this.generatedAt = generatedAt; }

    public Long getGeneratedBy() { return generatedBy; }
    public void setGeneratedBy(Long generatedBy) { this.generatedBy = generatedBy; }

    public String getReleaseId() { return releaseId; }
    public void setReleaseId(String releaseId) { this.releaseId = releaseId; }

    public Integer getScoredCount() { return scoredCount; }
    public void setScoredCount(Integer scoredCount) { this.scoredCount = scoredCount; }

    public Integer getScoredAtGeneration() { return scoredAtGeneration; }
    public void setScoredAtGeneration(Integer scoredAtGeneration) { this.scoredAtGeneration = scoredAtGeneration; }

    public Integer getMinCohortSize() { return minCohortSize; }
    public void setMinCohortSize(Integer minCohortSize) { this.minCohortSize = minCohortSize; }

    public Integer getStaleThreshold() { return staleThreshold; }
    public void setStaleThreshold(Integer staleThreshold) { this.staleThreshold = staleThreshold; }

    public String getLogicVersion() { return logicVersion; }
    public void setLogicVersion(String logicVersion) { this.logicVersion = logicVersion; }

    public String getPromptVersion() { return promptVersion; }
    public void setPromptVersion(String promptVersion) { this.promptVersion = promptVersion; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }

    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }
}
