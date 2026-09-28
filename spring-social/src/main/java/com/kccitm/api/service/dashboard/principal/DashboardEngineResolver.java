package com.kccitm.api.service.dashboard.principal;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.report.AssessmentReportTemplate;
import com.kccitm.api.model.career9.PrincipalDashboardData;
import com.kccitm.api.repository.Career9.report.AssessmentReportTemplateRepository;

/**
 * Which product's dashboard an assessment releases into.
 *
 * <p>Decided the same way the student report is routed: by the engine of the
 * assessment's default report template. An assessment whose default template runs
 * {@code navigator_pro} gets the Navigator Pro college dashboard; everything else keeps
 * the Navigator 360 dashboard it has always had, so an assessment with no template
 * mapped is not silently reclassified.
 */
@Service
public class DashboardEngineResolver {

    private static final String PRO_TEMPLATE_ENGINE = "navigator_pro";

    private final AssessmentReportTemplateRepository templateRepository;

    public DashboardEngineResolver(AssessmentReportTemplateRepository templateRepository) {
        this.templateRepository = templateRepository;
    }

    @Transactional(readOnly = true)
    public String engineFor(Long assessmentId) {
        if (assessmentId == null) return PrincipalDashboardData.ENGINE_NAVIGATOR_360;
        boolean pro = templateRepository.findByAssessmentIdAndIsDefaultTrue(assessmentId)
                .map(AssessmentReportTemplate::getReportTemplate)
                .map(t -> PRO_TEMPLATE_ENGINE.equalsIgnoreCase(t.getEngineCode()))
                .orElse(false);
        return pro ? PrincipalDashboardData.ENGINE_NAVIGATOR_PRO : PrincipalDashboardData.ENGINE_NAVIGATOR_360;
    }
}
