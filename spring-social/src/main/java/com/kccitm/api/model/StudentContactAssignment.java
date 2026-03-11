package com.kccitm.api.model;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

@Entity
@Table(name = "student_contact_assignment")
public class StudentContactAssignment implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_student_id", nullable = false)
    private Long userStudentId;

    @Column(name = "contact_person_id", nullable = false)
    private Long contactPersonId;

    @Column(name = "institute_id")
    private Integer instituteId;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "assigned_at")
    private Date assignedAt;

    public StudentContactAssignment() {}

    public StudentContactAssignment(Long userStudentId, Long contactPersonId, Integer instituteId) {
        this.userStudentId = userStudentId;
        this.contactPersonId = contactPersonId;
        this.instituteId = instituteId;
        this.assignedAt = new Date();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }

    public Long getContactPersonId() { return contactPersonId; }
    public void setContactPersonId(Long contactPersonId) { this.contactPersonId = contactPersonId; }

    public Integer getInstituteId() { return instituteId; }
    public void setInstituteId(Integer instituteId) { this.instituteId = instituteId; }

    public Date getAssignedAt() { return assignedAt; }
    public void setAssignedAt(Date assignedAt) { this.assignedAt = assignedAt; }
}
