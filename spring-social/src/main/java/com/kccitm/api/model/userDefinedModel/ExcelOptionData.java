package com.kccitm.api.model.userDefinedModel;

import java.util.ArrayList;

public class ExcelOptionData {
    
    String Name;

    ArrayList<QuestionOptionID> QuestionOptionId;

    public ExcelOptionData(String Name, ArrayList<QuestionOptionID> QuestionOptionId) {
        this.Name = Name;
        this.QuestionOptionId = QuestionOptionId;
    }

    public ExcelOptionData() {
    }

    public String getName() {
        return Name;
    }

    public ArrayList<QuestionOptionID> getQuestionOptionId() {
        return QuestionOptionId;
    }
    public void setName(String name) {
        Name = name;
    }
    public void setQuestionOptionId(ArrayList<QuestionOptionID> questionOptionId) {
        QuestionOptionId = questionOptionId;
    }

}
