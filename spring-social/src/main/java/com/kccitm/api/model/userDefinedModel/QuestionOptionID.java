package com.kccitm.api.model.userDefinedModel;

import java.util.ArrayList;

public class QuestionOptionID {
    Long QuestionairQuestionId;
    Long OptiononId;
    ArrayList<MeasuredQualityList> measuredQualityList;

    public QuestionOptionID() {
    }

    public QuestionOptionID(Long QuestionairQuestionId, Long OptiononId,
            ArrayList<MeasuredQualityList> measuredQualityList) {
        this.QuestionairQuestionId = QuestionairQuestionId;
        this.OptiononId = OptiononId;
        this.measuredQualityList = measuredQualityList;
    }

    public ArrayList<MeasuredQualityList> getMeasuredQualityList() {
        return measuredQualityList;
    }

    public void setMeasuredQualityList(ArrayList<MeasuredQualityList> measuredQualityList) {
        this.measuredQualityList = measuredQualityList;
    }

    public Long getOptiononId() {
        return OptiononId;
    }

    public Long getQuestionairQuestionId() {
        return QuestionairQuestionId;
    }

    public void setOptiononId(Long optiononId) {
        OptiononId = optiononId;
    }

    public void setQuestionairQuestionId(Long questionairQuestionId) {
        QuestionairQuestionId = questionairQuestionId;
    }

}
