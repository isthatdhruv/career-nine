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
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Logs all counsellor-related activities for admin visibility.
 * Types: COUNSELLOR_REGISTERED, BLOCK_DATE_REQUESTED, BLOCK_DATE_APPROVED,
 *        BLOCK_DATE_REJECTED, SLOT_BOOKED, APPOINTMENT_CONFIRMED,
 *        APPOINTMENT_CANCELLED, COUNSELLOR_ACTIVATED, COUNSELLOR_SUSPENDED, etc.
 */
@Entity
@Table(name = "counselling_activity_log")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class CounsellingActivityLog implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "activity_type", nullable = false, length = 50)
    private String activityType;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "counsellor_id")
    private Counsellor counsellor;

    @Column(name = "actor_name")
    private String actorName;

    @Column(name = "is_read", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean isRead = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) this.createdAt = LocalDateTime.now();
        if (this.isRead == null) this.isRead = false;
    }

    public CounsellingActivityLog() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getActivityType() { return activityType; }
    public void setActivityType(String activityType) { this.activityType = activityType; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Counsellor getCounsellor() { return counsellor; }
    public void setCounsellor(Counsellor counsellor) { this.counsellor = counsellor; }

    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }

    public Boolean getIsRead() { return isRead; }
    public void setIsRead(Boolean isRead) { this.isRead = isRead; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
