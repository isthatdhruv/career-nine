package com.kccitm.api.model.userDefinedModel;

public class GoogleGroupMapping {
    private String groupName;
    private GoogleGroupMappingData googleGroupMappingData;

    public String getGroupName() {
        return this.groupName;
    }

    public void setGroupName(String groupName) {
        this.groupName = groupName;
    }

    public GoogleGroupMappingData getGoogleGroupMappingData() {
        return this.googleGroupMappingData;
    }

    public void setGoogleGroupMappingData(GoogleGroupMappingData googleGroupMappingData) {
        this.googleGroupMappingData = googleGroupMappingData;
    }

}
