package com.kccitm.api.model.userDefinedModel;

import com.kccitm.api.model.InstituteBranchBatchMapping;

public class BatchOption {
    private int batchId;

    private String BatchName;

    public BatchOption(InstituteBranchBatchMapping y) {
        this.batchId = y.getBatchId();
        this.BatchName = y.getInstituteBatch().getBatchStart() + "-" + y.getInstituteBatch().getBatchEnd();
    }

    public int getBatchId() {
        return batchId;
    }

    public String getBatchName() {
        return BatchName;
    }

    public void setBatchId(int batchId) {
        this.batchId = batchId;
    }

    public void setBatchName(String batchName) {
        BatchName = batchName;
    }

}
