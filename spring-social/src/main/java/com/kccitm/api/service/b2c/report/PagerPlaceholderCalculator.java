package com.kccitm.api.service.b2c.report;

import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.kccitm.api.model.career9.StudentDemographicResponse;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.repository.Career9.StudentDemographicResponseRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.service.Navigator.NavigatorReportGenerationService;
import com.kccitm.api.service.b2c.pager.Navigator360EngineService;
import com.kccitm.api.service.b2c.pager.Navigator360Models;
import com.kccitm.api.service.b2c.pager.Navigator360Models.Navigator360Result;
import com.kccitm.api.service.b2c.pager.Navigator360Models.StudentMeta;
import com.kccitm.api.service.b2c.pager.FourPagerEngineService;

/**
 * Wraps the existing pager pipeline:
 *   {@code intermediary scores → Navigator360EngineService → FourPagerEngineService.buildPlaceholders}.
 * No I/O — pure transformation given the intermediary scores already loaded
 * by ReportService.
 */
@Component
public class PagerPlaceholderCalculator implements PlaceholderCalculator {

    @Autowired private Navigator360EngineService navigator360EngineService;
    @Autowired private FourPagerEngineService    fourPagerEngineService;
    @Autowired private UserStudentRepository     userStudentRepository;
    @Autowired private StudentDemographicResponseRepository demographicResponseRepository;

    /** Demographic field ids (created once, reused) for the narrative profile fields. */
    private static final long FIELD_ID_ACHIEVEMENTS = 19L;
    private static final long FIELD_ID_HOBBIES       = 18L;
    private static final String FALLBACK_ACHIEVEMENTS = "You have not filled your Achievements";
    private static final String FALLBACK_HOBBIES      = "You have not filled your hobbies";

    @Override public String typeCode()       { return "pager"; }
    @Override public String engineVersion()  { return EngineVersions.PAGER_V1; }
    @Override public boolean usesIntermediary() { return true; }

    @Override
    public Map<String, Object> calculate(Long userStudentId, Long assessmentId,
                                         IntermediaryScoresPayload intermediary) {
        if (intermediary == null) {
            throw new ScoresNotReadyException(
                    "Intermediary scores not available for student=" + userStudentId
                            + " assessment=" + assessmentId);
        }

        NavigatorReportGenerationService.IntermediaryScores dto = intermediary.toDto();

        // Same defaults the legacy PagerReportDataController uses (academicPct, ccRaw, completionPct).
        Navigator360Result result = navigator360EngineService.computeNavigator360(dto, null, null, 1.0);

        StudentMeta meta = buildStudentMeta(userStudentId, assessmentId, result);
        Map<String, String> placeholders = fourPagerEngineService.buildPlaceholders(result, meta);

        return new HashMap<>(placeholders);
    }

    private StudentMeta buildStudentMeta(Long userStudentId, Long assessmentId, Navigator360Result result) {
        StudentMeta meta = new Navigator360Models.StudentMeta();
        meta.studentName  = result.studentName;
        meta.studentClass = result.studentClass;
        userStudentRepository.findById(userStudentId).ifPresent(us -> {
            StudentInfo si = us.getStudentInfo();
            if (si != null) {
                if (si.getStudentClass() != null) meta.studentClass = String.valueOf(si.getStudentClass());
                meta.age = computeAge(si.getStudentDob());
                if (us.getInstitute() != null) {
                    meta.schoolName = us.getInstitute().getInstituteName();
                    meta.schoolCity = us.getInstitute().getCity();
                }
            }
        });
        meta.achievements     = readDemographic(userStudentId, assessmentId, FIELD_ID_ACHIEVEMENTS, FALLBACK_ACHIEVEMENTS);
        meta.hobbiesInterests = readDemographic(userStudentId, assessmentId, FIELD_ID_HOBBIES, FALLBACK_HOBBIES);
        return meta;
    }

    /** Completed years between {@code dob} and today; {@code ""} when DOB is missing or in the future. */
    private static String computeAge(Date dob) {
        if (dob == null) return "";
        LocalDate birth = dob.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        LocalDate today = LocalDate.now();
        if (birth.isAfter(today)) return "";
        return String.valueOf(Period.between(birth, today).getYears());
    }

    /** Student's response to a dynamic demographic field, or {@code fallback} when blank/unanswered. */
    private String readDemographic(Long userStudentId, Long assessmentId, long fieldId, String fallback) {
        return demographicResponseRepository
                .findByUserStudentIdAndAssessmentIdAndFieldDefinitionFieldId(userStudentId, assessmentId, fieldId)
                .map(StudentDemographicResponse::getResponseValue)
                .filter(v -> v != null && !v.trim().isEmpty())
                .orElse(fallback);
    }
}
