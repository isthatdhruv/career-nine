package com.kccitm.api.repository.Career9.counselling;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.counselling.CounsellorInstituteMapping;

@Repository
public interface CounsellorInstituteMappingRepository extends JpaRepository<CounsellorInstituteMapping, Long> {

    /** All mappings for a given institute (active or not) */
    List<CounsellorInstituteMapping> findByInstituteInstituteCode(Integer instituteCode);

    /** Only active counsellors allocated to an institute */
    List<CounsellorInstituteMapping> findByInstituteInstituteCodeAndIsActiveTrue(Integer instituteCode);

    /** All institutes a counsellor is mapped to */
    List<CounsellorInstituteMapping> findByCounsellorId(Long counsellorId);

    /** Active institutes for a counsellor */
    List<CounsellorInstituteMapping> findByCounsellorIdAndIsActiveTrue(Long counsellorId);

    /** Check if a specific mapping already exists */
    Optional<CounsellorInstituteMapping> findByCounsellorIdAndInstituteInstituteCode(
            Long counsellorId, Integer instituteCode);
}
