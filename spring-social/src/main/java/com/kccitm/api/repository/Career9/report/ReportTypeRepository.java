package com.kccitm.api.repository.Career9.report;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.report.ReportType;

@Repository
public interface ReportTypeRepository extends JpaRepository<ReportType, Long> {

    Optional<ReportType> findByCode(String code);
}
