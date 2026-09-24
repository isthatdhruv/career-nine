package com.kccitm.api.service.b2c.navigatorpro;

import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.Questionnaire;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
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

    // Answer-index conventions for NavigatorProFixtures.completeAnswers:
    static final int AGREE = 3;       // Agree → 4
    static final int OFTEN = 2;       // Several times → 3
    static final int CORRECT = 0;     // keyed option first
    static final int DONE_OWN = 3;    // "Did it on my own" → 4 → 100
    static final int USED = 2;        // "Used it when required" → 3 → 67
    static final int NEVER = 0;       // "Never tried it" → 1 → 0
    static final int YES = 0, NO = 1;
    static final int NO_FLAG = 0;     // validity row scores 1
    static final int PASS = 1;        // attention: "No"
    // Values by option index: 2 Learning, 1 Autonomy, 8 Purpose, 4 Pay & benefits.
    static final int[] VALUES = {2, 1, 8, 4};

    @Mock AssessmentAnswerRepository answerRepository;
    @Mock AssessmentTableRepository assessmentTableRepository;
    @Mock QuestionnaireQuestionRepository questionnaireQuestionRepository;
    @Mock OptionScoreBasedOnMeasuredQualityTypesRepository optionScoreRepository;
    @Mock StudentAssessmentMappingRepository mappingRepository;
    @Mock UserStudentRepository userStudentRepository;
    @Mock AssessmentReportTemplateRepository assessmentReportTemplateRepository;
    @Spy NavigatorProConstructMap map = new NavigatorProConstructMap();
    @Spy NavigatorProBlend blend = new NavigatorProBlend();
    @InjectMocks NavigatorProCalculationService service;

    NavigatorProFixtures fx;
    UserStudent student;
    StudentAssessmentMapping mapping;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "careerLibraryUrl", "https://library.career-9.com/");
        ReflectionTestUtils.setField(service, "flatGap", 10.0);
        ReflectionTestUtils.setField(service, "weakPeak", 50.0);
        ReflectionTestUtils.setField(service, "noSignalExposure", 0.0);
        ReflectionTestUtils.setField(service, "bannerFlagCount", 2);
        ReflectionTestUtils.setField(service, "normsMinN", 60);
        ReflectionTestUtils.setField(service, "percentileMinN", 30);
        ReflectionTestUtils.setField(service, "tieGap", 3.0);
        ReflectionTestUtils.setField(service, "explorerSpread", 5.0);
        ReflectionTestUtils.setField(service, "explorerMaxExposure", 75.0);
        ReflectionTestUtils.setField(service, "trackACut", 50.0);

        fx = NavigatorProFixtures.validQuestionnaire();
        AssessmentTable a = new AssessmentTable();
        Questionnaire qn = new Questionnaire();
        qn.setQuestionnaireId(24L);
        a.setQuestionnaire(qn);
        when(assessmentTableRepository.findById(9L)).thenReturn(Optional.of(a));
        when(questionnaireQuestionRepository.findByQuestionnaireIdWithOptions(24L)).thenReturn(fx.questions);
        when(optionScoreRepository.findByOptionIdIn(anyList())).thenAnswer(inv -> fx.scoresFor(inv.getArgument(0)));

        student = new UserStudent();
        student.setUserStudentId(5L);
        StudentInfo si = new StudentInfo();
        si.setName("aditya  KUMAR");
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

    private List<AssessmentAnswer> standard(int exposure, int yes) {
        return fx.completeAnswers(student, AGREE, OFTEN, CORRECT, exposure, yes, NO_FLAG, PASS, VALUES);
    }

    /** Replaces the six answers of {@code family} with Yes for the first {@code yesCount}, No after. */
    private void setFamily(List<AssessmentAnswer> rows, String family, int yesCount) {
        List<QuestionnaireQuestion> qs = fx.byConstruct.get(family);
        rows.removeIf(a -> qs.contains(a.getQuestionnaireQuestion()));
        for (int i = 0; i < qs.size(); i++) rows.add(fx.answer(student, qs.get(i), i < yesCount ? YES : NO));
    }

    private static String rule(Throwable e) {
        return ((ReportSuppressedException) e).getRuleCode();
    }

    /** Tech Spec v3 §9 TIE: a constructed profile whose top two sit 1 point apart prints "1 point(s)". */
    @Test
    void standardStudent_smallCohort_v3MapAndTie() {
        answers(standard(DONE_OWN, YES));

        Map<String, Object> p = service.calculate(5L, 9L, null);

        assertThat(p.get("student_name")).isEqualTo("Aditya Kumar");               // Title-Cased
        assertThat(p.get("first_name")).isEqualTo("Aditya");
        assertThat(p.get("student_id")).isEqualTo("R-42");
        assertThat(p.get("college")).isEqualTo("Sample Institute of Technology");
        assertThat(p.get("batch_n")).isEqualTo(1);
        assertThat(p.get("career_library_url")).isEqualTo("https://library.career-9.com/");

        // Will and factors: Agree ×11 → 75; percentiles never printed.
        assertThat(p.get("drive")).isEqualTo(75);
        assertThat(p.get("will")).isEqualTo(75);
        assertThat(p.get("f_id")).isEqualTo(75);
        assertThat(p.get("label_f_id")).isEqualTo("Self-Motivation");
        assertThat(p.get("f_st_line")).isEqualTo("your staying power when work gets long or boring: raw 75/100");
        assertThat(p.get("p_id")).isEqualTo("");
        assertThat(p.get("skill_p")).isEqualTo("");

        // Foundation: Several times → 66.67 prints 67 and bands Strong (v3 sample rule).
        assertThat(p.get("foundation")).isEqualTo(67);
        assertThat(p.get("fs_gd")).isEqualTo(67);
        assertThat(p.get("fs_gd_label")).isEqualTo("Finishing what you start");
        assertThat(p.get("fs_gd_band")).isEqualTo("Strong");
        assertThat(p.get("fs_gd_rag")).isEqualTo("green");

        // Everyday logic
        assertThat(p.get("reasoning_display")).isEqualTo("5/5");
        assertThat(p.get("chk_spr_mark")).isEqualTo("✔");

        // Exposure: all "Did it on my own" → 100
        assertThat(p.get("skill")).isEqualTo(100);
        assertThat(p.get("d_pe")).isEqualTo(100);

        // Families all Yes → tied shape; High bullets
        assertThat(p.get("fam_r")).isEqualTo(100);
        assertThat(p.get("profile_shape")).isEqualTo("Tied");
        assertThat((String) p.get("shape_line")).startsWith("Your interests are genuinely wide");
        assertThat(p.get("fam_r_bullet_1")).isEqualTo("You learn fastest by building and handling real things.");

        // n = 1 → bands suppressed ("cohort forming"), provisional 50/50 cuts
        assertThat(p.get("percentiles_suppressed")).isEqualTo(true);
        assertThat(p.get("drive_band")).isEqualTo("");
        assertThat(p.get("cohort_note")).isEqualTo("cohort forming");
        assertThat(p.get("zone")).isEqualTo("Ready to accelerate");
        assertThat((String) p.get("zone_copy")).startsWith("You are motivated and you already have real skills");
        assertThat((String) p.get("zone_note")).startsWith("What your position means: will 75, skill 100 — you are strong on both sides");

        // Values join on tag: Learning, Autonomy, Purpose, Pay & benefits
        assertThat(p.get("value_1")).isEqualTo("Work where I keep learning new things");
        assertThat(p.get("value_1_tag")).isEqualTo("Learning");
        assertThat(p.get("value_1_icon")).isEqualTo("📚");
        assertThat(p.get("value_4_tag")).isEqualTo("Pay & benefits");

        // Blend: interests and exposure equal everywhere, so values decide.
        // VA: Data & AI 25/30, Software Development 23/30, Cybersecurity 21/30 → scores 96.67, 95.33, 94.00.
        assertThat(p.get("top1")).isEqualTo("Data & AI");
        assertThat(p.get("top2")).isEqualTo("Software Development");
        assertThat(p.get("top3")).isEqualTo("Cybersecurity");
        assertThat(p.get("top1_score")).isEqualTo(97);
        assertThat(p.get("rank_12")).isEqualTo("Quality, Testing & Operations");
        assertThat(p.get("tie")).isEqualTo(true);
        assertThat(p.get("tie_line")).isEqualTo("Your top two directions sit 1 point(s) apart — treat them as equally suited and test both.");
        assertThat(p.get("explorer")).isEqualTo(false);
        assertThat(p.get("top1_path_1")).isEqualTo("Data analyst → data scientist track");
        assertThat((String) p.get("other_nine_rows")).contains(">4<").contains("Quality, Testing &amp; Operations");

        // Track B, Build flavour (top family Hands-on)
        assertThat(p.get("track")).isEqualTo("B");
        assertThat((String) p.get("project")).startsWith("Scrape or download AKTU/placement public data");
        assertThat((String) p.get("project_card")).contains("(Data & AI)");
        assertThat(p.get("wider_door_1")).isEqualTo("");

        assertThat(p.get("one_line")).isEqualTo("ready to accelerate — leaning Data & AI — next checkpoint: Reading 2.");
        assertThat(p.get("response_quality_banner")).isEqualTo("");
        assertThat(p.get("counselling_mandatory")).isEqualTo(false);
        assertThat(p).doesNotContainKey("validity_flags");
        assertThat(p.get("factor_callout")).isEqualTo("");
        assertThat(p.get("dash_drive")).isEqualTo("160.2 213.6");
        assertThat((String) p.get("cover_mark")).startsWith("<svg");
    }

    /** Tech Spec v3 §9 EXPLORER: bunched blend and no domain done on their own → R6 branch, aspiration-led. */
    @Test
    void explorer_bunchedBlendAndNoStrongExposure() {
        List<AssessmentAnswer> rows = standard(USED, YES);
        rows.addAll(fx.aspirationAnswers(student, "d_ee", "d_pe", "d_da"));
        answers(rows);

        Map<String, Object> p = service.calculate(5L, 9L, null);

        assertThat(p.get("explorer")).isEqualTo(true);
        assertThat(p.get("top1")).isEqualTo("");                  // no forced #1
        assertThat(p.get("lean")).isEqualTo("");
        assertThat(p.get("tie_line")).isEqualTo("");
        assertThat(p.get("rank_1")).isEqualTo("Data & AI");        // ranking still available
        assertThat(p.get("aspiration_1")).isEqualTo("Electronics & Embedded");
        assertThat(p.get("explorer_1_path_1")).isEqualTo("Semiconductor design & verification (ISM units)");
        assertThat(p.get("counselling_mandatory")).isEqualTo(true);
        assertThat(p.get("project")).isEqualTo("");
    }

    @Test
    void trackA_whenHandsOnAndAnalyticalBothUnderFifty() {
        List<AssessmentAnswer> rows = standard(DONE_OWN, YES);
        setFamily(rows, "fam_r", 1);
        setFamily(rows, "fam_i", 2);
        answers(rows);

        Map<String, Object> p = service.calculate(5L, 9L, null);

        assertThat(p.get("track")).isEqualTo("A");
        assertThat(p.get("wider_door_1")).isEqualTo("Product & communication design");   // Creative row
        assertThat((String) p.get("track_a_closing")).startsWith("Your strengths are real");
        assertThat(p.get("project")).isEqualTo("");
    }

    /** Tech Spec v3 §9 VALIDITY: two flags → report generates with the banner and mandatory counselling. */
    @Test
    void validity_twoFlagsGenerateWithBanner() {
        answers(fx.completeAnswers(student, AGREE, OFTEN, CORRECT, DONE_OWN, YES, 4, PASS, VALUES));
        Map<String, Object> p = service.calculate(5L, 9L, null);
        assertThat(p.get("response_quality_banner")).isEqualTo("This report may be biased — read it with your counsellor.");
        assertThat(p.get("counselling_mandatory")).isEqualTo(true);
    }

    /** Tech Spec v3 §9 ATTENTION: "Yes" on the attention item suppresses regardless of other answers. */
    @Test
    void attention_isR1() {
        answers(fx.completeAnswers(student, AGREE, OFTEN, CORRECT, DONE_OWN, YES, NO_FLAG, 0, VALUES));
        assertThatThrownBy(() -> service.calculate(5L, 9L, null))
                .isInstanceOf(ReportSuppressedException.class).satisfies(e -> assertThat(rule(e)).isEqualTo("R1"));
    }

    @Test
    void skippedItem_isR5() {
        List<AssessmentAnswer> rows = standard(DONE_OWN, YES);
        rows.removeIf(a -> a.getQuestionnaireQuestion() == fx.byConstruct.get("f_id").get(0));
        answers(rows);
        assertThatThrownBy(() -> service.calculate(5L, 9L, null))
                .isInstanceOf(ReportSuppressedException.class).satisfies(e -> assertThat(rule(e)).isEqualTo("R5"));
    }

    @Test
    void fewerThanFourValues_isR5() {
        answers(fx.completeAnswers(student, AGREE, OFTEN, CORRECT, DONE_OWN, YES, NO_FLAG, PASS, 2, 1, 8));
        assertThatThrownBy(() -> service.calculate(5L, 9L, null))
                .isInstanceOf(ReportSuppressedException.class).satisfies(e -> assertThat(rule(e)).isEqualTo("R5"));
    }

    /** Tech Spec v3 §9 MIN: every family No → weak peak → no report. */
    @Test
    void weakPeak_isR3() {
        answers(standard(DONE_OWN, NO));
        assertThatThrownBy(() -> service.calculate(5L, 9L, null))
                .isInstanceOf(ReportSuppressedException.class).satisfies(e -> assertThat(rule(e)).isEqualTo("R3"));
    }

    @Test
    void tiedInterestsAndNothingTried_isR4() {
        List<AssessmentAnswer> rows = standard(NEVER, YES);
        for (String f : NavigatorProConstructMap.FAMILY_KEYS) setFamily(rows, f, 3);   // every family 50, tied
        answers(rows);
        assertThatThrownBy(() -> service.calculate(5L, 9L, null))
                .isInstanceOf(ReportSuppressedException.class).satisfies(e -> assertThat(rule(e)).isEqualTo("R4"));
    }

    @Test
    void staleQuestionnaire_isRoutingError() {
        fx.questions.remove(fx.byConstruct.get("chk_spr").get(0));
        answers(standard(DONE_OWN, YES));
        assertThatThrownBy(() -> service.calculate(5L, 9L, null))
                .isInstanceOf(ReportRoutingException.class)
                .hasMessageContaining("Spreadsheet logic");
    }

    @Test
    void cohortOfSixty_bandsFromInternalPercentilesAndMedianCuts() {
        List<AssessmentAnswer> mine = standard(DONE_OWN, YES);
        List<AssessmentAnswer> all = new ArrayList<>(mine);
        List<StudentAssessmentMapping> completed = new ArrayList<>(List.of(mapping));
        for (long id = 100; id < 159; id++) {
            UserStudent other = new UserStudent();
            other.setUserStudentId(id);
            all.addAll(fx.completeAnswers(other, AGREE, OFTEN, CORRECT, DONE_OWN, YES, NO_FLAG, PASS, VALUES));
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
        assertThat(p.get("drive_band")).isEqualTo("Developing");     // every clone equal → P50
        assertThat(p.get("reasoning_band")).isEqualTo("Developing");
        assertThat(p.get("p_id")).isEqualTo("");                     // never printed
        assertThat(p.get("drive_median")).isEqualTo(75);
        assertThat(p.get("cohort_note")).isEqualTo("");
    }

    /** Mira Desai → "Navigator Pro Raw Data": one row per student from the same evaluation as the report. */
    @Test
    void rawExport_writesOneRowPerStudentWithItemsIndicesGateAndBlend() throws Exception {
        UserStudent other = new UserStudent();
        other.setUserStudentId(6L);
        StudentInfo osi = new StudentInfo();
        osi.setName("Weak Peak");
        other.setStudentInfo(osi);
        StudentAssessmentMapping om = new StudentAssessmentMapping();
        om.setStatus("completed"); om.setAssessmentId(9L); om.setUserStudent(other);
        List<AssessmentAnswer> all = new ArrayList<>(standard(DONE_OWN, YES));
        all.addAll(fx.completeAnswers(other, AGREE, OFTEN, CORRECT, DONE_OWN, NO, NO_FLAG, PASS, VALUES));
        when(answerRepository.findAllByAssessmentIdWithScores(9L)).thenReturn(all);
        when(mappingRepository.findAllByAssessmentId(9L)).thenReturn(List.of(mapping, om));
        when(mappingRepository.findCompletedForAssessment(9L)).thenReturn(List.of(mapping, om));

        NavigatorProRawExportService export = new NavigatorProRawExportService();
        ReflectionTestUtils.setField(export, "engine", service);
        ReflectionTestUtils.setField(export, "questionnaireQuestionRepository", questionnaireQuestionRepository);
        ReflectionTestUtils.setField(export, "mappingRepository", mappingRepository);

        byte[] bytes = export.export(9L, null);

        try (org.apache.poi.xssf.usermodel.XSSFWorkbook wb = new org.apache.poi.xssf.usermodel.XSSFWorkbook(new java.io.ByteArrayInputStream(bytes))) {
            assertThat(wb.getSheetName(0)).isEqualTo("Raw data");
            assertThat(wb.getSheetName(1)).isEqualTo("Item key");
            assertThat(wb.getSheetName(2)).isEqualTo("Matrices & settings");
            org.apache.poi.ss.usermodel.Sheet raw = wb.getSheetAt(0);
            Map<String, Integer> col = new java.util.HashMap<>();
            for (org.apache.poi.ss.usermodel.Cell c : raw.getRow(0)) col.put(c.getStringCellValue(), c.getColumnIndex());
            assertThat(raw.getLastRowNum()).isEqualTo(2);
            org.apache.poi.ss.usermodel.Row a = raw.getRow(1), w = raw.getRow(2);
            assertThat(a.getCell(col.get("Outcome (R1–R6)")).getStringCellValue()).isEqualTo("Generated");
            assertThat(a.getCell(col.get("Will (0–100)")).getNumericCellValue()).isEqualTo(75.0);
            assertThat(a.getCell(col.get("Everyday logic (n/5)")).getNumericCellValue()).isEqualTo(5.0);
            assertThat(a.getCell(col.get("Value rank 1")).getStringCellValue()).isEqualTo("Learning");
            assertThat(a.getCell(col.get("Rank 1")).getStringCellValue()).isEqualTo("Data & AI");
            assertThat(a.getCell(col.get("CareerScore: Data & AI")).getNumericCellValue()).isEqualTo(96.67);
            assertThat(a.getCell(col.get("Tie (<3)")).getStringCellValue()).isEqualTo("Yes");
            assertThat(a.getCell(col.get("Cohort n")).getNumericCellValue()).isEqualTo(1.0);   // the R3 student is not in the cohort
            assertThat(col).containsKeys("Σ Self-Motivation", "Exposure: Power & Energy", "Family: People-focused",
                    "Will percentile (internal)", "Sector: EV & Automotive*");
            assertThat(w.getCell(col.get("Outcome (R1–R6)")).getStringCellValue()).isEqualTo("R3 suppressed");
            assertThat(w.getCell(col.get("Family: Hands-on")).getNumericCellValue()).isZero();
            // one item column per scored question (90), keyed by the platform Excel header fallback
            assertThat(col.keySet().stream().filter(k -> k.startsWith("Q1")).count()).isEqualTo(90);
            assertThat(wb.getSheetAt(1).getLastRowNum()).isEqualTo(92);   // 90 scored + ranking + aspiration
        }
    }

    @Test
    void evaluate_neverThrows_andReportsTheOutcome() {
        NavigatorProQuestionnaireIndex ix = service.indexFor(9L);
        NavigatorProCalculationService.Evaluation ok = service.evaluate(5L, ix, standard(DONE_OWN, YES));
        assertThat(ok.outcome()).isEqualTo("Generated");
        NavigatorProCalculationService.Evaluation r3 = service.evaluate(5L, ix, standard(DONE_OWN, NO));
        assertThat(r3.outcome()).isEqualTo("R3 suppressed");
        assertThat(r3.blend).isNotNull();                             // still available for the raw export
    }
}
