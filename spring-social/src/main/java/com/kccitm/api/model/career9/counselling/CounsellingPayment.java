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

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kccitm.api.model.career9.UserStudent;

/**
 * Tracks individual student payments for counselling (PAID track).
 * Created when a student pays for counselling through Razorpay.
 * A student with a paid + completed CounsellingPayment is on the PAID track.
 */
@Entity
@Table(name = "counselling_payment")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class CounsellingPayment implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "student_id", referencedColumnName = "user_student_id", nullable = false)
    private UserStudent student;

    @Column(name = "amount", nullable = false)
    private Long amount;

    @Column(name = "currency", length = 10, columnDefinition = "VARCHAR(10) DEFAULT 'INR'")
    private String currency = "INR";

    @Column(name = "status", nullable = false, columnDefinition = "VARCHAR(20) DEFAULT 'CREATED'")
    private String status = "CREATED";

    @Column(name = "razorpay_order_id", length = 50)
    private String razorpayOrderId;

    @Column(name = "razorpay_payment_id", length = 50)
    private String razorpayPaymentId;

    @Column(name = "razorpay_link_id", length = 50)
    private String razorpayLinkId;

    @Column(name = "payment_link_url", length = 500)
    private String paymentLinkUrl;

    @Column(name = "sessions_purchased", columnDefinition = "INT DEFAULT 1")
    private Integer sessionsPurchased = 1;

    @Column(name = "sessions_used", columnDefinition = "INT DEFAULT 0")
    private Integer sessionsUsed = 0;

    @Column(name = "refund_status", length = 20)
    private String refundStatus;

    @Column(name = "failure_reason", length = 500)
    private String failureReason;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (this.createdAt == null) this.createdAt = now;
        this.updatedAt = now;
        if (this.status == null) this.status = "CREATED";
        if (this.currency == null) this.currency = "INR";
        if (this.sessionsPurchased == null) this.sessionsPurchased = 1;
        if (this.sessionsUsed == null) this.sessionsUsed = 0;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public CounsellingPayment() {}

    // Getters and Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public UserStudent getStudent() { return student; }
    public void setStudent(UserStudent student) { this.student = student; }

    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getRazorpayOrderId() { return razorpayOrderId; }
    public void setRazorpayOrderId(String razorpayOrderId) { this.razorpayOrderId = razorpayOrderId; }

    public String getRazorpayPaymentId() { return razorpayPaymentId; }
    public void setRazorpayPaymentId(String razorpayPaymentId) { this.razorpayPaymentId = razorpayPaymentId; }

    public String getRazorpayLinkId() { return razorpayLinkId; }
    public void setRazorpayLinkId(String razorpayLinkId) { this.razorpayLinkId = razorpayLinkId; }

    public String getPaymentLinkUrl() { return paymentLinkUrl; }
    public void setPaymentLinkUrl(String paymentLinkUrl) { this.paymentLinkUrl = paymentLinkUrl; }

    public Integer getSessionsPurchased() { return sessionsPurchased; }
    public void setSessionsPurchased(Integer sessionsPurchased) { this.sessionsPurchased = sessionsPurchased; }

    public Integer getSessionsUsed() { return sessionsUsed; }
    public void setSessionsUsed(Integer sessionsUsed) { this.sessionsUsed = sessionsUsed; }

    public String getRefundStatus() { return refundStatus; }
    public void setRefundStatus(String refundStatus) { this.refundStatus = refundStatus; }

    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }

    public LocalDateTime getPaidAt() { return paidAt; }
    public void setPaidAt(LocalDateTime paidAt) { this.paidAt = paidAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
