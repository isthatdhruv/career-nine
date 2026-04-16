package com.kccitm.api.service.counselling;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.exception.BadRequestException;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellorInstituteMapping;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.Career9.counselling.CounsellorInstituteMappingRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import com.kccitm.api.repository.InstituteDetailRepository;

@Service
public class CounsellorInstituteMappingService {

    private static final Logger logger = LoggerFactory.getLogger(CounsellorInstituteMappingService.class);

    @Autowired
    private CounsellorInstituteMappingRepository mappingRepository;

    @Autowired
    private CounsellorRepository counsellorRepository;

    @Autowired
    private InstituteDetailRepository instituteDetailRepository;

    /**
     * Allocate a counsellor to an institute.
     * If mapping already exists but is inactive, reactivate it.
     */
    public CounsellorInstituteMapping allocate(Long counsellorId, Integer instituteCode, Long assignedBy, String notes) {
        Counsellor counsellor = counsellorRepository.findById(counsellorId)
                .orElseThrow(() -> new ResourceNotFoundException("Counsellor", "id", counsellorId));

        InstituteDetail institute = instituteDetailRepository.findById(instituteCode)
                .orElseThrow(() -> new ResourceNotFoundException("Institute", "code", instituteCode));

        // Check if counsellor is already active in ANY institute
        List<CounsellorInstituteMapping> activeForCounsellor =
                mappingRepository.findByCounsellorIdAndIsActiveTrue(counsellorId);

        if (!activeForCounsellor.isEmpty()) {
            String currentInstitute = activeForCounsellor.get(0).getInstitute().getInstituteName();
            throw new BadRequestException(
                    "Counsellor is currently allocated to \"" + currentInstitute
                    + "\". Remove them from that institute first before allocating to a new one.");
        }

        // Check if this exact mapping already exists (inactive — reactivate it)
        Optional<CounsellorInstituteMapping> existing =
                mappingRepository.findByCounsellorIdAndInstituteInstituteCode(counsellorId, instituteCode);

        if (existing.isPresent()) {
            CounsellorInstituteMapping mapping = existing.get();
            mapping.setIsActive(true);
            mapping.setAssignedBy(assignedBy);
            if (notes != null) mapping.setNotes(notes);
            logger.info("Reactivated counsellor {} allocation to institute {}", counsellorId, instituteCode);
            return mappingRepository.save(mapping);
        }

        CounsellorInstituteMapping mapping = new CounsellorInstituteMapping();
        mapping.setCounsellor(counsellor);
        mapping.setInstitute(institute);
        mapping.setAssignedBy(assignedBy);
        mapping.setNotes(notes);

        logger.info("Allocated counsellor {} to institute {}", counsellorId, instituteCode);
        return mappingRepository.save(mapping);
    }

    /**
     * Deallocate (soft-delete) a counsellor from an institute.
     */
    public CounsellorInstituteMapping deallocate(Long mappingId) {
        CounsellorInstituteMapping mapping = mappingRepository.findById(mappingId)
                .orElseThrow(() -> new ResourceNotFoundException("CounsellorInstituteMapping", "id", mappingId));

        mapping.setIsActive(false);
        logger.info("Deallocated mapping {} (counsellor {} from institute {})",
                mappingId, mapping.getCounsellor().getId(), mapping.getInstitute().getInstituteCode());
        return mappingRepository.save(mapping);
    }

    /**
     * Get all active counsellors allocated to an institute.
     */
    public List<CounsellorInstituteMapping> getCounsellorsForInstitute(Integer instituteCode) {
        return mappingRepository.findByInstituteInstituteCodeAndIsActiveTrue(instituteCode);
    }

    /**
     * Get all institutes a counsellor is allocated to.
     */
    public List<CounsellorInstituteMapping> getInstitutesForCounsellor(Long counsellorId) {
        return mappingRepository.findByCounsellorIdAndIsActiveTrue(counsellorId);
    }

    /**
     * Get all mappings (for admin overview).
     */
    public List<CounsellorInstituteMapping> getAll() {
        return mappingRepository.findAll();
    }

    /**
     * Get the list of active counsellor IDs for an institute.
     * Used by the booking flow to find available slots.
     */
    public List<Long> getActiveCounsellorIdsForInstitute(Integer instituteCode) {
        return mappingRepository.findByInstituteInstituteCodeAndIsActiveTrue(instituteCode)
                .stream()
                .filter(m -> Boolean.TRUE.equals(m.getCounsellor().getIsActive()))
                .map(m -> m.getCounsellor().getId())
                .collect(Collectors.toList());
    }
}
