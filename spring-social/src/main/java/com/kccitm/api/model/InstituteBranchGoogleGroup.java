package com.kccitm.api.model;

import javax.persistence.Transient;
import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;

@Entity
@Table(name = "institute_branch_google_group")
public class InstituteBranchGoogleGroup implements Serializable {
    private static final long serialVersionUID = 1L;


    @Id
	@Column(name = "id")
	private int id;

    @Column(name = "institute_branch_id")
    private int instituteBranchId;

    @Column(name = "name")
    private String name;

    public int getId() {
        return id;
    }
    public void setId(int id) {
        this.id = id;
    }
 public int getInstituteBranchId() {
     return instituteBranchId;
 }
 public void setInstituteBranchId(int instituteBranchId) {
     this.instituteBranchId = instituteBranchId;
 }
    
    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }

    @Transient
    private InstituteBranch instituteBranch;


}
