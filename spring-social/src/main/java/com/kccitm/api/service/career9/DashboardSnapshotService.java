package com.kccitm.api.service.career9;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.controller.StudentInfoController;
import com.kccitm.api.controller.career9.AssessmentTableController;
import com.kccitm.api.controller.career9.GeneratedReportController;
import com.kccitm.api.controller.career9.InstituteDetailController;
import com.kccitm.api.controller.career9.counselling.CounsellingAppointmentController;
import com.kccitm.api.controller.career9.counselling.CounsellingRatingController;
import com.kccitm.api.controller.career9.counselling.CounsellorController;
import com.kccitm.api.model.career9.DashboardSnapshot;
import com.kccitm.api.repository.Career9.DashboardSnapshotRepository;

@Service
public class DashboardSnapshotService {

    public static final String ADMIN_DASHBOARD_KEY = "ADMIN_DASHBOARD";
    private static final Duration TTL = Duration.ofHours(24);

    @Autowired private DashboardSnapshotRepository snapshotRepository;
    @Autowired private ObjectMapper objectMapper;

    @Autowired private StudentInfoController studentInfoController;
    @Autowired private InstituteDetailController instituteDetailController;
    @Autowired private CounsellorController counsellorController;
    @Autowired private CounsellingAppointmentController counsellingAppointmentController;
    @Autowired private CounsellingRatingController counsellingRatingController;
    @Autowired private AssessmentTableController assessmentTableController;
    @Autowired private GeneratedReportController generatedReportController;

    public Map<String, Object> getOrCompute(String key, boolean forceRefresh) {
        DashboardSnapshot existing = snapshotRepository.findBySnapshotKey(key).orElse(null);

        if (!forceRefresh && existing != null && existing.getComputedAt() != null
                && Duration.between(existing.getComputedAt(), Instant.now()).compareTo(TTL) < 0) {
            try {
                return objectMapper.readValue(existing.getPayloadJson(),
                        new TypeReference<Map<String, Object>>() {});
            } catch (Exception e) {
                // Fall through to recompute if cached payload can't be deserialized
            }
        }

        Map<String, Object> payload = compute();
        Instant now = Instant.now();
        payload.put("computedAt", now.toString());

        try {
            String json = objectMapper.writeValueAsString(payload);
            DashboardSnapshot toSave = existing != null ? existing : new DashboardSnapshot();
            toSave.setSnapshotKey(key);
            toSave.setPayloadJson(json);
            toSave.setComputedAt(now);
            snapshotRepository.save(toSave);
        } catch (Exception e) {
            // If persistence fails, still return the freshly computed payload
            e.printStackTrace();
        }

        return payload;
    }

    private Map<String, Object> compute() {
        Map<String, Object> out = new LinkedHashMap<>();

        out.put("students", safeCall(() -> studentInfoController.getAllStudentInfo()));
        out.put("institutes", safeCall(() -> instituteDetailController.getallInstituteDetail()));
        out.put("counsellors", safeCall(() -> unwrap(counsellorController.getAll())));
        out.put("appointments", safeCall(() -> unwrap(counsellingAppointmentController.getAll())));
        out.put("ratingSummary", safeCall(() -> unwrap(counsellingRatingController.summaryByCounsellor())));
        out.put("assessments", safeCall(() -> unwrap(assessmentTableController.getAllAssessments())));
        out.put("reports", safeCall(() -> unwrap(generatedReportController.getAll())));
        out.put("studentMappings", safeCall(() -> studentInfoController.getAllStudentsWithMapping()));

        return out;
    }

    private static <T> T unwrap(ResponseEntity<T> resp) {
        return resp == null ? null : resp.getBody();
    }

    private static <T> Object safeCall(java.util.concurrent.Callable<T> c) {
        try {
            return c.call();
        } catch (Exception e) {
            e.printStackTrace();
            return List.of();
        }
    }
}
