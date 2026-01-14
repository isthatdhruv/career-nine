package com.kccitm.api.model.career9.school;

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

import java.io.Serializable;
import java.util.Date;
import java.util.List;

@Entity
@Table(name = "school_session")
public class SchoolSession implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private String sessionYear;

    @OneToMany(mappedBy = "schoolSession", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    private List<SchoolClasses> schoolClasses;

    @ManyToOne
    @JoinColumn(name = "institute_id", nullable = false)
    private InstituteDetail institute;

    private Date startDate;

    private Date endDate;

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

    public Date getStartDate() {
        return startDate;
    }

    public void setStartDate(Date startDate) {
        this.startDate = startDate;
    }

    public Date getEndDate() {
        return endDate;
    }

    public void setEndDate(Date endDate) {
        this.endDate = endDate;
    }

    public List<SchoolClasses> getSchoolClasses() {
        return schoolClasses;
    }

    public void setSchoolClasses(List<SchoolClasses> schoolClasses) {
        this.schoolClasses = schoolClasses;
    }
}
