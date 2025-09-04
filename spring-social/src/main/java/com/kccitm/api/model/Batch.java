package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.NamedQuery;
import javax.persistence.Table;


/**
 * The persistent class for the batch database table.
 * 
 */
@Entity
@Table(name="batch")
@NamedQuery(name="Batch.findAll", query="SELECT b FROM Batch b")
public class Batch implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	private int id;

	private String batch;

	public Batch() {
	}

	public int getId() {
		return this.id;
	}

	public void setId(int id) {
		this.id = id;
	}

	public String getBatch() {
		return this.batch;
	}

	public void setBatch(String batch) {
		this.batch = batch;
	}

}