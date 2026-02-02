package com.kccitm.api.model.career9.school;

import java.io.Serializable;
import java.util.List;

import javax.persistence.CascadeType;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Table;
import javax.persistence.Transient;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "school_session")
public class SchoolSession implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private String sessionYear;

    @OneToMany(mappedBy = "schoolSession", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SchoolClasses> schoolClasses;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnore
    @JoinColumn(name = "institute_id", referencedColumnName = "institute_code", nullable = false)
    private InstituteDetail institute;

    @Transient
    private Integer instituteCode;

    // Getters and Setters
    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getSessionYear() {
        return sessionYear;
    }

    public void setSessionYear(String sessionYear) {
        this.sessionYear = sessionYear;
    }

    public List<SchoolClasses> getSchoolClasses() {
        return schoolClasses;
    }

    public void setSchoolClasses(List<SchoolClasses> schoolClasses) {
        this.schoolClasses = schoolClasses;
    }

    public InstituteDetail getInstitute() {
        return institute;
    }

    public void setInstitute(InstituteDetail institute) {
        this.institute = institute;
    }

    // Helper method to get instituteCode (optional, for convenience)
    public Integer getInstituteCode() {
        if (instituteCode != null) {
            return instituteCode;
        }
        return institute != null ? institute.getInstituteCode() : null;
    }

    public void setInstituteCode(Integer instituteCode) {
        this.instituteCode = instituteCode;
    }
}
