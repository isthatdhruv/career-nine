package com.kccitm.api.model.userDefinedModel;

import java.util.List;

public class StudentDashboardResponse {
    private StudentBasicInfo studentInfo;
    private List<AssessmentData> assessments;

    public StudentDashboardResponse() {
    }

    public StudentDashboardResponse(StudentBasicInfo studentInfo, List<AssessmentData> assessments) {
        this.studentInfo = studentInfo;
        this.assessments = assessments;
    }

    // Getters and Setters
    public StudentBasicInfo getStudentInfo() {
        return studentInfo;
    }

    public void setStudentInfo(StudentBasicInfo studentInfo) {
        this.studentInfo = studentInfo;
    }

    public List<AssessmentData> getAssessments() {
        return assessments;
    }

    public void setAssessments(List<AssessmentData> assessments) {
        this.assessments = assessments;
    }

    // Inner class for student basic info
    public static class StudentBasicInfo {
        private Long userStudentId;
        private Long userId;
        private String instituteName;
        private Integer instituteCode;

        public StudentBasicInfo() {
        }

        public StudentBasicInfo(Long userStudentId, Long userId, String instituteName, Integer instituteCode) {
            this.userStudentId = userStudentId;
            this.userId = userId;
            this.instituteName = instituteName;
            this.instituteCode = instituteCode;
        }

        // Getters and Setters
        public Long getUserStudentId() {
            return userStudentId;
        }

        public void setUserStudentId(Long userStudentId) {
            this.userStudentId = userStudentId;
        }

        public Long getUserId() {
            return userId;
        }

        public void setUserId(Long userId) {
            this.userId = userId;
        }

        public String getInstituteName() {
            return instituteName;
        }

        public void setInstituteName(String instituteName) {
            this.instituteName = instituteName;
        }

        public Integer getInstituteCode() {
            return instituteCode;
        }

        public void setInstituteCode(Integer instituteCode) {
            this.instituteCode = instituteCode;
        }
    }

    // Inner class for assessment data
    public static class AssessmentData {
        private Long assessmentId;
        private String assessmentName;
        private String status;
        private Boolean isActive;
        private String startDate;
        private String endDate;
        private Long studentAssessmentMappingId;
        private List<AnswerDetail> answers;
        private List<RawScoreData> rawScores;
        private Boolean questionnaireType;

        public AssessmentData() {
        }

        // Getters and Setters
        public Long getAssessmentId() {
            return assessmentId;
        }

        public void setAssessmentId(Long assessmentId) {
            this.assessmentId = assessmentId;
        }

        public String getAssessmentName() {
            return assessmentName;
        }

        public void setAssessmentName(String assessmentName) {
            this.assessmentName = assessmentName;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public Boolean getIsActive() {
            return isActive;
        }

        public void setIsActive(Boolean isActive) {
            this.isActive = isActive;
        }

        public String getStartDate() {
            return startDate;
        }

        public void setStartDate(String startDate) {
            this.startDate = startDate;
        }

        public String getEndDate() {
            return endDate;
        }

        public void setEndDate(String endDate) {
            this.endDate = endDate;
        }

        public Long getStudentAssessmentMappingId() {
            return studentAssessmentMappingId;
        }

        public void setStudentAssessmentMappingId(Long studentAssessmentMappingId) {
            this.studentAssessmentMappingId = studentAssessmentMappingId;
        }

        public List<AnswerDetail> getAnswers() {
            return answers;
        }

        public void setAnswers(List<AnswerDetail> answers) {
            this.answers = answers;
        }

        public List<RawScoreData> getRawScores() {
            return rawScores;
        }

        public void setRawScores(List<RawScoreData> rawScores) {
            this.rawScores = rawScores;
        }

        public Boolean getQuestionnaireType() {
            return questionnaireType;
        }

        public void setQuestionnaireType(Boolean questionnaireType) {
            this.questionnaireType = questionnaireType;
        }
    }

    // Inner class for answer details
    public static class AnswerDetail {
        private Long assessmentAnswerId;
        private Long questionnaireQuestionId;
        private Integer rankOrder;
        private String textResponse;
        private OptionData selectedOption;

        public AnswerDetail() {
        }

        // Getters and Setters
        public Long getAssessmentAnswerId() {
            return assessmentAnswerId;
        }

        public void setAssessmentAnswerId(Long assessmentAnswerId) {
            this.assessmentAnswerId = assessmentAnswerId;
        }

        public Long getQuestionnaireQuestionId() {
            return questionnaireQuestionId;
        }

        public void setQuestionnaireQuestionId(Long questionnaireQuestionId) {
            this.questionnaireQuestionId = questionnaireQuestionId;
        }

