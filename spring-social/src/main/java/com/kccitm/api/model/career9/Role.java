package com.kccitm.api.model.career9;

import java.io.Serializable;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.validation.constraints.NotNull;
// import javax.persistence.Id;
@Entity
@Table(name = "role")
public class Role implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long role_id;

    @NotNull
    String role_name;

    public Long getRole_id() {
        return role_id;
    }
    public void setRole_id(Long role_id) {
        this.role_id = role_id;
    }
    public String getRole_name() {
        return role_name;
    }
    public void setRole_name(String role_name) {
        this.role_name = role_name;
    }
}