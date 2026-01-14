package com.kccitm.api.model.career9.school;

import java.io.Serializable;
import java.util.List;

import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Table;
import javax.persistence.CascadeType;

@Entity
@Table(name = "school_classes")
public class SchoolClasses implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private String className;

    @OneToMany(mappedBy = "schoolClasses", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    private List<SchoolSections> schoolSections;

    @ManyToOne
    @JoinColumn(name = "school_session_id", nullable = false)
    private SchoolSession schoolSession;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getClassName() {
        return className;
    }

    public void setClassName(String className) {
        this.className = className;
    }

    public List<SchoolSections> getSchoolSections() {
        return schoolSections;
    }

    public void setSchoolSections(List<SchoolSections> schoolSections) {
        this.schoolSections = schoolSections;
    }

}
