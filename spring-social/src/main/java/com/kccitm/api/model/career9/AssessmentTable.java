package com.kccitm.api.model.career9;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.OneToOne;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.kccitm.api.model.career9.Questionaire.Questionnaire;

// import org.springframework.boot.context.properties.bind.DefaultValue;

// import net.bytebuddy.implementation.bind.annotation.Default;

@Entity
@Table(name = "assessment_table")
public class AssessmentTable implements java.io.Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "assessment_id")
    private Long id;

    @JsonProperty("AssessmentName")
    private String AssessmentName;

    @Column(name = "is_active")
    private Boolean isActive;

    private Boolean modeofAssessment;

    private String starDate;

    private String endDate;

    @OneToOne(cascade = javax.persistence.CascadeType.ALL)
    @JoinColumn(name = "questionnaire_id")
    private Questionnaire questionnaire;

    // Timer visibility flag
    @Column(name = "show_timer", columnDefinition = "BOOLEAN DEFAULT TRUE")
    private Boolean showTimer = true;

    @Column(name = "is_locked", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean isLocked = false;

    @Column(name = "save_later", columnDefinition = "BOOLEAN DEFAULT TRUE")
    private Boolean saveLater = true;

    @Column(name = "is_deleted", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean isDeleted = false;

    @Column(name = "collect_email_and_phone", columnDefinition = "BOOLEAN DEFAULT TRUE")
    private Boolean collectEmailAndPhone = true;

    @Column(name = "default_purchase_path", length = 1, columnDefinition = "char(1) default 'B'")
    private String defaultPurchasePath = "B";

    @Column(name = "default_counselling_model", length = 1, columnDefinition = "char(1) default '1'")
    private String defaultCounsellingModel = "1";

    /**
     * Selects which generator the post-completion prepare endpoint dispatches to.
     * Allowed values: "bet" | "navigator". Null = legacy default of "bet"
     * (historical behaviour for B2C entitlements before this column was added —
     * content team should backfill explicitly for Navigator-typed assessments).
     */
    @Column(name = "report_type", length = 32)
    private String reportType;

    /**
     * Max number of times this assessment can be reset for a single student.
     * Once reset count for (assessmentId, userStudentId) hits this value,
     * further resets should be blocked. Null = unlimited.
     */
    @Column(name = "max_resets_per_student")
    private Integer maxResetsPerStudent;

    public Integer getMaxResetsPerStudent() {
        return maxResetsPerStudent;
    }

    public void setMaxResetsPerStudent(Integer maxResetsPerStudent) {
        this.maxResetsPerStudent = maxResetsPerStudent;
    }


    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public AssessmentTable(Long id, String AssessmentName, String starDate, String endDate, Boolean isActive) {
        this.id = id;
        this.AssessmentName = AssessmentName;
        this.starDate = starDate;
        this.endDate = endDate;
        this.isActive = isActive;
    }

    public AssessmentTable() {
    }

    public String getAssessmentName() {
        return AssessmentName;
    }

    public void setAssessmentName(String AssessmentName) {
        this.AssessmentName = AssessmentName;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public Boolean getModeofAssessment() {
        return modeofAssessment;
    }

    public void setModeofAssessment(Boolean modeofAssessment) {
        this.modeofAssessment = modeofAssessment;
    }

    public String getStarDate() {
        return starDate;
    }

    public void setStarDate(String starDate) {
        this.starDate = starDate;
    }

    public String getEndDate() {
        return endDate;
    }

    public void setEndDate(String endDate) {
        this.endDate = endDate;
    }

    public Questionnaire getQuestionnaire() {
        return questionnaire;
    }

    public void setQuestionnaire(Questionnaire questionnaire) {
        this.questionnaire = questionnaire;
    }

    public Boolean getShowTimer() {
        return showTimer;
    }

    public void setShowTimer(Boolean showTimer) {
        this.showTimer = showTimer;
    }

    public Boolean getIsLocked() {
        return isLocked;
    }

    public void setIsLocked(Boolean isLocked) {
        this.isLocked = isLocked;
    }

    public Boolean getSaveLater() {
        return saveLater;
    }

    public void setSaveLater(Boolean saveLater) {
        this.saveLater = saveLater;
    }

    public Boolean getIsDeleted() {
        return isDeleted;
    }

    public void setIsDeleted(Boolean isDeleted) {
        this.isDeleted = isDeleted;
    }

    public Boolean getCollectEmailAndPhone() {
        return collectEmailAndPhone;
    }

    public void setCollectEmailAndPhone(Boolean collectEmailAndPhone) {
        this.collectEmailAndPhone = collectEmailAndPhone;
    }

    public String getDefaultPurchasePath() {
        return defaultPurchasePath;
    }

    public void setDefaultPurchasePath(String defaultPurchasePath) {
        this.defaultPurchasePath = defaultPurchasePath;
    }

    public String getDefaultCounsellingModel() {
        return defaultCounsellingModel;
    }

    public void setDefaultCounsellingModel(String defaultCounsellingModel) {
        this.defaultCounsellingModel = defaultCounsellingModel;
    }

    public String getReportType() {
        return reportType;
    }

    public void setReportType(String reportType) {
        this.reportType = reportType;
    }

}