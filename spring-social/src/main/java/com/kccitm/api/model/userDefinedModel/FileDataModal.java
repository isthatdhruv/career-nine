package com.kccitm.api.model.userDefinedModel;

public class FileDataModal {
    
    Object data;
    String fileName;
    String type;

    public Object getData() {
        return data;
    }

    public String getFileName() {
        return fileName;
    }

    public String getType() {
        return type;
    }

    public void setData(Object data) {
        this.data = data;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public void setType(String type) {
        this.type = type;
    }
}
