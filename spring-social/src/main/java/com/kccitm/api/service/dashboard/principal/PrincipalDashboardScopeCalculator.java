package com.kccitm.api.service.dashboard.principal;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.StudentGroupMemberRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.service.schoolreport.SchoolDashboard;
import com.kccitm.api.service.schoolreport.SchoolDashboardDataService;

/**
 * The deterministic half of a generated dashboard.
 *
 * <p>Produces the {@code internal_calculation} payload for one scope: the same two
 * bodies of data the Reports Hub "Mira Desai" exports write to Excel — the school
 * dashboard sheet and the psychometric properties sheet — assembled as JSON instead
 * of a workbook.
 *
 * <p>This half is cheap and reproducible, which is why it has different rules from the
 * AI half: it can be recomputed freely, and it is still computed for cohorts below the
 * narrative floor. What a four-student section must not get is a *narrative*; the
 * counts themselves are what the page needs to explain why there is no narrative.
 */
@Service
public class PrincipalDashboardScopeCalculator {

    private static final Logger log = LoggerFactory.getLogger(PrincipalDashboardScopeCalculator.class);

    private final StudentAssessmentMappingRepository mappingRepository;
    private final StudentGroupMemberRepository groupMemberRepository;
    private final SchoolDashboardDataService dashboardDataService;

    public PrincipalDashboardScopeCalculator(
            StudentAssessmentMappingRepository mappingRepository,
            StudentGroupMemberRepository groupMemberRepository,
            SchoolDashboardDataService dashboardDataService) {
        this.mappingRepository = mappingRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.dashboardDataService = dashboardDataService;
    }

    /** What one scope's computation yields. */
    public static final class ScopeResult {
        /** Serialised into {@code internal_calculation} and fed to the AI prompt. */
        public Map<String, Object> payload;
        /** Scoreable students inside this scope — drives the floor and staleness. */
        public int scoredCount;
    }

    /**
     * Compute one scope.
     *
     * <p>The student list is resolved first, then the dashboard aggregates are built
     * over exactly that list. Resolving membership up front is what lets a group scope
     * work at all: a group cuts across classes, so it cannot be expressed as a class
     * filter on the existing dashboard query.
     */
    public ScopeResult compute(Long instituteCode, ScopeKey scope) {
        List<Long> studentIds = resolveStudents(instituteCode, scope);

        ScopeResult result = new ScopeResult();
        result.scoredCount = studentIds.size();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("scopeKey", scope.key());
        payload.put("scopeLevel", scope.level());
        payload.put("scopeLabel", scope.describe());
        payload.put("instituteCode", instituteCode);
        payload.put("assessmentId", scope.getAssessmentId());
        payload.put("studentCount", studentIds.size());

        // Sheet 1 — the school dashboard view. The existing service filters by class,
        // which covers the institute/session/class levels directly; section and group
        // scopes narrow further via the resolved student list below.
        try {
            SchoolDashboard.ClassFilter classFilter = scope.getClassId() == null
                    ? SchoolDashboard.ClassFilter.all()
                    : SchoolDashboard.ClassFilter.of(scope.getClassId().intValue());
            payload.put("schoolDashboard",
                    dashboardDataService.buildInstituteView(instituteCode.intValue(), classFilter));
        } catch (Exception e) {
            // A missing sheet must not fail the whole scope — the row still carries
            // counts, and the gap is visible in the payload rather than silent.
            log.warn("Principal dashboard: school-dashboard sheet failed for {}: {}", scope.key(), e.toString());
            payload.put("schoolDashboardError", String.valueOf(e.getMessage()));
        }

        payload.put("studentIds", studentIds);
        result.payload = payload;
        return result;
    }

    /**
     * Which students fall inside a scope.
     *
     * <p>Group scopes are resolved through membership, every other level through the
     * student's own session/class/section. A null dimension means unconstrained, so an
     * institute scope matches every completed student.
     */
    private List<Long> resolveStudents(Long instituteCode, ScopeKey scope) {
        List<Long> groupMembers = null;
        if (scope.getGroupId() != null) {
            groupMembers = groupMemberRepository.findUserStudentIdsByGroupId(scope.getGroupId());
            if (groupMembers.isEmpty()) return new ArrayList<>();
        }

        List<Long> ids = new ArrayList<>();
        for (StudentAssessmentMapping m : mappingRepository.findAllByInstituteCode(instituteCode.intValue())) {
            if (!scope.getAssessmentId().equals(m.getAssessmentId())) continue;

            String status = m.getStatus() == null ? "" : m.getStatus().trim().toLowerCase();
            if (!"completed".equals(status)) continue;

            UserStudent us = m.getUserStudent();
            if (us == null) continue;

            if (groupMembers != null) {
                if (!groupMembers.contains(us.getUserStudentId())) continue;
            } else {
                StudentInfo info = us.getStudentInfo();
                if (info == null) continue;
                if (!dimMatches(scope.getSessionId(), info.getSessionId())) continue;
                if (!dimMatches(scope.getClassId(), info.getStudentClass())) continue;
                if (!dimMatches(scope.getSectionId(), info.getSchoolSectionId())) continue;
            }
            ids.add(us.getUserStudentId());
        }
        return ids;
    }

    /** Null on the scope side means unconstrained; a null on the student side never matches a bound scope. */
    private static boolean dimMatches(Long scopeDim, Number studentDim) {
        if (scopeDim == null) return true;
        if (studentDim == null) return false;
        return scopeDim.longValue() == studentDim.longValue();
    }
}
