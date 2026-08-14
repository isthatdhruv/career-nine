package com.kccitm.api.model.email;

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

/**
 * A standing recipient of an automatic notification: "whenever {@link #emailType} fires,
 * also mail this address".
 *
 * <p>Every other email in the system is addressed by the calling code. This is the one
 * place an address is <em>configured</em>, which is what lets an admin change who hears
 * about new leads without a redeploy.
 *
 * <p>{@link #leadType} and {@link #source} narrow when the row applies; null on either
 * means "any". They are deliberately plain strings rather than a foreign key — the
 * filters describe values carried on the triggering event, and a recipient list should
 * not stop working because an enum was renamed.
 */
@Entity
@Table(name = "email_notification_recipient")
public class EmailNotificationRecipient implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The {@link EmailType} key this recipient listens for. */
    @Column(name = "email_type", length = 60, nullable = false)
    private String emailType;

    @Column(name = "email", length = 320, nullable = false)
    private String email;

    /** Admin-facing label ("Sales desk"); never part of the message. */
    @Column(name = "label", length = 160)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(name = "recipient_kind", length = 10, nullable = false)
    private RecipientKind recipientKind = RecipientKind.TO;

    /** Null = every lead type. */
    @Column(name = "lead_type", length = 20)
    private String leadType;

    /** Null = every source. */
    @Column(name = "source", length = 100)
    private String source;

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
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = new Date();
    }

    /**
     * Whether this row should receive a notification about an event with these attributes.
     * A null filter on the row matches anything; comparison is case-insensitive because
     * the values arrive from a public form.
     */
    public boolean matches(String eventLeadType, String eventSource) {
        return matchesFilter(leadType, eventLeadType) && matchesFilter(source, eventSource);
    }

    private static boolean matchesFilter(String filter, String value) {
        if (filter == null || filter.trim().isEmpty()) {
            return true;
        }
        return value != null && filter.trim().equalsIgnoreCase(value.trim());
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getEmailType() { return emailType; }
    public void setEmailType(String emailType) { this.emailType = emailType; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public RecipientKind getRecipientKind() { return recipientKind; }
    public void setRecipientKind(RecipientKind recipientKind) { this.recipientKind = recipientKind; }
    public String getLeadType() { return leadType; }
    public void setLeadType(String leadType) { this.leadType = leadType; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }
    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long updatedBy) { this.updatedBy = updatedBy; }
}
