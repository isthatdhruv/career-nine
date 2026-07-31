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
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * One contact person's administration of one {@link StudentGroup}. Many-to-many:
 * a group has many admins and a contact person administers many groups.
 *
 * <p>The deliberate mirror image of {@link StudentGroupMember} — same shape,
 * same {@code (group, target)} unique key, same bulk add/remove semantics. The
 * two differ only in which id column they carry, so one service helper drives
 * both.
 *
 * <p>There is no "primary" or "owner" admin: every contact person on a group is
 * equal. If a lead-admin distinction is ever needed, add a {@code role} column
 * here rather than a column back on {@code student_group}.
 *
 * <p>A group with no contact persons is a valid state (freshly created, or
 * between staff changes) — it simply grants nobody group-scoped access.
 */
@Entity
@Table(name = "student_group_contact")
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class StudentGroupContact implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_group_id", nullable = false)
    private StudentGroup studentGroup;

    @Column(name = "contact_person_id", nullable = false)
    private Long contactPersonId;

    @Column(name = "assigned_at", nullable = false, updatable = false)
    private LocalDateTime assignedAt;

    @Column(name = "assigned_by")
    private Long assignedBy;

    @PrePersist
    void onCreate() {
        if (assignedAt == null) {
            assignedAt = LocalDateTime.now();
        }
    }

    public StudentGroupContact() {
    }

    public StudentGroupContact(StudentGroup studentGroup, Long contactPersonId, Long assignedBy) {
        this.studentGroup = studentGroup;
        this.contactPersonId = contactPersonId;
        this.assignedBy = assignedBy;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public StudentGroup getStudentGroup() { return studentGroup; }
    public void setStudentGroup(StudentGroup studentGroup) { this.studentGroup = studentGroup; }

    public Long getContactPersonId() { return contactPersonId; }
    public void setContactPersonId(Long contactPersonId) { this.contactPersonId = contactPersonId; }

    public LocalDateTime getAssignedAt() { return assignedAt; }
    public void setAssignedAt(LocalDateTime assignedAt) { this.assignedAt = assignedAt; }

    public Long getAssignedBy() { return assignedBy; }
    public void setAssignedBy(Long assignedBy) { this.assignedBy = assignedBy; }
}
