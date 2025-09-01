package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;


/**
 * The persistent class for the section database table.
 * 
 */
@Entity
@Table(name="section")
// @NamedQuery(name="section.findAll", query="SELECT s FROM section s")
public class Section implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	private int id;

	private Boolean display;

	private String name;

	public Section() {
	}

	public int getId() {
		return this.id;
	}

	public void setId(int id) {
		this.id = id;
	}

	public Boolean getDisplay() {
		return display;
	}
	public void setDisplay(Boolean display) {
		this.display = display;
	}

	public String getName() {
		return this.name;
	}

	public void setName(String name) {
		this.name = name;
	}

}
