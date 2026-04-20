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
import com.fasterxml.jackson.annotation.JsonProperty;
import com.kccitm.api.model.User;

@Entity
@Table(name = "counsellors")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Counsellor implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", referencedColumnName = "id")
    private User user;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "specializations", columnDefinition = "TEXT")
    private String specializations;

    @Column(name = "bio", columnDefinition = "TEXT")
    private String bio;

    @JsonProperty("isExternal")
    @Column(name = "is_external", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean isExternal = false;

    @Column(name = "onboarding_status", length = 20)
    private String onboardingStatus = "PENDING";

    @JsonProperty("isActive")
    @Column(name = "is_active", columnDefinition = "BOOLEAN DEFAULT TRUE")
    private Boolean isActive = true;

    @Column(name = "profile_image_url", length = 500)
    private String profileImageUrl;

    // ── Onboarding fields ──

    @Column(name = "languages_spoken", length = 500)
    private String languagesSpoken;

    @Column(name = "mode_capability", length = 20, columnDefinition = "VARCHAR(20) DEFAULT 'BOTH'")
    private String modeCapability = "BOTH";

    @Column(name = "qualifications", columnDefinition = "TEXT")
    private String qualifications;

    @Column(name = "certifications_url", length = 500)
    private String certificationsUrl;

    @Column(name = "govt_id_last4", length = 4)
    private String govtIdLast4;

    @Column(name = "govt_id_hash", length = 255)
    private String govtIdHash;

    @Column(name = "bank_name", length = 200)
    private String bankName;

    @Column(name = "bank_account", length = 50)
    private String bankAccount;

    @Column(name = "bank_ifsc", length = 20)
    private String bankIfsc;

    @Column(name = "bank_branch", length = 200)
    private String bankBranch;

    @Column(name = "signed_agreement_url", length = 500)
    private String signedAgreementUrl;

    @Column(name = "years_of_experience")
    private Integer yearsOfExperience;

    @Column(name = "linkedin_profile", length = 500)
    private String linkedinProfile;

    @Column(name = "hourly_rate_preference")
    private Integer hourlyRatePreference;

    @Column(name = "max_sessions_per_day")
    private Integer maxSessionsPerDay;

    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (this.createdAt == null) this.createdAt = now;
        this.updatedAt = now;
        if (this.onboardingStatus == null) this.onboardingStatus = "PENDING";
        if (this.isExternal == null) this.isExternal = false;
        if (this.isActive == null) this.isActive = true;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Counsellor() {
    }

    // Getters and Setters

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
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

    public String getSpecializations() {
        return specializations;
    }

    public void setSpecializations(String specializations) {
        this.specializations = specializations;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    @JsonProperty("isExternal")
    public Boolean getIsExternal() {
        return isExternal;
    }

    @JsonProperty("isExternal")
    public void setIsExternal(Boolean isExternal) {
        this.isExternal = isExternal;
    }

    public String getOnboardingStatus() {
        return onboardingStatus;
    }

    public void setOnboardingStatus(String onboardingStatus) {
        this.onboardingStatus = onboardingStatus;
    }

    @JsonProperty("isActive")
    public Boolean getIsActive() {
        return isActive;
    }

    @JsonProperty("isActive")
    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public String getProfileImageUrl() {
        return profileImageUrl;
    }

    public void setProfileImageUrl(String profileImageUrl) {
        this.profileImageUrl = profileImageUrl;
    }

    public String getLanguagesSpoken() { return languagesSpoken; }
    public void setLanguagesSpoken(String languagesSpoken) { this.languagesSpoken = languagesSpoken; }

    public String getModeCapability() { return modeCapability; }
    public void setModeCapability(String modeCapability) { this.modeCapability = modeCapability; }

    public String getQualifications() { return qualifications; }
    public void setQualifications(String qualifications) { this.qualifications = qualifications; }

    public String getCertificationsUrl() { return certificationsUrl; }
    public void setCertificationsUrl(String certificationsUrl) { this.certificationsUrl = certificationsUrl; }

    public String getGovtIdLast4() { return govtIdLast4; }
    public void setGovtIdLast4(String govtIdLast4) { this.govtIdLast4 = govtIdLast4; }

    public String getGovtIdHash() { return govtIdHash; }
    public void setGovtIdHash(String govtIdHash) { this.govtIdHash = govtIdHash; }

    public String getBankName() { return bankName; }
    public void setBankName(String bankName) { this.bankName = bankName; }

    public String getBankAccount() { return bankAccount; }
    public void setBankAccount(String bankAccount) { this.bankAccount = bankAccount; }

    public String getBankIfsc() { return bankIfsc; }
    public void setBankIfsc(String bankIfsc) { this.bankIfsc = bankIfsc; }

    public String getBankBranch() { return bankBranch; }
    public void setBankBranch(String bankBranch) { this.bankBranch = bankBranch; }

    public String getSignedAgreementUrl() { return signedAgreementUrl; }
    public void setSignedAgreementUrl(String signedAgreementUrl) { this.signedAgreementUrl = signedAgreementUrl; }

    public Integer getYearsOfExperience() { return yearsOfExperience; }
    public void setYearsOfExperience(Integer yearsOfExperience) { this.yearsOfExperience = yearsOfExperience; }

    public String getLinkedinProfile() { return linkedinProfile; }
    public void setLinkedinProfile(String linkedinProfile) { this.linkedinProfile = linkedinProfile; }

    public Integer getHourlyRatePreference() { return hourlyRatePreference; }
    public void setHourlyRatePreference(Integer hourlyRatePreference) { this.hourlyRatePreference = hourlyRatePreference; }

    public Integer getMaxSessionsPerDay() { return maxSessionsPerDay; }
    public void setMaxSessionsPerDay(Integer maxSessionsPerDay) { this.maxSessionsPerDay = maxSessionsPerDay; }

    @com.fasterxml.jackson.annotation.JsonIgnore
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

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
