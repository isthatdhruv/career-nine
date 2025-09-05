package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.Table;
import javax.persistence.Transient;

/**
 * The persistent class for the institute_branch_batch_map database table.
 *
 */
@Entity
@Table(name = "institute_branch_batch_map")
// @NamedQuery(name="InstituteBranchBatchMapping.findAll", query="SELECT i FROM
// InstituteBranchBatchMapping i")
public class InstituteBranchBatchMapping implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "map_id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int mapId;
    private Boolean display;
    // bi-directional many-to-one association to InstituteBatch

    @JoinColumn(name = "batch_id")
    private int batchId;
    // bi-directional many-to-one association to InstituteBranch

    @JoinColumn(name = "branch_id")
    private int branchId;

    @Transient
    private InstituteBatch instituteBatch;

    public InstituteBranchBatchMapping() {
    }

    public InstituteBranchBatchMapping(int batchId, int branchId2) {
        this.batchId = batchId;
        this.branchId = branchId2;
    }

    public int getMapId() {
        return this.mapId;
    }

    public int getBatchId() {
        return batchId;
    }

    public int getBranchId() {
        return branchId;
    }

    public Boolean getDisplay() {
        return display;
    }

    public InstituteBatch getInstituteBatch() {
        return instituteBatch;
    }

    public static long getSerialversionuid() {
        return serialVersionUID;
    }

    public void setBatchId(int batchId) {
        this.batchId = batchId;
    }

    public void setBranchId(int branchId) {
        this.branchId = branchId;
    }

    public void setDisplay(Boolean display) {
        this.display = display;
    }

    public void setInstituteBatch(InstituteBatch instituteBatch) {
        this.instituteBatch = instituteBatch;
    }

    public void setMapId(int mapId) {
        this.mapId = mapId;
    }

}