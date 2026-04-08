package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "payment_transaction")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class PaymentTransaction implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "transaction_id")
    private Long transactionId;

    @Column(name = "razorpay_link_id", length = 50)
    private String razorpayLinkId;

    @Column(name = "razorpay_payment_id", length = 50)
    private String razorpayPaymentId;

    @Column(name = "razorpay_order_id", length = 50)
    private String razorpayOrderId;

    @Column(name = "mapping_id", nullable = false)
    private Long mappingId;

    @Column(name = "amount", nullable = false)
    private Long amount;

    @Column(name = "currency", length = 10, columnDefinition = "varchar(10) default 'INR'")
    private String currency = "INR";

    @Column(name = "status", length = 20, columnDefinition = "varchar(20) default 'created'")
    private String status = "created";

    @Column(name = "payment_link_url", length = 500)
    private String paymentLinkUrl;

    @Column(name = "short_url", length = 500)
    private String shortUrl;

    @Column(name = "student_name", length = 200)
    private String studentName;

    @Column(name = "student_email", length = 200)
    private String studentEmail;

    @Column(name = "student_phone", length = 20)
    private String studentPhone;

    @Column(name = "student_dob")
    @Temporal(TemporalType.DATE)
    @JsonFormat(pattern = "dd-MM-yyyy")
    private Date studentDob;

    @Column(name = "user_student_id")
    private Long userStudentId;

    @Column(name = "assessment_id")
    private Long assessmentId;

    @Column(name = "institute_code")
    private Integer instituteCode;

    @Column(name = "failure_reason", length = 500)
    private String failureReason;

    @Column(name = "welcome_email_sent", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean welcomeEmailSent = false;

    @Column(name = "nudge_email_sent", columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean nudgeEmailSent = false;

    @Column(name = "created_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date createdAt;

    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    @JsonFormat(pattern = "dd-MM-yyyy HH:mm:ss")
    private Date updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) this.createdAt = new Date();
        if (this.updatedAt == null) this.updatedAt = new Date();
        if (this.status == null) this.status = "created";
        if (this.currency == null) this.currency = "INR";
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = new Date();
    }

    public Long getTransactionId() { return transactionId; }
    public void setTransactionId(Long transactionId) { this.transactionId = transactionId; }

    public String getRazorpayLinkId() { return razorpayLinkId; }
    public void setRazorpayLinkId(String razorpayLinkId) { this.razorpayLinkId = razorpayLinkId; }

    public String getRazorpayPaymentId() { return razorpayPaymentId; }
    public void setRazorpayPaymentId(String razorpayPaymentId) { this.razorpayPaymentId = razorpayPaymentId; }

    public String getRazorpayOrderId() { return razorpayOrderId; }
    public void setRazorpayOrderId(String razorpayOrderId) { this.razorpayOrderId = razorpayOrderId; }

    public Long getMappingId() { return mappingId; }
    public void setMappingId(Long mappingId) { this.mappingId = mappingId; }

    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPaymentLinkUrl() { return paymentLinkUrl; }
    public void setPaymentLinkUrl(String paymentLinkUrl) { this.paymentLinkUrl = paymentLinkUrl; }

    public String getShortUrl() { return shortUrl; }
    public void setShortUrl(String shortUrl) { this.shortUrl = shortUrl; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getStudentEmail() { return studentEmail; }
    public void setStudentEmail(String studentEmail) { this.studentEmail = studentEmail; }

    public String getStudentPhone() { return studentPhone; }
    public void setStudentPhone(String studentPhone) { this.studentPhone = studentPhone; }

    public Date getStudentDob() { return studentDob; }
    public void setStudentDob(Date studentDob) { this.studentDob = studentDob; }

    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public Integer getInstituteCode() { return instituteCode; }
    public void setInstituteCode(Integer instituteCode) { this.instituteCode = instituteCode; }

    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }

    public Boolean getWelcomeEmailSent() { return welcomeEmailSent; }
    public void setWelcomeEmailSent(Boolean welcomeEmailSent) { this.welcomeEmailSent = welcomeEmailSent; }

    public Boolean getNudgeEmailSent() { return nudgeEmailSent; }
    public void setNudgeEmailSent(Boolean nudgeEmailSent) { this.nudgeEmailSent = nudgeEmailSent; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }

    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }
}
