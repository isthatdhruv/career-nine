package com.kccitm.api.controller.career9.report;

public class ReportSubtypeUpdateRequest {

    private String displayName;
    private String spacesRenderFolder;

    public ReportSubtypeUpdateRequest() {}

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getSpacesRenderFolder() { return spacesRenderFolder; }
    public void setSpacesRenderFolder(String spacesRenderFolder) { this.spacesRenderFolder = spacesRenderFolder; }
}
