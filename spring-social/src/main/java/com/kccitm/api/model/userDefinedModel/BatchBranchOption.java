package com.kccitm.api.model.userDefinedModel;

import java.util.ArrayList;
import java.util.List;

import com.kccitm.api.model.InstituteDetail;

public class BatchBranchOption {

    private int instituteCode;

    private Boolean display;

    private String instituteAddress;

    private String instituteName;

    private List<BranchOption> branchOptions;

    public BatchBranchOption(InstituteDetail insituteDetails) {
        this.instituteCode = insituteDetails.getInstituteCode();
        this.display = insituteDetails.getDisplay();
        this.instituteAddress = insituteDetails.getInstituteAddress();
        this.instituteName = insituteDetails.getInstituteAddress();
        List<BranchOption> boList = new ArrayList<BranchOption>();
        insituteDetails.getInstituteCourse().forEach((t) -> {
            t.getInstituteBranchs().forEach((b) -> {
                BranchOption branchOptions = new BranchOption(t.getCourseName(), b);
                boList.add(branchOptions);
            });
        });
        this.branchOptions = boList;
    }

    public int getInstituteCode() {
        return this.instituteCode;
    }

    public void setInstituteCode(int instituteCode) {
        this.instituteCode = instituteCode;
    }

    public Boolean isDisplay() {
        return this.display;
    }

    public Boolean getDisplay() {
        return this.display;
    }

    public void setDisplay(Boolean display) {
        this.display = display;
    }

    public String getInstituteAddress() {
        return this.instituteAddress;
    }

    public void setInstituteAddress(String instituteAddress) {
        this.instituteAddress = instituteAddress;
    }

    public String getInstituteName() {
        return this.instituteName;
    }

    public void setInstituteName(String instituteName) {
        this.instituteName = instituteName;
    }

    public List<BranchOption> getBranchOptions() {
        return this.branchOptions;
    }

    public void setBranchOptions(List<BranchOption> branchOptions) {
        this.branchOptions = branchOptions;
    }

}
