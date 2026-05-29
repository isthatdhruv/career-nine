package com.kccitm.api.service;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class StudentSessionService {

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private UserStudentRepository userStudentRepository;

    public Map<String, Object> buildSessionPayload(Long userStudentId) {
        List<StudentAssessmentMapping> mappings =
                studentAssessmentMappingRepository.findByUserStudentUserStudentId(userStudentId);

        List<Map<String, Object>> assessmentsList = new ArrayList<>();
        for (StudentAssessmentMapping mapping : mappings) {
            Map<String, Object> info = new HashMap<>();
            info.put("assessmentId", mapping.getAssessmentId());
            info.put("studentStatus", mapping.getStatus());

            Optional<AssessmentTable> assessment =
                    assessmentTableRepository.findById(mapping.getAssessmentId());
            if (assessment.isPresent()) {
                info.put("assessmentName", assessment.get().getAssessmentName());
                info.put("isActive", assessment.get().getIsActive());
            } else {
                info.put("assessmentName", "Unknown Assessment");
                info.put("isActive", false);
            }
            assessmentsList.add(info);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("userStudentId", userStudentId);
        response.put("assessments", assessmentsList);

        // Surface DOB (dd-MM-yyyy) so auto-login callers can seed
        // localStorage.studentDob — mintAssessmentSessionCookie needs it
        // to re-mint cn_at_asmnt on expiry or when switching assessments.
        Optional<UserStudent> userStudentOpt = userStudentRepository.findById(userStudentId);
        if (userStudentOpt.isPresent()) {
            StudentInfo info = userStudentOpt.get().getStudentInfo();
            Date dob = info != null ? info.getStudentDob() : null;
            if (dob != null) {
                response.put("studentDob", new SimpleDateFormat("dd-MM-yyyy").format(dob));
            }
        }

        return response;
    }
}
