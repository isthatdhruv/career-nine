package com.kccitm.api.model;

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
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnore;

/**
 * JPA entity for the {@code user_role_scope} table created in migration
 * V20260511007.
 *
 * <p>A scope grant is attached to a specific role-assignment (not to a user
 * globally). When an admin assigns a role to a user, they also pick the four
 * ABAC attribute values (institute, session, class, section) for that role
 * grant. A single user with two roles can hold different scopes per role —
 * e.g., Teacher at School A and Counsellor at School B.
 *
 * <p>NULL at any attribute means wildcard ("all of them within the parent").
 * The containment rule (section needs class, class needs session or institute,
 * session needs institute) is enforced by a DB CHECK constraint on MySQL 8+;
 * the service layer enforces it as defense-in-depth for MySQL 5.7.
 *
 * <p>See {@code docs/AUTH_REDESIGN_PLAN.md} §3.3 and §3.4.
 */
@Entity
@Table(name = "user_role_scope")
public class UserRoleScope implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * The role-assignment this scope grant is attached to. Removing the role
     * assignment cascades to its scope grants (ON DELETE CASCADE in the FK).
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_role_group_mapping_id", nullable = false)
    @JsonIgnore
    private UserRoleGroupMapping userRoleGroupMapping;

    /** Institute scope (FK to {@code institute_detail_new.institute_code}). NULL = wildcard. */
    @Column(name = "institute_id")
    private Integer instituteId;

    /** Session scope (FK to {@code institute_session.session_id}). NULL = wildcard. */
    @Column(name = "session_id")
    private Integer sessionId;

    /** Class scope (FK to {@code institute_courses.course_code}). NULL = wildcard. */
    @Column(name = "course_code")
    private Integer courseCode;

    /** Section scope (FK to {@code section.id}). NULL = wildcard. */
    @Column(name = "section_id")
    private Integer sectionId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "created_by")
    private Long createdBy;

    public UserRoleScope() { }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public UserRoleGroupMapping getUserRoleGroupMapping() { return userRoleGroupMapping; }
    public void setUserRoleGroupMapping(UserRoleGroupMapping userRoleGroupMapping) { this.userRoleGroupMapping = userRoleGroupMapping; }

    public Integer getInstituteId() { return instituteId; }
    public void setInstituteId(Integer instituteId) { this.instituteId = instituteId; }

    public Integer getSessionId() { return sessionId; }
    public void setSessionId(Integer sessionId) { this.sessionId = sessionId; }

    public Integer getCourseCode() { return courseCode; }
    public void setCourseCode(Integer courseCode) { this.courseCode = courseCode; }

    public Integer getSectionId() { return sectionId; }
    public void setSectionId(Integer sectionId) { this.sectionId = sectionId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }
}
