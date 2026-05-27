package com.kccitm.api.service.b2c.report;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.kccitm.api.model.career9.StudentInfo;
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

    @Override public String typeCode()       { return "pager"; }
    @Override public String engineVersion()  { return EngineVersions.PAGER_V1; }
    @Override public boolean usesIntermediary() { return true; }

    @Override
    public Map<String, Object> calculate(Long userStudentId, Long assessmentId,
                                         String subtypeCode, IntermediaryScoresPayload intermediary) {
        if (intermediary == null) {
            throw new ScoresNotReadyException(
                    "Intermediary scores not available for student=" + userStudentId
                            + " assessment=" + assessmentId);
        }

        NavigatorReportGenerationService.IntermediaryScores dto = intermediary.toDto();

        // Same defaults the legacy PagerReportDataController uses (academicPct, ccRaw, completionPct).
        Navigator360Result result = navigator360EngineService.computeNavigator360(dto, null, null, 1.0);

        StudentMeta meta = buildStudentMeta(userStudentId, result);
        Map<String, String> placeholders = fourPagerEngineService.buildPlaceholders(result, meta);

        return new HashMap<>(placeholders);
    }

    private StudentMeta buildStudentMeta(Long userStudentId, Navigator360Result result) {
        StudentMeta meta = new Navigator360Models.StudentMeta();
        meta.studentName  = result.studentName;
        meta.studentClass = result.studentClass;
        userStudentRepository.findById(userStudentId).ifPresent(us -> {
            StudentInfo si = us.getStudentInfo();
            if (si != null) {
                if (si.getStudentClass() != null) meta.studentClass = String.valueOf(si.getStudentClass());
                if (us.getInstitute() != null) {
                    meta.schoolName = us.getInstitute().getInstituteName();
                    meta.schoolCity = us.getInstitute().getCity();
                }
            }
        });
        return meta;
    }
}
