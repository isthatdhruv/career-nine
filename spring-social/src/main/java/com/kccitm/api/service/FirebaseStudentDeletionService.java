package com.kccitm.api.service;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.school.FirebaseDataMapping;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.BetReportDataRepository;
import com.kccitm.api.repository.Career9.GeneralAssessmentResultRepository;
import com.kccitm.api.repository.Career9.NavigatorReportDataRepository;
import com.kccitm.api.repository.Career9.StudentDemographicResponseRepository;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.AssessmentProctoringQuestionLogRepository;
import com.kccitm.api.repository.Career9.School.FirebaseDataMappingRepository;
import com.kccitm.api.repository.Career9.School.FirebaseStudentExtraDataRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.UserRepository;

@Service
public class FirebaseStudentDeletionService {

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @Autowired
    private AssessmentRawScoreRepository assessmentRawScoreRepository;

    @Autowired
    private AssessmentAnswerRepository assessmentAnswerRepository;

    @Autowired
    private BetReportDataRepository betReportDataRepository;

    @Autowired
    private NavigatorReportDataRepository navigatorReportDataRepository;

    @Autowired
    private GeneralAssessmentResultRepository generalAssessmentResultRepository;

    @Autowired
    private AssessmentProctoringQuestionLogRepository assessmentProctoringQuestionLogRepository;

    @Autowired
    private StudentDemographicResponseRepository studentDemographicResponseRepository;

    @Autowired
    private FirebaseStudentExtraDataRepository firebaseStudentExtraDataRepository;

    @Autowired
    private FirebaseDataMappingRepository firebaseDataMappingRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private StudentInfoRepository studentInfoRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Deletes a single Firebase-imported student and all related data.
     * Runs in its own transaction so that a failure here does not
     * mark the caller's transaction as rollback-only.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deleteSingleStudent(UserStudent us) {
        Long usId = us.getUserStudentId();

        // Delete all related data in correct order (children first)

        // Assessment raw scores (linked via StudentAssessmentMapping)
        List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                .findByUserStudentUserStudentId(usId);
        for (StudentAssessmentMapping sam : mappings) {
            assessmentRawScoreRepository
                    .deleteByStudentAssessmentMappingStudentAssessmentId(sam.getStudentAssessmentId());
        }

        // Assessment answers
        assessmentAnswerRepository.deleteByUserStudent_UserStudentId(usId);

        // Assessment mappings
        studentAssessmentMappingRepository.deleteByUserStudentUserStudentId(usId);

        // Report data
        betReportDataRepository.deleteByUserStudentUserStudentId(usId);
        navigatorReportDataRepository.deleteByUserStudentUserStudentId(usId);
        generalAssessmentResultRepository.deleteByUserStudentId(usId);

        // Proctoring logs
        assessmentProctoringQuestionLogRepository.deleteByUserStudentUserStudentId(usId);

        // Demographics
        studentDemographicResponseRepository.deleteByUserStudentId(usId);

        // Firebase extra data
        firebaseStudentExtraDataRepository.deleteByUserStudentId(usId);

        // Firebase mapping
        Optional<FirebaseDataMapping> fbMapping = firebaseDataMappingRepository
                .findByNewEntityIdAndFirebaseType(usId, "STUDENT");
        fbMapping.ifPresent(m -> firebaseDataMappingRepository.delete(m));

        // StudentInfo and User
        StudentInfo si = us.getStudentInfo();
        Long userId = us.getUserId();

        // Delete UserStudent
        userStudentRepository.delete(us);

        // Delete StudentInfo
        if (si != null) {
            studentInfoRepository.delete(si);
        }

        // Delete User
        if (userId != null) {
            userRepository.deleteById(userId);
        }
    }
}
