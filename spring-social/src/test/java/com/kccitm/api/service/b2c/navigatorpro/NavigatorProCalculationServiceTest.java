package com.kccitm.api.service.b2c.navigatorpro;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.Questionnaire;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.OptionScoreBasedOnMeasuredQualityTypesRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.report.AssessmentReportTemplateRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.service.b2c.report.ReportRoutingException;
import com.kccitm.api.service.b2c.report.ReportSuppressedException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NavigatorProCalculationServiceTest {

    @Mock AssessmentAnswerRepository answerRepository;
    @Mock AssessmentTableRepository assessmentTableRepository;
    @Mock QuestionnaireQuestionRepository questionnaireQuestionRepository;
    @Mock OptionScoreBasedOnMeasuredQualityTypesRepository optionScoreRepository;
    @Mock StudentAssessmentMappingRepository mappingRepository;
    @Mock UserStudentRepository userStudentRepository;
    @Mock AssessmentReportTemplateRepository assessmentReportTemplateRepository;
    @Spy NavigatorProConstructMap map = new NavigatorProConstructMap();
    @InjectMocks NavigatorProCalculationService service;

    NavigatorProFixtures fx;
    UserStudent student;
    StudentAssessmentMapping mapping;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "careerLibraryUrl", "https://career-9.com/library");
        ReflectionTestUtils.setField(service, "flatGap", 10.0);
        ReflectionTestUtils.setField(service, "weakPeak", 50.0);
        ReflectionTestUtils.setField(service, "noSignalDomain", 50.0);
        ReflectionTestUtils.setField(service, "bannerFlagCount", 2);
        ReflectionTestUtils.setField(service, "normsMinN", 60);
        ReflectionTestUtils.setField(service, "percentileMinN", 30);

        fx = NavigatorProFixtures.validQuestionnaire();
        AssessmentTable a = new AssessmentTable();
        Questionnaire qn = new Questionnaire();
        qn.setQuestionnaireId(20L);
        a.setQuestionnaire(qn);
        when(assessmentTableRepository.findById(9L)).thenReturn(Optional.of(a));
        when(questionnaireQuestionRepository.findByQuestionnaireIdWithOptions(20L)).thenReturn(fx.questions);
        when(optionScoreRepository.findByOptionIdIn(anyList())).thenAnswer(inv -> fx.scoresFor(inv.getArgument(0)));

        student = new UserStudent();
        student.setUserStudentId(5L);
        StudentInfo si = new StudentInfo();
        si.setName("Priya Sharma");
        si.setSchoolRollNumber("R-42");
        student.setStudentInfo(si);
        InstituteDetail inst = new InstituteDetail();
        inst.setInstituteName("Sample Institute of Technology");
        student.setInstitute(inst);
        when(userStudentRepository.findByIdWithStudentInfo(5L)).thenReturn(Optional.of(student));

        mapping = new StudentAssessmentMapping();
        mapping.setStatus("completed");
        mapping.setAssessmentId(9L);
        mapping.setUserStudent(student);
        mapping.setCompletedAt(new Date());
        when(mappingRepository.findFirstByUserStudentUserStudentIdAndAssessmentId(5L, 9L)).thenReturn(Optional.of(mapping));
        when(mappingRepository.findCompletedForAssessment(9L)).thenReturn(List.of(mapping));
        when(mappingRepository.findByUserStudentUserStudentId(5L)).thenReturn(List.of(mapping));
    }

    private void answers(List<AssessmentAnswer> rows) {
        when(answerRepository.findByUserStudentIdAndAssessmentIdWithDetails(5L, 9L)).thenReturn(new ArrayList<>(rows));
        when(answerRepository.findAllByAssessmentIdWithScores(9L)).thenReturn(rows);
    }

    @Test
    void completeStudent_smallCohort_fillsEveryKeyWithRawOnly() {
        // agree idx 3 → 4 each; freq idx 2 → 3; mcq idx 0 → correct; intensity idx 3 → 4;
        // yes idx 0 → Yes; validity idx 0 → 1 (no flag); attention idx 1 → No (pass); values 1,9,5,10.
        answers(fx.completeAnswers(student, 3, 2, 0, 3, 0, 0, 1, 1, 9, 5, 10));

        Map<String, Object> p = service.calculate(5L, 9L, null);

        assertThat(p.get("student_name")).isEqualTo("Priya Sharma");
        assertThat(p.get("first_name")).isEqualTo("Priya");
        assertThat(p.get("student_id")).isEqualTo("R-42");
        assertThat(p.get("college")).isEqualTo("Sample Institute of Technology");
        assertThat(p.get("reading_no")).isEqualTo(1);
        assertThat(p.get("batch_n")).isEqualTo(1);
        assertThat(p.get("career_library_url")).isEqualTo("https://career-9.com/library");

        assertThat(p.get("f_id")).isEqualTo(75);
        assertThat(p.get("drive")).isEqualTo(75);
        assertThat(p.get("foundation")).isEqualTo(67);
        assertThat(p.get("fs_gd")).isEqualTo(67);
        assertThat(p.get("fs_gd_rag")).isEqualTo("amber");      // 66.67 raw → Developing
        assertThat(p.get("fs_gd_band")).isEqualTo("Developing");
        assertThat(p.get("reasoning")).isEqualTo(5);
        assertThat(p.get("reasoning_display")).isEqualTo("5/5");
        assertThat(p.get("chk_spr_mark")).isEqualTo("✔");
        assertThat(p.get("skill")).isEqualTo(75);
        assertThat(p.get("d_pe")).isEqualTo(75);
        assertThat(p.get("fam_r")).isEqualTo(100);
        assertThat(p.get("profile_shape")).isEqualTo("Flat");

        // n = 1 → percentiles suppressed, provisional cuts
        assertThat(p.get("percentiles_suppressed")).isEqualTo(true);
        assertThat(p.get("norms_provisional")).isEqualTo(true);
        assertThat(p.get("p_id")).isEqualTo("");
        assertThat(p.get("drive_band")).isEqualTo("");
        assertThat(p.get("drive_text")).isEqualTo("");
        assertThat(p.get("factor_callout")).isEqualTo("");
        assertThat(p.get("zone")).isEqualTo("Ready to accelerate");
        assertThat((String) p.get("zone_note")).contains("provisional cut");

        assertThat(p.get("value_1")).isEqualTo("Keep learning new things");
        assertThat(p.get("value_2_icon")).isEqualTo("🎯");
        assertThat(p.get("value_4")).isEqualTo("Serving something bigger");

        assertThat(p.get("response_quality_banner")).isEqualTo("");
        assertThat(p.get("counselling_mandatory")).isEqualTo(false);
        assertThat(p.get("explorer")).isEqualTo(false);
        assertThat(p.get("top1")).isEqualTo("");
        assertThat(p).doesNotContainKey("validity_flags");
        assertThat(p).containsKeys("def_id", "def_st", "def_ae", "lowest_bar", "lowest_bar_step",
                "zone_copy", "drive_median", "skill_median", "prec", "reading_date", "move_3");
    }

    @Test
    void attentionFailed_isR1() {
        answers(fx.completeAnswers(student, 3, 2, 0, 3, 0, 0, 0, 1, 9, 5, 10));   // attention idx 0 = Yes
        assertThatThrownBy(() -> service.calculate(5L, 9L, null))
                .isInstanceOf(ReportSuppressedException.class)
                .satisfies(e -> assertThat(((ReportSuppressedException) e).getRuleCode()).isEqualTo("R1"));
    }

    @Test
    void skippedQuestion_isR5() {
        List<AssessmentAnswer> rows = fx.completeAnswers(student, 3, 2, 0, 3, 0, 0, 1, 1, 9, 5, 10);
        rows.removeIf(a -> a.getQuestionnaireQuestion() == fx.byConstruct.get("f_id").get(0));
        answers(rows);
        assertThatThrownBy(() -> service.calculate(5L, 9L, null))
                .isInstanceOf(ReportSuppressedException.class)
                .satisfies(e -> assertThat(((ReportSuppressedException) e).getRuleCode()).isEqualTo("R5"));
    }

    @Test
    void weakPeak_isR3() {
        // yes idx 1 = No everywhere → all families 0 → flat; make one family differentiated but under 50.
        List<AssessmentAnswer> rows = fx.completeAnswers(student, 3, 2, 0, 3, 1, 0, 1, 1, 9, 5, 10);
        rows.removeIf(a -> a.getQuestionnaireQuestion() == fx.byConstruct.get("fam_r").get(0)
                || a.getQuestionnaireQuestion() == fx.byConstruct.get("fam_r").get(1));
        rows.add(fx.answer(student, fx.byConstruct.get("fam_r").get(0), 0));   // Yes
        rows.add(fx.answer(student, fx.byConstruct.get("fam_r").get(1), 0));   // Yes → fam_r 33, others 0
        answers(rows);
        assertThatThrownBy(() -> service.calculate(5L, 9L, null))
                .isInstanceOf(ReportSuppressedException.class)
                .satisfies(e -> assertThat(((ReportSuppressedException) e).getRuleCode()).isEqualTo("R3"));
    }

    @Test
    void flatNoDomainNoValues_isR4() {
        // yes idx 1 → all families 0 (flat); intensity idx 0 → all domains 0; no ranking rows.
        answers(fx.completeAnswers(student, 3, 2, 0, 0, 1, 0, 1));
        assertThatThrownBy(() -> service.calculate(5L, 9L, null))
                .isInstanceOf(ReportSuppressedException.class)
                .satisfies(e -> assertThat(((ReportSuppressedException) e).getRuleCode()).isEqualTo("R4"));
    }

    @Test
    void twoValidityFlags_setBannerAndMandatoryCounselling() {
        answers(fx.completeAnswers(student, 3, 2, 0, 3, 0, 4, 1, 1, 9, 5, 10));   // validity idx 4 → score 5 ×3
        Map<String, Object> p = service.calculate(5L, 9L, null);
        assertThat((String) p.get("response_quality_banner")).contains("MAY BE BIASED");
        assertThat(p.get("counselling_mandatory")).isEqualTo(true);
    }

    @Test
    void staleQuestionnaire_isRoutingError() {
        fx.questions.remove(fx.byConstruct.get("chk_spr").get(0));
        answers(fx.completeAnswers(student, 3, 2, 0, 3, 0, 0, 1, 1, 9, 5, 10));
        assertThatThrownBy(() -> service.calculate(5L, 9L, null))
                .isInstanceOf(ReportRoutingException.class)
                .hasMessageContaining("Spreadsheet logic");
    }

    @Test
    void cohortOfSixty_yieldsPercentilesBandsAndMedianCuts() {
        // 60 students: the target plus 59 clones with identical answers → every percentile is 50 (midrank).
        List<AssessmentAnswer> mine = fx.completeAnswers(student, 3, 2, 0, 3, 0, 0, 1, 1, 9, 5, 10);
        List<AssessmentAnswer> all = new ArrayList<>(mine);
        List<StudentAssessmentMapping> completed = new ArrayList<>(List.of(mapping));
        for (long id = 100; id < 159; id++) {
            UserStudent other = new UserStudent();
            other.setUserStudentId(id);
            all.addAll(fx.completeAnswers(other, 3, 2, 0, 3, 0, 0, 1, 1, 9, 5, 10));
            StudentAssessmentMapping m = new StudentAssessmentMapping();
            m.setStatus("completed"); m.setAssessmentId(9L); m.setUserStudent(other); m.setCompletedAt(new Date());
            completed.add(m);
        }
        when(answerRepository.findByUserStudentIdAndAssessmentIdWithDetails(5L, 9L)).thenReturn(new ArrayList<>(mine));
        when(answerRepository.findAllByAssessmentIdWithScores(9L)).thenReturn(all);
        when(mappingRepository.findCompletedForAssessment(9L)).thenReturn(completed);

        Map<String, Object> p = service.calculate(5L, 9L, null);

        assertThat(p.get("batch_n")).isEqualTo(60);
        assertThat(p.get("percentiles_suppressed")).isEqualTo(false);
        assertThat(p.get("norms_provisional")).isEqualTo(false);
        assertThat(p.get("p_id")).isEqualTo(50);
        assertThat(p.get("p_id_text")).isEqualTo("P50");
        assertThat(p.get("drive_band")).isEqualTo("Developing");
        assertThat((String) p.get("drive_text")).startsWith("Your drive is in the batch mainstream");
        assertThat(p.get("drive_median")).isEqualTo(75);
        assertThat((String) p.get("factor_callout")).contains("(P50)").contains("±13");
        assertThat((String) p.get("zone_note")).contains("batch median");
    }
}
