package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;

/**
 * The persistent class for the gender database table.
 * 
 */
@Entity
@Table(name = "gender")
// @NamedQuery(name = "Gender.findAll", query = "SELECT g FROM Gender g")
public class Gender implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private int id;

	private String type;

	public Gender() {
	}

	public Gender(int id, String type) {
		this.id = id;
		this.type = type;
	}

	public int getId() {
		return this.id;
	}

	public void setId(int id) {
		this.id = id;
	}

	public String getType() {
		return this.type;
	}

	public void setType(String type) {
		this.type = type;
	}

}