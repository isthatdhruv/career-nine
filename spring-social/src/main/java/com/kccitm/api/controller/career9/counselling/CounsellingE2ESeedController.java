package com.kccitm.api.controller.career9.counselling;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.service.counselling.CounsellorInstituteMappingService;

/**
 * TEMPORARY E2E test-fixture seeder for the counselling flow.
 *
 * <p>The dev DB has no enrollment data and is only reachable via the app, so this builds a
 * complete bookable fixture through the app's own connection: a test institute, the test
 * counsellor mapped to it (with an office address), a couple of future slots (ONLINE +
 * OFFLINE), a test student, and a counselling-active entitlement with a booking token.
 *
 * <p>It returns the token + entitlementId + slotIds so you can drive the public booking
 * API ({@code /campaign/public/counselling/slots} and {@code /counselling/book}) exactly
 * as the post-assessment flow would. Delete this controller once testing is done.
 */
@RestController
@RequestMapping("/api/admin/counselling-e2e")
public class CounsellingE2ESeedController {

    private static final Logger logger = LoggerFactory.getLogger(CounsellingE2ESeedController.class);
    private static final Integer TEST_INSTITUTE_CODE = 990001;
    private static final Long TEST_ASSESSMENT_ID = 1L;

    @Autowired private InstituteDetailRepository instituteDetailRepository;
    @Autowired private CounsellorInstituteMappingService mappingService;
    @Autowired private CounsellorRepository counsellorRepository;
    @Autowired private CounsellingSlotRepository slotRepository;
    @Autowired private StudentInfoRepository studentInfoRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StudentEntitlementRepository entitlementRepository;

    @PreAuthorize("@auth.allows('counsellor.update')")
    @PostMapping("/seed")
    @Transactional
    public ResponseEntity<?> seed() {
        Map<String, Object> out = new HashMap<>();

        // 1) Test institute (PK is not auto-generated; reuse if present).
        InstituteDetail institute = instituteDetailRepository.findById(TEST_INSTITUTE_CODE).orElse(null);
        if (institute == null) {
            institute = new InstituteDetail();
            institute.setInstituteCode(TEST_INSTITUTE_CODE);
            institute.setInstituteName("E2E Test Institute");
            institute = instituteDetailRepository.save(institute);
        }
        out.put("instituteCode", TEST_INSTITUTE_CODE);

        // 2) Test counsellor: first counsellor in the DB; ensure an office address + institute mapping.
        Counsellor counsellor = counsellorRepository.findAll().stream().findFirst().orElse(null);
        if (counsellor == null) {
            out.put("error", "No counsellor exists. Register + approve a counsellor first.");
            return ResponseEntity.ok(out);
        }
        if (counsellor.getOfficeAddress() == null || counsellor.getOfficeAddress().isEmpty()) {
            counsellor.setOfficeAddress("E2E Test Office, 1st Floor, MG Road, Bengaluru 560001");
        }
        if (counsellor.getModeCapability() == null) counsellor.setModeCapability("BOTH");
        counsellorRepository.save(counsellor);
        Long counsellorId = counsellor.getId();
        out.put("counsellorId", counsellorId);
        out.put("counsellorName", counsellor.getName());
        try {
            mappingService.allocate(counsellorId, TEST_INSTITUTE_CODE, null, "E2E test");
        } catch (Exception e) {
            logger.info("Counsellor-institute mapping already present or failed (continuing): {}", e.getMessage());
        }

        // 3) Two future slots (tomorrow): one ONLINE, one OFFLINE.
        LocalDate day = LocalDate.now().plusDays(1);
        List<Long> slotIds = new ArrayList<>();
        slotIds.add(makeSlot(counsellor, day, LocalTime.of(10, 0), LocalTime.of(10, 30), "ONLINE"));
        slotIds.add(makeSlot(counsellor, day, LocalTime.of(11, 0), LocalTime.of(11, 30), "OFFLINE"));
        out.put("slotIds", slotIds);
        out.put("slotDate", day.toString());

        // 4) Test student (StudentInfo + UserStudent at the test institute).
        User anyUser = userRepository.findAll().stream().findFirst().orElse(null);
        StudentInfo info = new StudentInfo();
        info.setName("E2E Test Student");
        info.setEmail("e2e.student@example.com");
        try { info.setPhoneNumber("9000000099"); } catch (Exception ignore) {}
        info = studentInfoRepository.save(info);

        UserStudent student = new UserStudent();
        if (anyUser != null) student.setUserId(anyUser.getId());
        student.setStudentInfo(info);
        student.setInstitute(institute);
        student.setInfoCompleted(true);
        student = userStudentRepository.save(student);
        out.put("userStudentId", student.getUserStudentId());
        out.put("studentEmail", "e2e.student@example.com");

        // 5) Counselling-active entitlement with a unique booking token.
        StudentEntitlement ent = new StudentEntitlement();
        ent.setUserStudentId(student.getUserStudentId());
        ent.setAssessmentId(TEST_ASSESSMENT_ID);
        ent.setCounsellingActive(true);
        ent.setCounsellingSessionsTotal(2);
        ent.setCounsellingSessionsUsed(0);
        ent.setStatus("active");
        ent.setGrantedAt(new Date());
        ent = entitlementRepository.save(ent);
        String token = "E2E-" + ent.getEntitlementId();
        ent.setAccessToken(token);
        ent.setAccessTokenExpiresAt(new Date(System.currentTimeMillis() + 30L * 24 * 3600 * 1000));
        entitlementRepository.save(ent);

        out.put("entitlementId", ent.getEntitlementId());
        out.put("token", token);

        // How to drive the booking, exactly like the post-assessment flow.
        Map<String, Object> howTo = new HashMap<>();
        howTo.put("1_listSlots", "POST /campaign/public/counselling/slots  body: {\"token\":\"" + token
                + "\",\"entitlementId\":" + ent.getEntitlementId() + "}");
        howTo.put("2_book", "POST /campaign/public/counselling/book  body: {\"token\":\"" + token
                + "\",\"entitlementId\":" + ent.getEntitlementId() + ",\"slotId\":" + slotIds.get(0)
                + ",\"contactName\":\"E2E Test Student\",\"contactPhone\":\"9000000099\",\"contactEmail\":\"e2e.student@example.com\",\"preferredContactMethod\":\"EMAIL\"}");
        howTo.put("3_counsellorDashboard", "GET /api/counsellor/" + counsellorId + "/dashboard-summary");
        howTo.put("4_runLifecycle", "POST /api/counselling-lifecycle/run-session-sweep (after back-dating, or wait)");
        out.put("howTo", howTo);

        logger.info("Counselling E2E seed complete: {}", out);
        return ResponseEntity.ok(out);
    }

    private Long makeSlot(Counsellor c, LocalDate date, LocalTime start, LocalTime end, String mode) {
        CounsellingSlot s = new CounsellingSlot();
        s.setCounsellor(c);
        s.setDate(date);
        s.setStartTime(start);
        s.setEndTime(end);
        s.setDurationMinutes(30);
        s.setStatus("AVAILABLE");
        s.setMode(mode);
        s.setIsManuallyCreated(true);
        s.setIsBlocked(false);
        return slotRepository.save(s).getId();
    }
}
