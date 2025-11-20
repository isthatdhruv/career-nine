package com.kccitm.api.model.career9;

import java.io.Serializable;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.validation.constraints.NotNull;

@Entity
@Table(name = "counsellor")
public class Counsellor implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    long counsellorId;
    @NotNull
    String counsellorName;
    @NotNull
    String counsellorEmail;
    @NotNull   
    String counsellorPassword;
    @NotNull
    String counsellorPhone;

    public Long getCounsellorId() {
        return counsellorId;
    }
    public void setCounsellorId(Long counsellorId) {
        this.counsellorId = counsellorId;
    }
    public String getCounsellorName() {
        return counsellorName;
    }
    public void setCounsellorName(String counsellorName) {
        this.counsellorName = counsellorName;
    }
    public String getCounsellorEmail() {
        return counsellorEmail;
    }
    public void setCounsellorEmail(String counsellorEmail) {
        this.counsellorEmail = counsellorEmail;
    }
    public String getCounsellorPhone() {
        return counsellorPhone;
    }
    public void setCounsellorPhone(String counsellorPhone) {
        this.counsellorPhone = counsellorPhone;
    }
    public String getCounsellorPassword() {
        return counsellorPassword;
    }
    public void setCounsellorPassword(String counsellorPassword) {
        this.counsellorPassword = counsellorPassword;
    }
}