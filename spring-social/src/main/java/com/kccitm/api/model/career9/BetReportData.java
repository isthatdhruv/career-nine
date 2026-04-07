package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.PrePersist;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "bet_report_data")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class BetReportData implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "bet_report_data_id")
    private Long betReportDataId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_student_id", referencedColumnName = "user_student_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private UserStudent userStudent;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @Column(name = "student_name")
    private String studentName;

    @Column(name = "student_grade")
    private String studentGrade;

    @Column(columnDefinition = "TEXT")
    private String cog1;

    @Column(columnDefinition = "TEXT")
    private String cog2;

    @Column(columnDefinition = "TEXT")
    private String cog3;

    @Column(name = "cog3_description", columnDefinition = "TEXT")
    private String cog3Description;

    @Column(name = "self_management_1", columnDefinition = "TEXT")
    private String selfManagement1;

    @Column(name = "self_management_2", columnDefinition = "TEXT")
    private String selfManagement2;

    @Column(name = "self_management_3", columnDefinition = "TEXT")
    private String selfManagement3;

    private String environment;

    private String value1;
    private String value2;
    private String value3;

    @Column(name = "value_overview", columnDefinition = "TEXT")
    private String valueOverview;

    @Column(name = "social_insight", columnDefinition = "TEXT")
    private String socialInsight;

    @Column(name = "report_status", nullable = false)
    private String reportStatus = "notGenerated";

    @Column(name = "report_url", length = 4096)
    private String reportUrl;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = new Date();
    }

    public static long getSerialversionuid() {
        return serialVersionUID;
    }

    public Long getBetReportDataId() {
        return betReportDataId;
    }

    public void setBetReportDataId(Long betReportDataId) {
        this.betReportDataId = betReportDataId;
    }

    public UserStudent getUserStudent() {
        return userStudent;
    }

    public void setUserStudent(UserStudent userStudent) {
        this.userStudent = userStudent;
    }

    public Long getAssessmentId() {
        return assessmentId;
    }

    public void setAssessmentId(Long assessmentId) {
        this.assessmentId = assessmentId;
    }

    public String getStudentName() {
        return studentName;
    }

    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }

    public String getStudentGrade() {
        return studentGrade;
    }

    public void setStudentGrade(String studentGrade) {
        this.studentGrade = studentGrade;
    }

    public String getCog1() {
        return cog1;
    }

    public void setCog1(String cog1) {
        this.cog1 = cog1;
    }

    public String getCog2() {
        return cog2;
    }

    public void setCog2(String cog2) {
        this.cog2 = cog2;
    }

    public String getCog3() {
        return cog3;
    }

    public void setCog3(String cog3) {
        this.cog3 = cog3;
    }

    public String getCog3Description() {
        return cog3Description;
    }

    public void setCog3Description(String cog3Description) {
        this.cog3Description = cog3Description;
    }

    public String getSelfManagement1() {
        return selfManagement1;
    }

    public void setSelfManagement1(String selfManagement1) {
        this.selfManagement1 = selfManagement1;
    }

    public String getSelfManagement2() {
        return selfManagement2;
    }

    public void setSelfManagement2(String selfManagement2) {
        this.selfManagement2 = selfManagement2;
    }

    public String getSelfManagement3() {
        return selfManagement3;
    }

    public void setSelfManagement3(String selfManagement3) {
        this.selfManagement3 = selfManagement3;
    }

    public String getEnvironment() {
        return environment;
    }

    public void setEnvironment(String environment) {
        this.environment = environment;
    }

    public String getValue1() {
        return value1;
    }

    public void setValue1(String value1) {
        this.value1 = value1;
    }

    public String getValue2() {
        return value2;
    }

    public void setValue2(String value2) {
        this.value2 = value2;
    }

    public String getValue3() {
        return value3;
    }

    public void setValue3(String value3) {
        this.value3 = value3;
    }

    public String getValueOverview() {
        return valueOverview;
    }

    public void setValueOverview(String valueOverview) {
        this.valueOverview = valueOverview;
    }

    public String getSocialInsight() {
        return socialInsight;
    }

    public void setSocialInsight(String socialInsight) {
        this.socialInsight = socialInsight;
    }

    public String getReportStatus() {
        return reportStatus;
    }

    public void setReportStatus(String reportStatus) {
        this.reportStatus = reportStatus;
    }

    public String getReportUrl() {
        return reportUrl;
    }

    public void setReportUrl(String reportUrl) {
        this.reportUrl = reportUrl;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

}
