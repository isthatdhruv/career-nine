package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.Transient;

@Entity
@Table(name = "institute_batch_google")
public class InstituteBatchGoogle implements Serializable{
    private static final long serialVersionUID = 1L;

    @Id
    @Column(name="id")
    private int id;

    @Column(name = "Batch_id")
    private int Batch_id;

    @Column(name = "Email")
    private String Email;

    @Column(name = "Unique_id")
    private String Unique_id;

    @Column(name= "display")
    private byte display;

    @Transient
    private InstituteBatch instituteBatch;

    public InstituteBatchGoogle() {
	}

    public int getId() {
        return id;
    }
    public void setId(int id) {
        this.id = id;
    }
    public int getBatch_id() {
        return Batch_id;
    }
    public void setBatch_id(int batch_id) {
        Batch_id = batch_id;
    }
    public byte getDisplay() {
        return display;
    }
    public void setDisplay(byte display) {
        this.display = display;
    }
    public String getEmail() {
        return Email;
    }
    public void setEmail(String email) {
        Email = email;
    }
    public String getUnique_id() {
        return Unique_id;
    }
    public void setUnique_id(String unique_id) {
        Unique_id = unique_id;
    }
    
}
