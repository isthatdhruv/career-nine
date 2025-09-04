package com.kccitm.api.model;

import java.io.Serializable;
import javax.persistence.*;


/**
 * The persistent class for the board_name database table.
 * 
 */
@Entity
@Table(name="board_name")
@NamedQuery(name="BoardName.findAll", query="SELECT b FROM BoardName b")
public class BoardName implements Serializable {
	private static final long serialVersionUID = 1L;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private int id;

	private Boolean display;

	private String name;

	private Boolean permanent;

	public BoardName() {
	}

	public BoardName(String board) {
		this.name = board;
		this.permanent = false;
		this.display = true;
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

	public Boolean getPermanent() {
		return permanent;
	}
	public void setPermanent(Boolean permanent) {
		this.permanent = permanent;
	}


}