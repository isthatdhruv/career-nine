package com.kccitm.api.service.counselling;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.exception.DuplicateResourceException;
import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.StudentCounsellorMapping;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import com.kccitm.api.repository.Career9.counselling.StudentCounsellorMappingRepository;

@Service
public class StudentCounsellorMappingService {

    private static final Logger logger = LoggerFactory.getLogger(StudentCounsellorMappingService.class);

    @Autowired
    private StudentCounsellorMappingRepository mappingRepository;

    @Autowired
    private CounsellorRepository counsellorRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private UserRepository userRepository;

    public StudentCounsellorMapping assignStudentToCounsellor(Long studentId, Long counsellorId, Long adminUserId, String notes) {
        logger.info("Assigning student {} to counsellor {} by admin {}", studentId, counsellorId, adminUserId);

        Optional<StudentCounsellorMapping> existing = mappingRepository.findByCounsellorIdAndStudentUserStudentId(counsellorId, studentId);

        if (existing.isPresent()) {
            StudentCounsellorMapping mapping = existing.get();
            if (Boolean.TRUE.equals(mapping.getIsActive())) {
                throw new DuplicateResourceException("Student " + studentId + " is already assigned to counsellor " + counsellorId);
            }
            // Reactivate inactive mapping
            logger.info("Reactivating existing mapping for student {} and counsellor {}", studentId, counsellorId);
            mapping.setIsActive(true);
            if (notes != null) {
                mapping.setNotes(notes);
            }
            if (adminUserId != null) {
                userRepository.findById(adminUserId).ifPresent(mapping::setAssignedBy);
            }
            return mappingRepository.save(mapping);
        }

        // Create new mapping
        UserStudent student = userStudentRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student", "id", studentId));

        Counsellor counsellor = counsellorRepository.findById(counsellorId)
                .orElseThrow(() -> new ResourceNotFoundException("Counsellor", "id", counsellorId));

        StudentCounsellorMapping mapping = new StudentCounsellorMapping();
        mapping.setStudent(student);
        mapping.setCounsellor(counsellor);
        mapping.setNotes(notes);
        mapping.setIsActive(true);

        if (adminUserId != null) {
            userRepository.findById(adminUserId).ifPresent(mapping::setAssignedBy);
        }

        logger.info("Created new mapping for student {} and counsellor {}", studentId, counsellorId);
        return mappingRepository.save(mapping);
    }

    public List<StudentCounsellorMapping> getStudentsForCounsellor(Long counsellorId) {
        logger.debug("Fetching students for counsellor {}", counsellorId);
        return mappingRepository.findByCounsellorIdAndIsActiveTrue(counsellorId);
    }

    public List<StudentCounsellorMapping> getCounsellorsForStudent(Long studentId) {
        logger.debug("Fetching counsellors for student {}", studentId);
        return mappingRepository.findByStudentUserStudentIdAndIsActiveTrue(studentId);
    }

    public List<StudentCounsellorMapping> getAllActiveMappings() {
        logger.debug("Fetching all active mappings");
        return mappingRepository.findByIsActiveTrue();
    }

    public void deactivateMapping(Long mappingId) {
        logger.info("Deactivating mapping with id {}", mappingId);
        StudentCounsellorMapping mapping = mappingRepository.findById(mappingId)
                .orElseThrow(() -> new ResourceNotFoundException("StudentCounsellorMapping", "id", mappingId));
        mapping.setIsActive(false);
        mappingRepository.save(mapping);
    }

    public List<StudentCounsellorMapping> bulkAssign(Long counsellorId, List<Long> studentIds, Long adminUserId) {
        logger.info("Bulk assigning {} students to counsellor {} by admin {}", studentIds.size(), counsellorId, adminUserId);
        List<StudentCounsellorMapping> results = new ArrayList<>();
        for (Long studentId : studentIds) {
            try {
                StudentCounsellorMapping mapping = assignStudentToCounsellor(studentId, counsellorId, adminUserId, null);
                results.add(mapping);
            } catch (RuntimeException e) {
                logger.warn("Skipping student {} during bulk assign: {}", studentId, e.getMessage());
            }
        }
        return results;
    }
}
