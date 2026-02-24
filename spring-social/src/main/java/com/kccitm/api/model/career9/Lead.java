package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.EnumType;
import javax.persistence.Enumerated;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "leads")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Lead implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "phone")
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(name = "lead_type", nullable = false, length = 20)
    private LeadType leadType;

    @Column(name = "source", length = 100)
    private String source;

    @Column(name = "extras", columnDefinition = "TEXT")
    private String extras;

    @Enumerated(EnumType.STRING)
    @Column(name = "odoo_sync_status", nullable = false, length = 20)
    private OdooSyncStatus odooSyncStatus;

    @Column(name = "odoo_lead_id")
    private Long odooLeadId;

    @Column(name = "odoo_sync_error", columnDefinition = "TEXT")
    private String odooSyncError;

    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) this.createdAt = new Date();
        if (this.odooSyncStatus == null) this.odooSyncStatus = OdooSyncStatus.PENDING;
        this.updatedAt = new Date();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = new Date();
    }

    public Lead() {
    }

    // Getters and Setters

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public LeadType getLeadType() {
        return leadType;
    }

    public void setLeadType(LeadType leadType) {
        this.leadType = leadType;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getExtras() {
        return extras;
    }

    public void setExtras(String extras) {
        this.extras = extras;
    }

    public OdooSyncStatus getOdooSyncStatus() {
        return odooSyncStatus;
    }

    public void setOdooSyncStatus(OdooSyncStatus odooSyncStatus) {
        this.odooSyncStatus = odooSyncStatus;
    }

    public Long getOdooLeadId() {
        return odooLeadId;
    }

    public void setOdooLeadId(Long odooLeadId) {
        this.odooLeadId = odooLeadId;
    }

    public String getOdooSyncError() {
        return odooSyncError;
    }

    public void setOdooSyncError(String odooSyncError) {
        this.odooSyncError = odooSyncError;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public Date getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Date updatedAt) {
        this.updatedAt = updatedAt;
    }
}
