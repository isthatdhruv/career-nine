package com.kccitm.api.model.career9.group;

import java.io.Serializable;
import java.time.LocalDateTime;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kccitm.api.model.career9.school.InstituteDetail;

/**
 * A named group of hand-picked students inside one institute.
 *
 * <p>Deliberately <strong>independent of session, class and section</strong> —
 * there is no FK to any of them and membership is never derived from them, so a
 * group may freely mix Class 6 and Class 12 students. Do not add a section or
 * class filter here; the whole point is a grouping that cuts across the
 * structural hierarchy.
 *
 * <p>Both attachments are many-to-many and live in their own tables:
 * {@link StudentGroupMember} for students and {@link StudentGroupContact} for
 * the contact persons who administer the group. Neither is mapped as a
 * collection here — a group can hold hundreds of students, so listing groups
 * would N+1 into whole cohorts. Read them through their repositories.
 *
 * @see com.kccitm.api.service.schoolgroup.StudentGroupService
 */
@Entity
@Table(name = "student_group")
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class StudentGroup implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Owning institute. Joined on {@code institute_code} — the institute key
     * used everywhere in this codebase — mirroring {@code UserStudent.institute}.
     */
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "institute_code", referencedColumnName = "institute_code", nullable = false)
    private InstituteDetail institute;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    /** Soft-delete flag. Groups get referenced by scope grants; hard deletes orphan them. */
    @Column(name = "active", nullable = false)
    private Boolean active = Boolean.TRUE;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (active == null) {
            active = Boolean.TRUE;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public StudentGroup() {
    }

    public StudentGroup(InstituteDetail institute, String name, String description, Long createdBy) {
        this.institute = institute;
        this.name = name;
        this.description = description;
        this.createdBy = createdBy;
        this.active = Boolean.TRUE;
    }

    /** Convenience for the many call sites that only need the institute key. */
    public Integer getInstituteCode() {
        return institute == null ? null : institute.getInstituteCode();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public InstituteDetail getInstitute() { return institute; }
    public void setInstitute(InstituteDetail institute) { this.institute = institute; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long updatedBy) { this.updatedBy = updatedBy; }
}
