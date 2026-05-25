package com.kccitm.api.service;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
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
        return response;
    }
}
