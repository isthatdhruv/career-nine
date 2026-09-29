package com.kccitm.api.service.counselling;

import java.time.LocalDateTime;
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

    /**
     * Maps a student to a counsellor — the admin {@code /assign} endpoint.
     *
     * <p>A student has exactly one mapping row ({@code uk_scm_student}), so this moves that row
     * to the new counsellor in place (reactivating it if it had been deactivated) rather than
     * adding a second active row next to the old counsellor's. Only mapping a student to the
     * counsellor they are already actively mapped to is refused, as before.
     */
    public StudentCounsellorMapping assignStudentToCounsellor(Long studentId, Long counsellorId, Long adminUserId, String notes) {
        logger.info("Assigning student {} to counsellor {} by admin {}", studentId, counsellorId, adminUserId);

        Optional<StudentCounsellorMapping> existing = mappingRepository.findByStudentUserStudentId(studentId);

        if (existing.isPresent()) {
            StudentCounsellorMapping mapping = existing.get();
            boolean sameCounsellor = mapping.getCounsellor() != null
                    && counsellorId.equals(mapping.getCounsellor().getId());
            if (sameCounsellor && Boolean.TRUE.equals(mapping.getIsActive())) {
                throw new DuplicateResourceException("Student " + studentId + " is already assigned to counsellor " + counsellorId);
            }
            if (!sameCounsellor) {
                Counsellor counsellor = counsellorRepository.findById(counsellorId)
                        .orElseThrow(() -> new ResourceNotFoundException("Counsellor", "id", counsellorId));
                logger.info("Moving student {} from counsellor {} to counsellor {}", studentId,
                        mapping.getCounsellor() != null ? mapping.getCounsellor().getId() : null, counsellorId);
                mapping.setCounsellor(counsellor);
            } else {
                logger.info("Reactivating existing mapping for student {} and counsellor {}", studentId, counsellorId);
            }
            mapping.setIsActive(true);
            mapping.setAssignedAt(LocalDateTime.now());
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

    /**
     * Maps one student to a counsellor with a single native upsert, in its own transaction —
     * the offline page's bulk "Map to me", which reports per student. Moves the row if another
     * counsellor has it, reactivates it if inactive, inserts it otherwise. Never touches the
     * student's OTP guard: re-mapping must not reset the wrong-code counter.
     */
    public void upsertActiveMapping(Long studentId, Long counsellorId, Long assignedByUserId) {
        mappingRepository.upsertActive(studentId, counsellorId, assignedByUserId, LocalDateTime.now());
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

    /**
     * {@link #assignStudentToCounsellor} for each student, so students already mapped elsewhere
     * are moved to this counsellor. Deliberately not transactional: every row commits on its own,
     * and a failure (unknown student, already this counsellor's, a unique-key race) skips that
     * student without rolling back the rest. Returns the rows that were written.
     */
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
