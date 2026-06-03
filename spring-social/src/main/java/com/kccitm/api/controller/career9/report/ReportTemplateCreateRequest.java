package com.kccitm.api.controller.career9.report;

public class ReportTemplateCreateRequest {

    private String code;
    private String displayName;
    private String engineCode;
    private String spacesRenderFolder;

    public ReportTemplateCreateRequest() {}

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getEngineCode() { return engineCode; }
    public void setEngineCode(String engineCode) { this.engineCode = engineCode; }

    public String getSpacesRenderFolder() { return spacesRenderFolder; }
    public void setSpacesRenderFolder(String spacesRenderFolder) { this.spacesRenderFolder = spacesRenderFolder; }
}