        public Integer getRankOrder() {
            return rankOrder;
        }

        public void setRankOrder(Integer rankOrder) {
            this.rankOrder = rankOrder;
        }

        public String getTextResponse() {
            return textResponse;
        }

        public void setTextResponse(String textResponse) {
            this.textResponse = textResponse;
        }

        public OptionData getSelectedOption() {
            return selectedOption;
        }

        public void setSelectedOption(OptionData selectedOption) {
            this.selectedOption = selectedOption;
        }
    }

    // Inner class for option data
    public static class OptionData {
        private Long optionId;
        private String optionText;
        private String optionDescription;
        private Boolean isCorrect;
        private List<MQTScore> mqtScores;

        public OptionData() {
        }

        // Getters and Setters
        public Long getOptionId() {
            return optionId;
        }

        public void setOptionId(Long optionId) {
            this.optionId = optionId;
        }

        public String getOptionText() {
            return optionText;
        }

        public void setOptionText(String optionText) {
            this.optionText = optionText;
        }

        public String getOptionDescription() {
            return optionDescription;
        }

        public void setOptionDescription(String optionDescription) {
            this.optionDescription = optionDescription;
        }

        public Boolean getIsCorrect() {
            return isCorrect;
        }

        public void setIsCorrect(Boolean isCorrect) {
            this.isCorrect = isCorrect;
        }

        public List<MQTScore> getMqtScores() {
            return mqtScores;
        }

        public void setMqtScores(List<MQTScore> mqtScores) {
            this.mqtScores = mqtScores;
        }
    }

    // Inner class for MQT score detail
    public static class MQTScore {
        private Long scoreId;
        private Integer score;
        private MQTData measuredQualityType;

        public MQTScore() {
        }

        // Getters and Setters
        public Long getScoreId() {
            return scoreId;
        }

        public void setScoreId(Long scoreId) {
            this.scoreId = scoreId;
        }

        public Integer getScore() {
            return score;
        }

        public void setScore(Integer score) {
            this.score = score;
        }

        public MQTData getMeasuredQualityType() {
            return measuredQualityType;
        }

        public void setMeasuredQualityType(MQTData measuredQualityType) {
            this.measuredQualityType = measuredQualityType;
        }
    }

    // Inner class for Measured Quality Type data
    public static class MQTData {
        private Long measuredQualityTypeId;
        private String name;
        private String description;
        private String displayName;
        private MQData measuredQuality;

        public MQTData() {
        }

        // Getters and Setters
        public Long getMeasuredQualityTypeId() {
            return measuredQualityTypeId;
        }

        public void setMeasuredQualityTypeId(Long measuredQualityTypeId) {
            this.measuredQualityTypeId = measuredQualityTypeId;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public String getDisplayName() {
            return displayName;
        }

        public void setDisplayName(String displayName) {
            this.displayName = displayName;
        }

        public MQData getMeasuredQuality() {
            return measuredQuality;
        }

        public void setMeasuredQuality(MQData measuredQuality) {
            this.measuredQuality = measuredQuality;
        }
    }

    // Inner class for Measured Quality data
    public static class MQData {
        private Long measuredQualityId;
        private String name;
        private String description;
        private String displayName;

        public MQData() {
        }

        // Getters and Setters
        public Long getMeasuredQualityId() {
            return measuredQualityId;
        }

        public void setMeasuredQualityId(Long measuredQualityId) {
            this.measuredQualityId = measuredQualityId;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public String getDisplayName() {
            return displayName;
        }

        public void setDisplayName(String displayName) {
            this.displayName = displayName;
        }
    }

    // Inner class for raw score data
    public static class RawScoreData {
        private Long assessmentRawScoreId;
        private Integer rawScore;
        private MQTData measuredQualityType;
        private MQData measuredQuality;

        public RawScoreData() {
        }

        // Getters and Setters
        public Long getAssessmentRawScoreId() {
            return assessmentRawScoreId;
        }

        public void setAssessmentRawScoreId(Long assessmentRawScoreId) {
            this.assessmentRawScoreId = assessmentRawScoreId;
        }

        public Integer getRawScore() {
            return rawScore;
        }

        public void setRawScore(Integer rawScore) {
            this.rawScore = rawScore;
        }

        public MQTData getMeasuredQualityType() {
            return measuredQualityType;
        }

        public void setMeasuredQualityType(MQTData measuredQualityType) {
            this.measuredQualityType = measuredQualityType;
        }

        public MQData getMeasuredQuality() {
            return measuredQuality;
        }

        public void setMeasuredQuality(MQData measuredQuality) {
            this.measuredQuality = measuredQuality;
        }
    }
}
