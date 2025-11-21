package com.kccitm.api.model.career9;

import java.io.Serializable;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.validation.constraints.NotNull;

@Entity
@Table(name = "principal")
public class Principal implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long principalId;
    @NotNull
    String principalName;
    @NotNull
    String principalEmail;
    @NotNull
    String principalPassword;
    @NotNull
    String principalPhone;

    public Long getPrincipalId() {
        return principalId;
    }
    public void setPrincipalId(Long principalId) {
        this.principalId = principalId; 
    }
    public String getPrincipalName() {
        return principalName;
    }
    public void setPrincipalName(String principalName) {
        this.principalName = principalName;
    }
    public String getPrincipalEmail() {
        return principalEmail;
    }
    public void setPrincipalEmail(String principalEmail) {
        this.principalEmail = principalEmail;
    }
    public String getPrincipalPhone() {
        return principalPhone;
    }
    public void setPrincipalPhone(String principalPhone) {  
        this.principalPhone = principalPhone;
    }
    public String getPrincipalPassword() {
        return principalPassword;
    }
    public void setPrincipalPassword(String principalPassword) {
        this.principalPassword = principalPassword;
    }

}