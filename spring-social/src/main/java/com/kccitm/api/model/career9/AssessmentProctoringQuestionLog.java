package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.time.LocalDateTime;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;
import javax.persistence.PrePersist;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;

@Entity
@Table(name = "assessment_proctoring_question_log")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class AssessmentProctoringQuestionLog implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "proctoring_log_id")
    private Long proctoringLogId;

    // Direct link to student
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_student_id", referencedColumnName = "user_student_id", nullable = false)
    private UserStudent userStudent;

    // Direct link to assessment
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "assessment_id", referencedColumnName = "assessment_id", nullable = false)
    private AssessmentTable assessment;

    // The question this data belongs to
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "questionnaire_question_id", referencedColumnName = "questionnaire_question_id", nullable = false)
    private QuestionnaireQuestion questionnaireQuestion;

    // Screen dimensions
    @Column(name = "screen_width")
    private Integer screenWidth;

    @Column(name = "screen_height")
    private Integer screenHeight;

    // Question element position on screen
    @Column(name = "question_rect_json", columnDefinition = "TEXT")
    private String questionRectJson;

    // Option element positions on screen
    @Column(name = "options_rect_json", columnDefinition = "TEXT")
    private String optionsRectJson;

    // Gaze/eye tracking points mapped to screen during this question
    @Lob
    @Column(name = "gaze_points_json", columnDefinition = "LONGTEXT")
    private String gazePointsJson;

    // Raw eye gaze screen coordinate data (from WebGazer.js)
    @Lob
    @Column(name = "eye_gaze_points_json", columnDefinition = "LONGTEXT")
    private String eyeGazePointsJson;

    // The option the student's eyes looked at first
    @Column(name = "first_looked_option_id")
    private Long firstLookedOptionId;

    // Time tracking
    @Column(name = "time_spent_ms")
    private Long timeSpentMs;

    @Column(name = "question_start_time")
    private Long questionStartTime;

    @Column(name = "question_end_time")
    private Long questionEndTime;

    // Mouse clicks on this question
    @Column(name = "mouse_click_count")
    private Integer mouseClickCount;

    @Column(name = "mouse_clicks_json", columnDefinition = "TEXT")
    private String mouseClicksJson;

    // Face detection per question
    @Column(name = "max_faces_detected")
    private Integer maxFacesDetected;

    @Column(name = "avg_faces_detected")
    private Double avgFacesDetected;

    // Head away events on this question
    @Column(name = "head_away_count")
    private Integer headAwayCount;

    // Tab switch events on this question
    @Column(name = "tab_switch_count")
    private Integer tabSwitchCount;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }

    public AssessmentProctoringQuestionLog() {
    }

    // Getters and Setters
    public Long getProctoringLogId() {
        return proctoringLogId;
    }

    public void setProctoringLogId(Long proctoringLogId) {
        this.proctoringLogId = proctoringLogId;
    }

    public UserStudent getUserStudent() {
        return userStudent;
    }

    public void setUserStudent(UserStudent userStudent) {
        this.userStudent = userStudent;
    }

    public AssessmentTable getAssessment() {
        return assessment;
    }

    public void setAssessment(AssessmentTable assessment) {
        this.assessment = assessment;
    }

    public QuestionnaireQuestion getQuestionnaireQuestion() {
        return questionnaireQuestion;
    }

    public void setQuestionnaireQuestion(QuestionnaireQuestion questionnaireQuestion) {
        this.questionnaireQuestion = questionnaireQuestion;
    }

    public Integer getScreenWidth() {
        return screenWidth;
    }

    public void setScreenWidth(Integer screenWidth) {
        this.screenWidth = screenWidth;
    }

    public Integer getScreenHeight() {
        return screenHeight;
    }

    public void setScreenHeight(Integer screenHeight) {
        this.screenHeight = screenHeight;
    }

    public String getQuestionRectJson() {
        return questionRectJson;
    }

    public void setQuestionRectJson(String questionRectJson) {
        this.questionRectJson = questionRectJson;
    }

    public String getOptionsRectJson() {
        return optionsRectJson;
    }

    public void setOptionsRectJson(String optionsRectJson) {
        this.optionsRectJson = optionsRectJson;
    }

    public String getGazePointsJson() {
        return gazePointsJson;
    }

    public void setGazePointsJson(String gazePointsJson) {
        this.gazePointsJson = gazePointsJson;
    }

    public Long getTimeSpentMs() {
        return timeSpentMs;
    }

    public void setTimeSpentMs(Long timeSpentMs) {
        this.timeSpentMs = timeSpentMs;
    }

    public Long getQuestionStartTime() {
        return questionStartTime;
    }

    public void setQuestionStartTime(Long questionStartTime) {
        this.questionStartTime = questionStartTime;
    }

    public Long getQuestionEndTime() {
        return questionEndTime;
    }

    public void setQuestionEndTime(Long questionEndTime) {
        this.questionEndTime = questionEndTime;
    }

    public Integer getMouseClickCount() {
        return mouseClickCount;
    }

    public void setMouseClickCount(Integer mouseClickCount) {
        this.mouseClickCount = mouseClickCount;
    }

    public String getMouseClicksJson() {
        return mouseClicksJson;
    }

    public void setMouseClicksJson(String mouseClicksJson) {
        this.mouseClicksJson = mouseClicksJson;
    }

    public Integer getMaxFacesDetected() {
        return maxFacesDetected;
    }

    public void setMaxFacesDetected(Integer maxFacesDetected) {
        this.maxFacesDetected = maxFacesDetected;
    }

    public Double getAvgFacesDetected() {
        return avgFacesDetected;
    }

    public void setAvgFacesDetected(Double avgFacesDetected) {
        this.avgFacesDetected = avgFacesDetected;
    }

    public Integer getHeadAwayCount() {
        return headAwayCount;
    }

    public void setHeadAwayCount(Integer headAwayCount) {
        this.headAwayCount = headAwayCount;
    }

    public Integer getTabSwitchCount() {
        return tabSwitchCount;
    }

    public void setTabSwitchCount(Integer tabSwitchCount) {
        this.tabSwitchCount = tabSwitchCount;
    }

    public String getEyeGazePointsJson() {
        return eyeGazePointsJson;
    }

    public void setEyeGazePointsJson(String eyeGazePointsJson) {
        this.eyeGazePointsJson = eyeGazePointsJson;
    }

    public Long getFirstLookedOptionId() {
        return firstLookedOptionId;
    }

    public void setFirstLookedOptionId(Long firstLookedOptionId) {
        this.firstLookedOptionId = firstLookedOptionId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
