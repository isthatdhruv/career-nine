package com.kccitm.api.model.userDefinedModel;

import java.util.ArrayList;

public class QuestionOptionID {
Long QuestionairQuestionId;
AssemenetQuestionOption OptiononId;
ArrayList<MeasuredQualityList> MeasuredList;

    public QuestionOptionID() {
    }

    public QuestionOptionID(Long QuestionairQuestionId, Long OptiononId,ArrayList<MeasuredQualityList> MeasuredList) {
        this.QuestionairQuestionId = QuestionairQuestionId;
        this.OptiononId = OptiononId;
        this.MeasuredList = MeasuredList;
    }

    public ArrayList<MeasuredQualityList> getMeasuredList() {
        return MeasuredList;
    }

    public void setMeasuredList(ArrayList<MeasuredQualityList> MeasuredList) {
        this.MeasuredList = MeasuredList;
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
