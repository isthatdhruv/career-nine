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
 * One student's membership of one {@link StudentGroup}. Many-to-many: a group
 * holds many students and a student belongs to many groups.
 *
 * <p>{@code UNIQUE (student_group_id, user_student_id)} is what makes bulk add
 * idempotent — re-adding a student already in the group is a no-op rather than
 * a duplicate row.
 *
 * <p>The student is held as a raw {@code userStudentId} rather than a
 * {@code @ManyToOne UserStudent}: every read path here needs ids only (the ABAC
 * row filter, the idempotent-add diff, the reverse lookup), and mapping the
 * relation would drag {@code UserStudent} — which is itself scope-filtered —
 * into queries that only wanted a key. This matches how
 * {@code StudentAssessmentMapping} and {@code StudentContactAssignment} store
 * the same reference.
 */
@Entity
@Table(name = "student_group_member")
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class StudentGroupMember implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_group_id", nullable = false)
    private StudentGroup studentGroup;

    @Column(name = "user_student_id", nullable = false)
    private Long userStudentId;

    @Column(name = "added_at", nullable = false, updatable = false)
    private LocalDateTime addedAt;

    @Column(name = "added_by")
    private Long addedBy;

    @PrePersist
    void onCreate() {
        if (addedAt == null) {
            addedAt = LocalDateTime.now();
        }
    }

    public StudentGroupMember() {
    }

    public StudentGroupMember(StudentGroup studentGroup, Long userStudentId, Long addedBy) {
        this.studentGroup = studentGroup;
        this.userStudentId = userStudentId;
        this.addedBy = addedBy;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public StudentGroup getStudentGroup() { return studentGroup; }
    public void setStudentGroup(StudentGroup studentGroup) { this.studentGroup = studentGroup; }

    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }

    public LocalDateTime getAddedAt() { return addedAt; }
    public void setAddedAt(LocalDateTime addedAt) { this.addedAt = addedAt; }

    public Long getAddedBy() { return addedBy; }
    public void setAddedBy(Long addedBy) { this.addedBy = addedBy; }
}
