package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;

/**
 * The persistent class for the branch database table.
 * 
 */
@Entity
@Table(name = "branch")
//branch entity
// @NamedQuery(name = "Branch.findAll", query = "SELECT b FROM Branch b")
public class Branch implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    private Boolean display;

    private String name;

    public Branch() {
    }

    public int getId() {
        return this.id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public Boolean getDisplay() {
        return this.display;
    }

    public void setDisplay(Boolean display) {
        if (display != null)
            this.display = display;
        else
            this.display = true;
    }

    public String getName() {
        return this.name;
    }

    public void setName(String name) {
        this.name = name;
    }

}