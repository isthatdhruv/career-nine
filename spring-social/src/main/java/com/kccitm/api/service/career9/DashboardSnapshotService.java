package com.kccitm.api.service.career9;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Collections;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonGenerator;
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

/**
 * Builds the admin dashboard payload by aggregating eight heavy admin endpoints
 * and caches the JSON for 24h.
 *
 * Memory note: this snapshot can be hundreds of MB on a real DB. We stream
 * each section through a JsonGenerator and drop the in-memory reference as
 * soon as it's serialized, so peak heap usage stays close to "one section"
 * rather than "all eight sections + a serialized copy of all eight."
 */
@Service
public class DashboardSnapshotService {

    public static final String ADMIN_DASHBOARD_KEY = "ADMIN_DASHBOARD";
    private static final Duration TTL = Duration.ofHours(24);

    private static final Logger logger = LoggerFactory.getLogger(DashboardSnapshotService.class);

    @Autowired private DashboardSnapshotRepository snapshotRepository;
    @Autowired private ObjectMapper objectMapper;

    @Autowired private StudentInfoController studentInfoController;
    @Autowired private InstituteDetailController instituteDetailController;
    @Autowired private CounsellorController counsellorController;
    @Autowired private CounsellingAppointmentController counsellingAppointmentController;
    @Autowired private CounsellingRatingController counsellingRatingController;
    @Autowired private AssessmentTableController assessmentTableController;
    @Autowired private GeneratedReportController generatedReportController;

    /**
     * Returns the snapshot payload as raw JSON bytes. The controller writes
     * these straight to the HTTP response, avoiding a second pass through
     * Spring's HttpMessageConverters (which would otherwise re-materialize
     * the entire payload as a Map only to re-serialize it).
     */
    public byte[] getOrComputeJsonBytes(String key, boolean forceRefresh) {
        DashboardSnapshot existing = snapshotRepository.findBySnapshotKey(key).orElse(null);

        if (!forceRefresh && existing != null && existing.getComputedAt() != null
                && Duration.between(existing.getComputedAt(), Instant.now()).compareTo(TTL) < 0
                && existing.getPayloadJson() != null) {
            return existing.getPayloadJson().getBytes(StandardCharsets.UTF_8);
        }

        Instant now = Instant.now();
        byte[] bytes;
        try {
            bytes = computeJsonBytes(now);
        } catch (Exception e) {
            logger.error("Dashboard snapshot compute failed for key={}", key, e);
            return "{}".getBytes(StandardCharsets.UTF_8);
        }

        try {
            DashboardSnapshot toSave = existing != null ? existing : new DashboardSnapshot();
            toSave.setSnapshotKey(key);
            toSave.setPayloadJson(new String(bytes, StandardCharsets.UTF_8));
            toSave.setComputedAt(now);
            snapshotRepository.save(toSave);
        } catch (Exception e) {
            logger.error("Failed to persist dashboard snapshot key={}", key, e);
        }

        return bytes;
    }

    /**
     * Walks the eight sections one at a time, writing each into the JSON
     * stream and dropping the in-memory reference immediately so the next
     * section can fit in heap.
     */
    private byte[] computeJsonBytes(Instant computedAt) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (JsonGenerator gen = objectMapper.getFactory().createGenerator(baos)) {
            gen.writeStartObject();
            writeSection(gen, "students",        () -> studentInfoController.getAllStudentInfo());
            writeSection(gen, "institutes",      () -> instituteDetailController.getallInstituteDetail());
            writeSection(gen, "counsellors",     () -> unwrap(counsellorController.getAll()));
            writeSection(gen, "appointments",    () -> unwrap(counsellingAppointmentController.getAll()));
            writeSection(gen, "ratingSummary",   () -> unwrap(counsellingRatingController.summaryByCounsellor()));
            writeSection(gen, "assessments",     () -> unwrap(assessmentTableController.getAllAssessments()));
            writeSection(gen, "reports",         () -> unwrap(generatedReportController.getAll()));
            writeSection(gen, "studentMappings", () -> studentInfoController.getAllStudentsWithMapping());
            gen.writeStringField("computedAt", computedAt.toString());
            gen.writeEndObject();
        }
        return baos.toByteArray();
    }

    private void writeSection(JsonGenerator gen, String name,
                              java.util.concurrent.Callable<?> supplier) throws IOException {
        Object value;
        try {
            value = supplier.call();
        } catch (Exception e) {
            logger.warn("Dashboard snapshot section '{}' failed: {}", name, e.getMessage());
            value = Collections.emptyList();
        }
        gen.writeFieldName(name);
        objectMapper.writeValue(gen, value);
        // 'value' goes out of scope on the next iteration so the entity graph
        // becomes GC-eligible before we load the next section.
    }

    private static <T> T unwrap(ResponseEntity<T> resp) {
        return resp == null ? null : resp.getBody();
    }
}
