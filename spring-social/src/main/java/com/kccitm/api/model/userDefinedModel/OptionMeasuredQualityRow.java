package com.kccitm.api.model.userDefinedModel;

public class OptionMeasuredQualityRow {
    private Long questionairQuestionId;
    private Long optionId;
    private Integer optionScore;
    private String measuredQualityTypeName;
    private String measuredQualityName;

    public OptionMeasuredQualityRow() {
    }

    public OptionMeasuredQualityRow(Long questionairQuestionId, Long optionId, Integer optionScore,
            String measuredQualityTypeName, String measuredQualityName) {
        this.questionairQuestionId = questionairQuestionId;
        this.optionId = optionId;
        this.optionScore = optionScore;
        this.measuredQualityTypeName = measuredQualityTypeName;
        this.measuredQualityName = measuredQualityName;
    }

    public Long getQuestionairQuestionId() {
        return questionairQuestionId;
    }

    public void setQuestionairQuestionId(Long questionairQuestionId) {
        this.questionairQuestionId = questionairQuestionId;
    }

    public Long getOptionId() {
        return optionId;
    }

    public void setOptionId(Long optionId) {
        this.optionId = optionId;
    }

    public Integer getOptionScore() {
        return optionScore;
    }

    public void setOptionScore(Integer optionScore) {
        this.optionScore = optionScore;
    }

    public String getMeasuredQualityTypeName() {
        return measuredQualityTypeName;
    }

    public void setMeasuredQualityTypeName(String measuredQualityTypeName) {
        this.measuredQualityTypeName = measuredQualityTypeName;
    }

    public String getMeasuredQualityName() {
        return measuredQualityName;
    }

    public void setMeasuredQualityName(String measuredQualityName) {
        this.measuredQualityName = measuredQualityName;
    }
}
