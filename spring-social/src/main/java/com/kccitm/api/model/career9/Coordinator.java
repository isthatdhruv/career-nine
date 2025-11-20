package com.kccitm.api.model.career9;

import java.io.Serializable;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.validation.constraints.NotNull;

@Entity
@Table(name = "coordinator")
public class Coordinator implements Serializable {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long coordinatorId;
    @NotNull
    String coordinatorName;
    @NotNull
    String coordinatorEmail;
    @NotNull
    String coordinatorPassword;
    @NotNull
    String coordinatorPhone;

    public Long getCoordinatorId() {
        return coordinatorId;
    }
    public void setCoordinatorId(Long coordinatorId) {
        this.coordinatorId = coordinatorId;
    }
    public String getCoordinatorName() {
        return coordinatorName;
    }
    public void setCoordinatorName(String coordinatorName) {
        this.coordinatorName = coordinatorName;
    }
    public String getCoordinatorEmail() {
        return coordinatorEmail;    
    }
    public void setCoordinatorEmail(String coordinatorEmail) {
        this.coordinatorEmail = coordinatorEmail;
    }
    public String getCoordinatorPhone() {
        return coordinatorPhone;
    }
    public void setCoordinatorPhone(String coordinatorPhone) {
        this.coordinatorPhone = coordinatorPhone;
    }
    public String getCoordinatorPassword() {
        return coordinatorPassword;
    }
    public void setCoordinatorPassword(String coordinatorPassword) {
        this.coordinatorPassword = coordinatorPassword;
    }
}