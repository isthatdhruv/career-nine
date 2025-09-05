package com.kccitm.api.model.userDefinedModel;

public class ForgotPassword {
    String rollNo;
    String officialEmailAddress;
    String personalEmailAddress;

    public String getOfficialEmailAddress() {
        return officialEmailAddress;
    }
    public void setOfficialEmailAddress(String officialEmailAddress) {
        this.officialEmailAddress = officialEmailAddress;
    }
    public String getPersonalEmailAddress() {
        return personalEmailAddress;
    }
    public void setPersonalEmailAddress(String personalEmailAddress) {
        this.personalEmailAddress = personalEmailAddress;
    }
    public String getRollNo() {
        return rollNo;
    }
    public void setRollNo(String rollNo) {
        this.rollNo = rollNo;
    }

}
