package com.kccitm.api.controller.career9;

import java.lang.reflect.Field;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.service.branding.BrandingDto;
import com.kccitm.api.service.branding.InstituteBrandingService;
import com.kccitm.api.service.branding.StudentBrandingDto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Pins the contract of {@code GET /assessments/branding/{userStudentId}?assessmentId=…}.
 *
 * <p>The thank-you page tells the student "Report sent to your registered email". Whether
 * that is true is decided by the report pipeline ({@code ReportGenerateConsumer}): a school
 * student is mailed only when the institute is whitelabel OR the assessment's
 * {@code emailReportEnabled} toggle is on. The page already knew {@code whitelabel} from
 * this endpoint; it had no way to learn the per-assessment toggle, so the notice was shown
 * to everyone. This endpoint now carries the toggle alongside the branding, resolved live
 * (not from the build-time assessment cache) so an admin flip takes effect immediately.
 *
 * <p>Follows the reflection-injected controller unit precedent of
 * {@link AssessmentInstituteMappingUpdateTest} — no MockMvc/SpringBootTest bootstrap here.
 */
class StudentBrandingEmailToggleTest {

    private static final long STUDENT = 41L;
    private static final long ASSESSMENT = 7L;

    private AssessmentTableRepository assessmentTableRepository;
    private InstituteBrandingService brandingService;
    private AssessmentTableController controller;

    @BeforeEach
    void setUp() throws Exception {
        assessmentTableRepository = mock(AssessmentTableRepository.class);
        brandingService = mock(InstituteBrandingService.class);
        controller = new AssessmentTableController();
        inject("assessmentTableRepository", assessmentTableRepository);
        inject("brandingService", brandingService);
        when(brandingService.forUserStudent(STUDENT)).thenReturn(BrandingDto.standard());
    }

    private void inject(String fieldName, Object value) throws Exception {
        Field f = AssessmentTableController.class.getDeclaredField(fieldName);
        f.setAccessible(true);
        f.set(controller, value);
    }

    private void assessmentWithToggle(Boolean emailReportEnabled) {
        AssessmentTable a = new AssessmentTable();
        a.setEmailReportEnabled(emailReportEnabled);
        when(assessmentTableRepository.findById(ASSESSMENT)).thenReturn(Optional.of(a));
    }

    @Test
    @DisplayName("toggle ON → emailReportEnabled=true")
    void toggleOnIsReportedAsEnabled() {
        assessmentWithToggle(true);

        StudentBrandingDto out = controller.getStudentBranding(STUDENT, ASSESSMENT);

        assertThat(out.isEmailReportEnabled()).isTrue();
    }

    @Test
    @DisplayName("toggle OFF → emailReportEnabled=false")
    void toggleOffIsReportedAsDisabled() {
        assessmentWithToggle(false);

        StudentBrandingDto out = controller.getStudentBranding(STUDENT, ASSESSMENT);

        assertThat(out.isEmailReportEnabled()).isFalse();
    }

    @Test
    @DisplayName("toggle never set (null column) → emailReportEnabled=false")
    void unsetToggleIsReportedAsDisabled() {
        assessmentWithToggle(null);

        StudentBrandingDto out = controller.getStudentBranding(STUDENT, ASSESSMENT);

        assertThat(out.isEmailReportEnabled()).isFalse();
    }

    @Test
    @DisplayName("unknown assessment id → emailReportEnabled=false, not an error")
    void unknownAssessmentIsReportedAsDisabled() {
        when(assessmentTableRepository.findById(ASSESSMENT)).thenReturn(Optional.empty());

        StudentBrandingDto out = controller.getStudentBranding(STUDENT, ASSESSMENT);

        assertThat(out.isEmailReportEnabled()).isFalse();
    }

    @Test
    @DisplayName("no assessmentId query param → emailReportEnabled=false and no repository lookup")
    void omittedAssessmentIdIsDisabledWithoutLookup() {
        StudentBrandingDto out = controller.getStudentBranding(STUDENT, null);

        assertThat(out.isEmailReportEnabled()).isFalse();
        verify(assessmentTableRepository, never()).findById(anyLong());
    }

    @Test
    @DisplayName("whitelabel branding fields pass through unchanged next to the toggle")
    void whitelabelBrandingPassesThrough() {
        when(brandingService.forUserStudent(STUDENT))
                .thenReturn(new BrandingDto(true, "Springfield High", "https://cdn.example/logo.png"));
        assessmentWithToggle(false);

        StudentBrandingDto out = controller.getStudentBranding(STUDENT, ASSESSMENT);

        assertThat(out.isWhitelabel()).isTrue();
        assertThat(out.getSchoolName()).isEqualTo("Springfield High");
        assertThat(out.getLogoUrl()).isEqualTo("https://cdn.example/logo.png");
        assertThat(out.isEmailReportEnabled()).isFalse();
    }
}
