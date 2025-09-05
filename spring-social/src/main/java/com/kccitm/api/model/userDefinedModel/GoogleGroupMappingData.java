package com.kccitm.api.model.userDefinedModel;

public class GoogleGroupMappingData {
    private String typeOfGroup;
    private int forignKeys;
    private String typeOfGroupName;

    public GoogleGroupMappingData(String typeOfGroup, int forignKeys, String typeOfGroupName) {
        this.typeOfGroup = typeOfGroup;
        this.forignKeys = forignKeys;
        this.typeOfGroupName = typeOfGroupName;
    }

    public GoogleGroupMappingData() {
    }

    public String getTypeOfGroup() {
        return this.typeOfGroup;
    }

    public void setTypeOfGroup(String typeOfGroup) {
        this.typeOfGroup = typeOfGroup;
    }

    public int getForignKeys() {
        return this.forignKeys;
    }

    public void setForignKeys(int forignKeys) {
        this.forignKeys = forignKeys;
    }

    public String getTypeOfGroupName() {
        return this.typeOfGroupName;
    }

    public void setTypeOfGroupName(String typeOfGroupName) {
        this.typeOfGroupName = typeOfGroupName;
    }

}
