package com.kccitm.api.model;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.JoinTable;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Table;

@Entity
@Table(name = "CodingProblemDiffcultyCodingProblemMapping")
public class CodingProblemDiffcultyCodingProblemMapping {
    @Id
	@Column(name = "id")
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private int id;

    @ManyToOne
    private CodingProblemDifficulty difficultyLevel;
    
    @ManyToOne
    private CodingPlatformProblem codingPlateformProblem;

public CodingPlatformProblem getCodingPlateformProblem() {
    return codingPlateformProblem;
}

public CodingProblemDifficulty getDifficultyLevel() {
    return difficultyLevel;
}
public int getId() {
    return id;
}

public void setCodingPlateformProblem(CodingPlatformProblem codingPlateformProblem) {
    this.codingPlateformProblem = codingPlateformProblem;
}

public void setDifficultyLevel(CodingProblemDifficulty difficultyLevel) {
    this.difficultyLevel = difficultyLevel;
}

public void setId(int id) {
    this.id = id;
}


    
}
