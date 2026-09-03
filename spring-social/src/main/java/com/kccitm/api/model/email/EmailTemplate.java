package com.kccitm.api.model.email;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;

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

/**
 * A reusable email body + subject for a send-scenario ({@link #emailType}), with
 * {{placeholders}} filled per send. Multiple templates may exist per type; exactly one is the
 * default used for automatic sends (manual sends may pick another). {@link #deliveryMode}
 * lets each template choose SYNC (blocking, surfaced errors) or ASYNC (fire-and-forget).
 *
 * <p>Catalogue fields (Phase 1 of the mail automation work): {@link #mailKey} identifies the
 * specific mail within a type (a type such as COUNSELLING_NOTIFICATION covers many),
 * {@link #seedOrigin} / {@link #sourceRef} say where the copy came from, {@link #seededHash}
 * lets the dashboard tell "untouched since seeding" from "edited", {@link #portState} says
 * whether the sender actually renders this template yet, and the review fields hold the
 * admin's verdict.
 */
@Entity
@Table(name = "email_template")
public class EmailTemplate implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", length = 160, nullable = false)
    private String name;

    /** The {@link EmailType} key this template serves; constrains the placeholder palette. */
    @Column(name = "email_type", length = 60, nullable = false)
    private String emailType;

    /** Fine-grained identity, {@code category.mail}, e.g. {@code payment.success}. */
    @Column(name = "mail_key", length = 80)
    private String mailKey;

    @Column(name = "subject_template", length = 500)
    private String subjectTemplate;

    @Column(name = "body_template", columnDefinition = "MEDIUMTEXT")
    private String bodyTemplate;

    /** Plain-text alternative; null when the mail has none yet. */
    @Column(name = "text_template", columnDefinition = "MEDIUMTEXT")
    private String textTemplate;

    @Enumerated(EnumType.STRING)
    @Column(name = "mail_class", length = 20)
    private MailClass mailClass;

    @Enumerated(EnumType.STRING)
    @Column(name = "seed_origin", length = 20)
    private SeedOrigin seedOrigin;

    /** {@code Class#method (path:lines)} the copy was lifted from; null for admin-written. */
    @Column(name = "source_ref", length = 300)
    private String sourceRef;

    /** SHA-256 of subject, body and text at seed time; compared against current content. */
    @Column(name = "seeded_hash", length = 64)
    private String seededHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "port_state", length = 20, nullable = false)
    private PortState portState = PortState.PORTED;

    /** Comma-separated {@code {{#flag}}} names the body branches on, for preview toggles. */
    @Column(name = "variant_flags", length = 300)
    private String variantFlags;

    @Enumerated(EnumType.STRING)
    @Column(name = "review_status", length = 20, nullable = false)
    private ReviewStatus reviewStatus = ReviewStatus.NOT_REVIEWED;

    @Column(name = "review_notes", columnDefinition = "TEXT")
    private String reviewNotes;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "reviewed_at")
    private Date reviewedAt;

    @Column(name = "is_default", nullable = false)
    private Boolean isDefault = Boolean.FALSE;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_mode", length = 10, nullable = false)
    private EmailDeliveryMode deliveryMode = EmailDeliveryMode.ASYNC;

    @Column(name = "active", nullable = false)
    private Boolean active = Boolean.TRUE;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", nullable = false)
    private Date createdAt;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "updated_at", nullable = false)
    private Date updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;

    @PrePersist
    public void prePersist() {
        Date now = new Date();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
        if (portState == null) {
            portState = PortState.PORTED;
        }
        if (reviewStatus == null) {
            reviewStatus = ReviewStatus.NOT_REVIEWED;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = new Date();
    }

    /** {@link #variantFlags} as a list; empty when none. */
    public List<String> variantFlagList() {
        if (variantFlags == null || variantFlags.trim().isEmpty()) {
            return Collections.emptyList();
        }
        List<String> out = new ArrayList<>();
        for (String s : variantFlags.split(",")) {
            String t = s.trim();
            if (!t.isEmpty()) {
                out.add(t);
            }
        }
        return out;
    }

    public void setVariantFlagList(List<String> flags) {
        if (flags == null || flags.isEmpty()) {
            this.variantFlags = null;
            return;
        }
        StringBuilder sb = new StringBuilder();
        for (String f : flags) {
            if (f == null || f.trim().isEmpty()) continue;
            if (sb.length() > 0) sb.append(',');
            sb.append(f.trim());
        }
        this.variantFlags = sb.length() == 0 ? null : sb.toString();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmailType() { return emailType; }
    public void setEmailType(String emailType) { this.emailType = emailType; }
    public String getMailKey() { return mailKey; }
    public void setMailKey(String mailKey) { this.mailKey = mailKey; }
    public String getSubjectTemplate() { return subjectTemplate; }
    public void setSubjectTemplate(String subjectTemplate) { this.subjectTemplate = subjectTemplate; }
    public String getBodyTemplate() { return bodyTemplate; }
    public void setBodyTemplate(String bodyTemplate) { this.bodyTemplate = bodyTemplate; }
    public String getTextTemplate() { return textTemplate; }
    public void setTextTemplate(String textTemplate) { this.textTemplate = textTemplate; }
    public MailClass getMailClass() { return mailClass; }
    public void setMailClass(MailClass mailClass) { this.mailClass = mailClass; }
    public SeedOrigin getSeedOrigin() { return seedOrigin; }
    public void setSeedOrigin(SeedOrigin seedOrigin) { this.seedOrigin = seedOrigin; }
    public String getSourceRef() { return sourceRef; }
    public void setSourceRef(String sourceRef) { this.sourceRef = sourceRef; }
    public String getSeededHash() { return seededHash; }
    public void setSeededHash(String seededHash) { this.seededHash = seededHash; }
    public PortState getPortState() { return portState; }
    public void setPortState(PortState portState) { this.portState = portState; }
    public String getVariantFlags() { return variantFlags; }
    public void setVariantFlags(String variantFlags) { this.variantFlags = variantFlags; }
    public ReviewStatus getReviewStatus() { return reviewStatus; }
    public void setReviewStatus(ReviewStatus reviewStatus) { this.reviewStatus = reviewStatus; }
    public String getReviewNotes() { return reviewNotes; }
    public void setReviewNotes(String reviewNotes) { this.reviewNotes = reviewNotes; }
    public Long getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(Long reviewedBy) { this.reviewedBy = reviewedBy; }
    public Date getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Date reviewedAt) { this.reviewedAt = reviewedAt; }
    public Boolean getIsDefault() { return isDefault; }
    public void setIsDefault(Boolean isDefault) { this.isDefault = isDefault; }
    public EmailDeliveryMode getDeliveryMode() { return deliveryMode; }
    public void setDeliveryMode(EmailDeliveryMode deliveryMode) { this.deliveryMode = deliveryMode; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }
    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long updatedBy) { this.updatedBy = updatedBy; }
}
