package com.kccitm.api.model.career9.counselling;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

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
import javax.persistence.Version;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name = "counselling_slot")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class CounsellingSlot implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "counsellor_id", nullable = false)
    private Counsellor counsellor;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "template_id", nullable = true)
    private AvailabilityTemplate template;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes;

    @Column(name = "status", nullable = false, columnDefinition = "VARCHAR(20) DEFAULT 'AVAILABLE'")
    private String status = "AVAILABLE";

    @JsonProperty("isManuallyCreated")
    @Column(name = "is_manually_created", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean isManuallyCreated = false;

    @JsonProperty("isBlocked")
    @Column(name = "is_blocked", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean isBlocked = false;

    @Column(name = "block_reason")
    private String blockReason;

    @Version
    private Integer version;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) this.createdAt = LocalDateTime.now();
        if (this.status == null) this.status = "AVAILABLE";
        if (this.isManuallyCreated == null) this.isManuallyCreated = false;
        if (this.isBlocked == null) this.isBlocked = false;
    }

    public CounsellingSlot() {
    }

    // Getters and Setters

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Counsellor getCounsellor() {
        return counsellor;
    }

    public void setCounsellor(Counsellor counsellor) {
        this.counsellor = counsellor;
    }

    public AvailabilityTemplate getTemplate() {
        return template;
    }

    public void setTemplate(AvailabilityTemplate template) {
        this.template = template;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalTime endTime) {
        this.endTime = endTime;
    }

    public Integer getDurationMinutes() {
        return durationMinutes;
    }

    public void setDurationMinutes(Integer durationMinutes) {
        this.durationMinutes = durationMinutes;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    @JsonProperty("isManuallyCreated")
    public Boolean getIsManuallyCreated() {
        return isManuallyCreated;
    }

    @JsonProperty("isManuallyCreated")
    public void setIsManuallyCreated(Boolean isManuallyCreated) {
        this.isManuallyCreated = isManuallyCreated;
    }

    @JsonProperty("isBlocked")
    public Boolean getIsBlocked() {
        return isBlocked;
    }

    @JsonProperty("isBlocked")
    public void setIsBlocked(Boolean isBlocked) {
        this.isBlocked = isBlocked;
    }

    public String getBlockReason() {
        return blockReason;
    }

    public void setBlockReason(String blockReason) {
        this.blockReason = blockReason;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
