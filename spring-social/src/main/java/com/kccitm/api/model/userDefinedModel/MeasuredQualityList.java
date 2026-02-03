package com.kccitm.api.model.userDefinedModel;

public class MeasuredQualityList {
    String NameMeasuredQuealityType;
    Integer OptionScore; 

        public MeasuredQualityList() {
    }

    public MeasuredQualityList(String NameMeasuredQuealityType, Integer OptionScore) {
        this.NameMeasuredQuealityType = NameMeasuredQuealityType;
        this.OptionScore = OptionScore;
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
