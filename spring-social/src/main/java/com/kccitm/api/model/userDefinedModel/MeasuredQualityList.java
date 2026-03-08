package com.kccitm.api.model.userDefinedModel;

public class MeasuredQualityList {
    String NameMeasuredQuealityType;
    Integer OptionScore;
    String NameMeasuredQuality;

    public MeasuredQualityList() {
    }

    public MeasuredQualityList(String NameMeasuredQuealityType, Integer OptionScore, String NameMeasuredQuality) {
        this.NameMeasuredQuality = NameMeasuredQuality;
        this.NameMeasuredQuealityType = NameMeasuredQuealityType;
        this.OptionScore = OptionScore;

    }

    public String getNameMeasuredQuality() {
        return NameMeasuredQuality;
    }

    public void setNameMeasuredQuality(String NameMeasuredQuality) {
        this.NameMeasuredQuality = NameMeasuredQuality;
    }

    public String getNameMeasuredQuealityType() {
        return NameMeasuredQuealityType;
    }

    public void setNameMeasuredQuealityType(String NameMeasuredQuealityType) {
        this.NameMeasuredQuealityType = NameMeasuredQuealityType;
    }

    public Integer getOptionScore() {
        return OptionScore;
    }

    public void setOptionScore(Integer OptionScore) {
        this.OptionScore = OptionScore;
    }

}
