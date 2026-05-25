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
import javax.persistence.OneToOne;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "session_notes")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class SessionNotes implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "appointment_id", nullable = false)
    private CounsellingAppointment appointment;

    @Column(name = "key_discussion_points", columnDefinition = "TEXT")
    private String keyDiscussionPoints;

    @Column(name = "action_items", columnDefinition = "TEXT")
    private String actionItems;

    @Column(name = "recommended_next_session")
    private String recommendedNextSession;

    @Column(name = "followup_required", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean followupRequired = false;

    @Column(name = "public_remarks", columnDefinition = "TEXT")
    private String publicRemarks;

    @Column(name = "private_notes", columnDefinition = "TEXT")
    private String privateNotes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (this.createdAt == null) this.createdAt = now;
        this.updatedAt = now;
        if (this.followupRequired == null) this.followupRequired = false;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public SessionNotes() {
    }

    // Getters and Setters

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public CounsellingAppointment getAppointment() {
        return appointment;
    }

    public void setAppointment(CounsellingAppointment appointment) {
        this.appointment = appointment;
    }

    public String getKeyDiscussionPoints() {
        return keyDiscussionPoints;
    }

    public void setKeyDiscussionPoints(String keyDiscussionPoints) {
        this.keyDiscussionPoints = keyDiscussionPoints;
    }

    public String getActionItems() {
        return actionItems;
    }

    public void setActionItems(String actionItems) {
        this.actionItems = actionItems;
    }

    public String getRecommendedNextSession() {
        return recommendedNextSession;
    }

    public void setRecommendedNextSession(String recommendedNextSession) {
        this.recommendedNextSession = recommendedNextSession;
    }

    public Boolean getFollowupRequired() {
        return followupRequired;
    }

    public void setFollowupRequired(Boolean followupRequired) {
        this.followupRequired = followupRequired;
    }

    public String getPublicRemarks() {
        return publicRemarks;
    }

    public void setPublicRemarks(String publicRemarks) {
        this.publicRemarks = publicRemarks;
    }

    public String getPrivateNotes() {
        return privateNotes;
    }

    public void setPrivateNotes(String privateNotes) {
        this.privateNotes = privateNotes;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
