package com.kccitm.api.model.career9.report;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.UniqueConstraint;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "report_type",
    uniqueConstraints = @UniqueConstraint(name = "uk_report_type_code", columnNames = {"code"})
)
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class ReportType implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "report_type_id")
    private Long reportTypeId;

    @Column(name = "code", nullable = false, length = 50)
    private String code;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    public ReportType() {}

    public Long getReportTypeId() { return reportTypeId; }
    public void setReportTypeId(Long reportTypeId) { this.reportTypeId = reportTypeId; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
}
