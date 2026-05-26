package com.kccitm.api.repository.Career9.report;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.report.ReportSubtype;

@Repository
public interface ReportSubtypeRepository extends JpaRepository<ReportSubtype, Long> {

    Optional<ReportSubtype> findByReportTypeCodeAndCode(String typeCode, String code);

    List<ReportSubtype> findByReportTypeReportTypeId(Long reportTypeId);

    List<ReportSubtype> findByReportTypeCode(String typeCode);
}
