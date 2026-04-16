package com.kccitm.api.model.career9.counselling;

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
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.kccitm.api.model.career9.school.InstituteDetail;

/**
 * Maps counsellors to institutes (many-to-many).
 * A counsellor can serve multiple institutes.
 * An institute can have multiple counsellors.
 * Admin creates/manages these mappings.
 */
@Entity
@Table(name = "counsellor_institute_mapping",
       uniqueConstraints = @UniqueConstraint(columnNames = {"counsellor_id", "institute_code"}))
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class CounsellorInstituteMapping implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "counsellor_id", nullable = false)
    private Counsellor counsellor;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "institute_code", referencedColumnName = "institute_code", nullable = false)
    private InstituteDetail institute;

    @JsonProperty("isActive")
    @Column(name = "is_active", columnDefinition = "BOOLEAN DEFAULT TRUE")
    private Boolean isActive = true;

    @Column(name = "assigned_by")
    private Long assignedBy;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (this.createdAt == null) this.createdAt = now;
        this.updatedAt = now;
        if (this.isActive == null) this.isActive = true;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public CounsellorInstituteMapping() {}

    // Getters and Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Counsellor getCounsellor() { return counsellor; }
    public void setCounsellor(Counsellor counsellor) { this.counsellor = counsellor; }

    public InstituteDetail getInstitute() { return institute; }
    public void setInstitute(InstituteDetail institute) { this.institute = institute; }

    @JsonProperty("isActive")
    public Boolean getIsActive() { return isActive; }

    @JsonProperty("isActive")
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public Long getAssignedBy() { return assignedBy; }
    public void setAssignedBy(Long assignedBy) { this.assignedBy = assignedBy; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
