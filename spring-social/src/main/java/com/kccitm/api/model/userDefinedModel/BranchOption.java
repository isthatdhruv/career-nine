package com.kccitm.api.model.userDefinedModel;

import java.util.ArrayList;
import java.util.List;

import com.kccitm.api.model.InstituteBranch;

public class BranchOption {
    private int branchId;

    private String branchName;

    private List<BatchOption> batchOptions;

    public BranchOption(String courseName, InstituteBranch b) {

        this.branchId = b.getBranchId();
        this.branchName = courseName + "-" + b.getBranchName();
        List<BatchOption> batchOptions = new ArrayList<BatchOption>();
        b.getInstituteBranchBatchMapping().forEach((y) -> {
            BatchOption bo = new BatchOption(y);
            batchOptions.add(bo);
        });
        this.batchOptions = batchOptions;
    }

    public int getBranchId() {
        return branchId;
    }

    public String getBranchName() {
        return branchName;
    }

    public void setBranchId(int branchId) {
        this.branchId = branchId;
    }

    public void setBranchName(String branchName) {
        this.branchName = branchName;
    }

    public List<BatchOption> getBatchOptions() {
        return this.batchOptions;
    }

    public void setBatchOptions(List<BatchOption> batchOptions) {
        this.batchOptions = batchOptions;
    }

}
