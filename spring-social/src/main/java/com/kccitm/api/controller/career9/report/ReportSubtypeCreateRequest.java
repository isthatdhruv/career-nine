package com.kccitm.api.controller.career9.report;

public class ReportSubtypeCreateRequest {

    private String typeCode;
    private String code;
    private String displayName;
    private String spacesRenderFolder;

    public ReportSubtypeCreateRequest() {}

    public String getTypeCode() { return typeCode; }
    public void setTypeCode(String typeCode) { this.typeCode = typeCode; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getSpacesRenderFolder() { return spacesRenderFolder; }
    public void setSpacesRenderFolder(String spacesRenderFolder) { this.spacesRenderFolder = spacesRenderFolder; }
}
