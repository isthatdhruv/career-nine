package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.PrePersist;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "navigator_report_data")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class NavigatorReportData implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "navigator_report_data_id")
    private Long navigatorReportDataId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_student_id", referencedColumnName = "user_student_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private UserStudent userStudent;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    // ── Basic Student Info ──

    @Column(name = "student_name")
    private String studentName;

    @Column(name = "student_name_caps")
    private String studentNameCaps;

    @Column(name = "student_first_name")
    private String studentFirstName;

    @Column(name = "student_class")
    private String studentClass;

    @Column(name = "student_school")
    private String studentSchool;

    // ── Personality (Top 3) ──

    @Column(name = "personality_1_text", columnDefinition = "TEXT")
    private String personality1Text;

    @Column(name = "personality_1_image")
    private String personality1Image;

    @Column(name = "personality_2_text", columnDefinition = "TEXT")
    private String personality2Text;

    @Column(name = "personality_2_image")
    private String personality2Image;

    @Column(name = "personality_3_text", columnDefinition = "TEXT")
    private String personality3Text;

    @Column(name = "personality_3_image")
    private String personality3Image;

    @Column(name = "personality_graph", columnDefinition = "TEXT")
    private String personalityGraph;

    // ── Intelligence (Top 3) ──

    @Column(name = "intelligence_1_text", columnDefinition = "TEXT")
    private String intelligence1Text;

    @Column(name = "intelligence_1_image")
    private String intelligence1Image;

    @Column(name = "intelligence_2_text", columnDefinition = "TEXT")
    private String intelligence2Text;

    @Column(name = "intelligence_2_image")
    private String intelligence2Image;

    @Column(name = "intelligence_3_text", columnDefinition = "TEXT")
    private String intelligence3Text;

    @Column(name = "intelligence_3_image")
    private String intelligence3Image;

    @Column(name = "intelligence_graph", columnDefinition = "TEXT")
    private String intelligenceGraph;

    // ── Learning Styles ──

    @Column(name = "learning_style", columnDefinition = "TEXT")
    private String learningStyle;

    @Column(name = "learning_style_1")
    private String learningStyle1;

    @Column(name = "learning_style_2")
    private String learningStyle2;

    @Column(name = "learning_style_3")
    private String learningStyle3;

    @Column(name = "enjoys_with_1", columnDefinition = "TEXT")
    private String enjoysWith1;

    @Column(name = "enjoys_with_2", columnDefinition = "TEXT")
    private String enjoysWith2;

    @Column(name = "enjoys_with_3", columnDefinition = "TEXT")
    private String enjoysWith3;

    @Column(name = "struggles_with_1", columnDefinition = "TEXT")
    private String strugglesWith1;

    @Column(name = "struggles_with_2", columnDefinition = "TEXT")
    private String strugglesWith2;

    @Column(name = "struggles_with_3", columnDefinition = "TEXT")
    private String strugglesWith3;

    // ── Subjects of Interest ──

    @Column(name = "soi_1")
    private String soi1;

    @Column(name = "soi_2")
    private String soi2;

    @Column(name = "soi_3")
    private String soi3;

    @Column(name = "soi_4")
    private String soi4;

    @Column(name = "soi_5")
    private String soi5;

    // ── Values ──

    @Column(name = "values_1")
    private String values1;

    @Column(name = "values_2")
    private String values2;

    @Column(name = "values_3")
    private String values3;

    @Column(name = "values_4")
    private String values4;

    // ── Career Aspirations ──

    @Column(name = "career_asp_1")
    private String careerAsp1;

    @Column(name = "career_asp_2")
    private String careerAsp2;

    @Column(name = "career_asp_3")
    private String careerAsp3;

    @Column(name = "career_asp_4")
    private String careerAsp4;

    // ── Abilities (Top 4) ──

    @Column(name = "ability_1")
    private String ability1;

    @Column(name = "ability_2")
    private String ability2;

    @Column(name = "ability_3")
    private String ability3;

    @Column(name = "ability_4")
    private String ability4;

    // ── Career Pathways / Suitability Index (Top 9) ──

    @Column(name = "pathway_1")
    private String pathway1;

    @Column(name = "pathway_2")
    private String pathway2;

    @Column(name = "pathway_3")
    private String pathway3;

    @Column(name = "pathway_4")
    private String pathway4;

    @Column(name = "pathway_5")
    private String pathway5;

    @Column(name = "pathway_6")
    private String pathway6;

    @Column(name = "pathway_7")
    private String pathway7;

    @Column(name = "pathway_8")
    private String pathway8;

    @Column(name = "pathway_9")
    private String pathway9;

    // ── Pathway Detail Texts (Top 3) ──

    @Column(name = "pathway_1_text", columnDefinition = "TEXT")
    private String pathway1Text;

    @Column(name = "pathway_2_text", columnDefinition = "TEXT")
    private String pathway2Text;

    @Column(name = "pathway_3_text", columnDefinition = "TEXT")
    private String pathway3Text;

    // ── Career Pathway 1 Details ──

    @Column(name = "cp1_subjects", columnDefinition = "TEXT")
    private String cp1Subjects;

    @Column(name = "cp1_skills", columnDefinition = "TEXT")
    private String cp1Skills;

    @Column(name = "cp1_courses", columnDefinition = "TEXT")
    private String cp1Courses;

    @Column(name = "cp1_exams", columnDefinition = "TEXT")
    private String cp1Exams;

    @Column(name = "cp1_personality_has", columnDefinition = "TEXT")
    private String cp1PersonalityHas;

    @Column(name = "cp1_personality_lacks", columnDefinition = "TEXT")
    private String cp1PersonalityLacks;

    @Column(name = "cp1_intelligence_has", columnDefinition = "TEXT")
    private String cp1IntelligenceHas;

    @Column(name = "cp1_intelligence_lacks", columnDefinition = "TEXT")
    private String cp1IntelligenceLacks;

    @Column(name = "cp1_soi_has", columnDefinition = "TEXT")
    private String cp1SoiHas;

    @Column(name = "cp1_soi_lacks", columnDefinition = "TEXT")
    private String cp1SoiLacks;

    @Column(name = "cp1_ability_has", columnDefinition = "TEXT")
    private String cp1AbilityHas;

    @Column(name = "cp1_ability_lacks", columnDefinition = "TEXT")
    private String cp1AbilityLacks;

    @Column(name = "cp1_values_has", columnDefinition = "TEXT")
    private String cp1ValuesHas;

    @Column(name = "cp1_values_lacks", columnDefinition = "TEXT")
    private String cp1ValuesLacks;

    // ── Career Pathway 2 Details ──

    @Column(name = "cp2_subjects", columnDefinition = "TEXT")
    private String cp2Subjects;

    @Column(name = "cp2_skills", columnDefinition = "TEXT")
    private String cp2Skills;

    @Column(name = "cp2_courses", columnDefinition = "TEXT")
    private String cp2Courses;

    @Column(name = "cp2_exams", columnDefinition = "TEXT")
    private String cp2Exams;

    @Column(name = "cp2_personality_has", columnDefinition = "TEXT")
    private String cp2PersonalityHas;

    @Column(name = "cp2_personality_lacks", columnDefinition = "TEXT")
    private String cp2PersonalityLacks;

    @Column(name = "cp2_intelligence_has", columnDefinition = "TEXT")
    private String cp2IntelligenceHas;

    @Column(name = "cp2_intelligence_lacks", columnDefinition = "TEXT")
    private String cp2IntelligenceLacks;

    @Column(name = "cp2_soi_has", columnDefinition = "TEXT")
    private String cp2SoiHas;

    @Column(name = "cp2_soi_lacks", columnDefinition = "TEXT")
    private String cp2SoiLacks;

    @Column(name = "cp2_ability_has", columnDefinition = "TEXT")
    private String cp2AbilityHas;

    @Column(name = "cp2_ability_lacks", columnDefinition = "TEXT")
    private String cp2AbilityLacks;

    @Column(name = "cp2_values_has", columnDefinition = "TEXT")
    private String cp2ValuesHas;

    @Column(name = "cp2_values_lacks", columnDefinition = "TEXT")
    private String cp2ValuesLacks;

    // ── Career Pathway 3 Details ──

    @Column(name = "cp3_subjects", columnDefinition = "TEXT")
    private String cp3Subjects;

    @Column(name = "cp3_skills", columnDefinition = "TEXT")
    private String cp3Skills;

    @Column(name = "cp3_courses", columnDefinition = "TEXT")
    private String cp3Courses;

    @Column(name = "cp3_exams", columnDefinition = "TEXT")
    private String cp3Exams;

    @Column(name = "cp3_personality_has", columnDefinition = "TEXT")
    private String cp3PersonalityHas;

    @Column(name = "cp3_personality_lacks", columnDefinition = "TEXT")
    private String cp3PersonalityLacks;

    @Column(name = "cp3_intelligence_has", columnDefinition = "TEXT")
    private String cp3IntelligenceHas;

    @Column(name = "cp3_intelligence_lacks", columnDefinition = "TEXT")
    private String cp3IntelligenceLacks;

    @Column(name = "cp3_soi_has", columnDefinition = "TEXT")
    private String cp3SoiHas;

    @Column(name = "cp3_soi_lacks", columnDefinition = "TEXT")
    private String cp3SoiLacks;

    @Column(name = "cp3_ability_has", columnDefinition = "TEXT")
    private String cp3AbilityHas;

    @Column(name = "cp3_ability_lacks", columnDefinition = "TEXT")
    private String cp3AbilityLacks;

    @Column(name = "cp3_values_has", columnDefinition = "TEXT")
    private String cp3ValuesHas;

    @Column(name = "cp3_values_lacks", columnDefinition = "TEXT")
    private String cp3ValuesLacks;

    // ── Suggestions & Summaries ──

    @Column(name = "can_at_school", columnDefinition = "TEXT")
    private String canAtSchool;

    @Column(name = "can_at_home", columnDefinition = "TEXT")
    private String canAtHome;

    @Column(name = "summary", columnDefinition = "TEXT")
    private String summary;

    @Column(name = "learning_style_summary", columnDefinition = "TEXT")
    private String learningStyleSummary;

    @Column(name = "recommendations", columnDefinition = "TEXT")
    private String recommendations;

    @Column(name = "weak_ability")
    private String weakAbility;

    @Column(name = "career_match_result", columnDefinition = "TEXT")
    private String careerMatchResult;

    // ── Eligibility ──

    @Column(name = "eligible", nullable = false)
    private boolean eligible = true;

    @Column(name = "eligibility_issues", columnDefinition = "TEXT")
    private String eligibilityIssues;

    @Column(name = "data_significance", nullable = false)
    private String dataSignificance = "significant";

    // ── Report Status & URL ──

    @Column(name = "report_status", nullable = false)
    private String reportStatus = "notGenerated";

    @Column(name = "report_url")
    private String reportUrl;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = new Date();
    }

    // ── Getters & Setters ──

    public Long getNavigatorReportDataId() { return navigatorReportDataId; }
    public void setNavigatorReportDataId(Long navigatorReportDataId) { this.navigatorReportDataId = navigatorReportDataId; }

    public UserStudent getUserStudent() { return userStudent; }
    public void setUserStudent(UserStudent userStudent) { this.userStudent = userStudent; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getStudentNameCaps() { return studentNameCaps; }
    public void setStudentNameCaps(String studentNameCaps) { this.studentNameCaps = studentNameCaps; }

    public String getStudentFirstName() { return studentFirstName; }
    public void setStudentFirstName(String studentFirstName) { this.studentFirstName = studentFirstName; }

    public String getStudentClass() { return studentClass; }
    public void setStudentClass(String studentClass) { this.studentClass = studentClass; }

    public String getStudentSchool() { return studentSchool; }
    public void setStudentSchool(String studentSchool) { this.studentSchool = studentSchool; }

    public String getPersonality1Text() { return personality1Text; }
    public void setPersonality1Text(String personality1Text) { this.personality1Text = personality1Text; }

    public String getPersonality1Image() { return personality1Image; }
    public void setPersonality1Image(String personality1Image) { this.personality1Image = personality1Image; }

    public String getPersonality2Text() { return personality2Text; }
    public void setPersonality2Text(String personality2Text) { this.personality2Text = personality2Text; }

    public String getPersonality2Image() { return personality2Image; }
    public void setPersonality2Image(String personality2Image) { this.personality2Image = personality2Image; }

    public String getPersonality3Text() { return personality3Text; }
    public void setPersonality3Text(String personality3Text) { this.personality3Text = personality3Text; }

    public String getPersonality3Image() { return personality3Image; }
    public void setPersonality3Image(String personality3Image) { this.personality3Image = personality3Image; }

    public String getPersonalityGraph() { return personalityGraph; }
    public void setPersonalityGraph(String personalityGraph) { this.personalityGraph = personalityGraph; }

    public String getIntelligence1Text() { return intelligence1Text; }
    public void setIntelligence1Text(String intelligence1Text) { this.intelligence1Text = intelligence1Text; }

    public String getIntelligence1Image() { return intelligence1Image; }
    public void setIntelligence1Image(String intelligence1Image) { this.intelligence1Image = intelligence1Image; }

    public String getIntelligence2Text() { return intelligence2Text; }
    public void setIntelligence2Text(String intelligence2Text) { this.intelligence2Text = intelligence2Text; }

    public String getIntelligence2Image() { return intelligence2Image; }
    public void setIntelligence2Image(String intelligence2Image) { this.intelligence2Image = intelligence2Image; }

    public String getIntelligence3Text() { return intelligence3Text; }
    public void setIntelligence3Text(String intelligence3Text) { this.intelligence3Text = intelligence3Text; }

    public String getIntelligence3Image() { return intelligence3Image; }
    public void setIntelligence3Image(String intelligence3Image) { this.intelligence3Image = intelligence3Image; }

    public String getIntelligenceGraph() { return intelligenceGraph; }
    public void setIntelligenceGraph(String intelligenceGraph) { this.intelligenceGraph = intelligenceGraph; }

    public String getLearningStyle() { return learningStyle; }
    public void setLearningStyle(String learningStyle) { this.learningStyle = learningStyle; }

    public String getLearningStyle1() { return learningStyle1; }
    public void setLearningStyle1(String learningStyle1) { this.learningStyle1 = learningStyle1; }

    public String getLearningStyle2() { return learningStyle2; }
    public void setLearningStyle2(String learningStyle2) { this.learningStyle2 = learningStyle2; }

    public String getLearningStyle3() { return learningStyle3; }
    public void setLearningStyle3(String learningStyle3) { this.learningStyle3 = learningStyle3; }

    public String getEnjoysWith1() { return enjoysWith1; }
    public void setEnjoysWith1(String enjoysWith1) { this.enjoysWith1 = enjoysWith1; }

    public String getEnjoysWith2() { return enjoysWith2; }
    public void setEnjoysWith2(String enjoysWith2) { this.enjoysWith2 = enjoysWith2; }

    public String getEnjoysWith3() { return enjoysWith3; }
    public void setEnjoysWith3(String enjoysWith3) { this.enjoysWith3 = enjoysWith3; }

    public String getStrugglesWith1() { return strugglesWith1; }
    public void setStrugglesWith1(String strugglesWith1) { this.strugglesWith1 = strugglesWith1; }

    public String getStrugglesWith2() { return strugglesWith2; }
    public void setStrugglesWith2(String strugglesWith2) { this.strugglesWith2 = strugglesWith2; }

    public String getStrugglesWith3() { return strugglesWith3; }
    public void setStrugglesWith3(String strugglesWith3) { this.strugglesWith3 = strugglesWith3; }

    public String getSoi1() { return soi1; }
    public void setSoi1(String soi1) { this.soi1 = soi1; }

    public String getSoi2() { return soi2; }
    public void setSoi2(String soi2) { this.soi2 = soi2; }

    public String getSoi3() { return soi3; }
    public void setSoi3(String soi3) { this.soi3 = soi3; }

    public String getSoi4() { return soi4; }
    public void setSoi4(String soi4) { this.soi4 = soi4; }

    public String getSoi5() { return soi5; }
    public void setSoi5(String soi5) { this.soi5 = soi5; }

    public String getValues1() { return values1; }
    public void setValues1(String values1) { this.values1 = values1; }

    public String getValues2() { return values2; }
    public void setValues2(String values2) { this.values2 = values2; }

    public String getValues3() { return values3; }
    public void setValues3(String values3) { this.values3 = values3; }

    public String getValues4() { return values4; }
    public void setValues4(String values4) { this.values4 = values4; }

    public String getCareerAsp1() { return careerAsp1; }
    public void setCareerAsp1(String careerAsp1) { this.careerAsp1 = careerAsp1; }

    public String getCareerAsp2() { return careerAsp2; }
    public void setCareerAsp2(String careerAsp2) { this.careerAsp2 = careerAsp2; }

    public String getCareerAsp3() { return careerAsp3; }
    public void setCareerAsp3(String careerAsp3) { this.careerAsp3 = careerAsp3; }

    public String getCareerAsp4() { return careerAsp4; }
    public void setCareerAsp4(String careerAsp4) { this.careerAsp4 = careerAsp4; }

    public String getAbility1() { return ability1; }
    public void setAbility1(String ability1) { this.ability1 = ability1; }

    public String getAbility2() { return ability2; }
    public void setAbility2(String ability2) { this.ability2 = ability2; }

    public String getAbility3() { return ability3; }
    public void setAbility3(String ability3) { this.ability3 = ability3; }

    public String getAbility4() { return ability4; }
    public void setAbility4(String ability4) { this.ability4 = ability4; }

    public String getPathway1() { return pathway1; }
    public void setPathway1(String pathway1) { this.pathway1 = pathway1; }

    public String getPathway2() { return pathway2; }
    public void setPathway2(String pathway2) { this.pathway2 = pathway2; }

    public String getPathway3() { return pathway3; }
    public void setPathway3(String pathway3) { this.pathway3 = pathway3; }

    public String getPathway4() { return pathway4; }
    public void setPathway4(String pathway4) { this.pathway4 = pathway4; }

    public String getPathway5() { return pathway5; }
    public void setPathway5(String pathway5) { this.pathway5 = pathway5; }

    public String getPathway6() { return pathway6; }
    public void setPathway6(String pathway6) { this.pathway6 = pathway6; }

    public String getPathway7() { return pathway7; }
    public void setPathway7(String pathway7) { this.pathway7 = pathway7; }

    public String getPathway8() { return pathway8; }
    public void setPathway8(String pathway8) { this.pathway8 = pathway8; }

    public String getPathway9() { return pathway9; }
    public void setPathway9(String pathway9) { this.pathway9 = pathway9; }

    public String getPathway1Text() { return pathway1Text; }
    public void setPathway1Text(String pathway1Text) { this.pathway1Text = pathway1Text; }

    public String getPathway2Text() { return pathway2Text; }
    public void setPathway2Text(String pathway2Text) { this.pathway2Text = pathway2Text; }

    public String getPathway3Text() { return pathway3Text; }
    public void setPathway3Text(String pathway3Text) { this.pathway3Text = pathway3Text; }

    public String getCp1Subjects() { return cp1Subjects; }
    public void setCp1Subjects(String cp1Subjects) { this.cp1Subjects = cp1Subjects; }

    public String getCp1Skills() { return cp1Skills; }
    public void setCp1Skills(String cp1Skills) { this.cp1Skills = cp1Skills; }

    public String getCp1Courses() { return cp1Courses; }
    public void setCp1Courses(String cp1Courses) { this.cp1Courses = cp1Courses; }

    public String getCp1Exams() { return cp1Exams; }
    public void setCp1Exams(String cp1Exams) { this.cp1Exams = cp1Exams; }

    public String getCp1PersonalityHas() { return cp1PersonalityHas; }
    public void setCp1PersonalityHas(String cp1PersonalityHas) { this.cp1PersonalityHas = cp1PersonalityHas; }

    public String getCp1PersonalityLacks() { return cp1PersonalityLacks; }
    public void setCp1PersonalityLacks(String cp1PersonalityLacks) { this.cp1PersonalityLacks = cp1PersonalityLacks; }

    public String getCp1IntelligenceHas() { return cp1IntelligenceHas; }
    public void setCp1IntelligenceHas(String cp1IntelligenceHas) { this.cp1IntelligenceHas = cp1IntelligenceHas; }

    public String getCp1IntelligenceLacks() { return cp1IntelligenceLacks; }
    public void setCp1IntelligenceLacks(String cp1IntelligenceLacks) { this.cp1IntelligenceLacks = cp1IntelligenceLacks; }

    public String getCp1SoiHas() { return cp1SoiHas; }
    public void setCp1SoiHas(String cp1SoiHas) { this.cp1SoiHas = cp1SoiHas; }

    public String getCp1SoiLacks() { return cp1SoiLacks; }
    public void setCp1SoiLacks(String cp1SoiLacks) { this.cp1SoiLacks = cp1SoiLacks; }

    public String getCp1AbilityHas() { return cp1AbilityHas; }
    public void setCp1AbilityHas(String cp1AbilityHas) { this.cp1AbilityHas = cp1AbilityHas; }

    public String getCp1AbilityLacks() { return cp1AbilityLacks; }
    public void setCp1AbilityLacks(String cp1AbilityLacks) { this.cp1AbilityLacks = cp1AbilityLacks; }

    public String getCp1ValuesHas() { return cp1ValuesHas; }
    public void setCp1ValuesHas(String cp1ValuesHas) { this.cp1ValuesHas = cp1ValuesHas; }

    public String getCp1ValuesLacks() { return cp1ValuesLacks; }
    public void setCp1ValuesLacks(String cp1ValuesLacks) { this.cp1ValuesLacks = cp1ValuesLacks; }

    public String getCp2Subjects() { return cp2Subjects; }
    public void setCp2Subjects(String cp2Subjects) { this.cp2Subjects = cp2Subjects; }

    public String getCp2Skills() { return cp2Skills; }
    public void setCp2Skills(String cp2Skills) { this.cp2Skills = cp2Skills; }

    public String getCp2Courses() { return cp2Courses; }
    public void setCp2Courses(String cp2Courses) { this.cp2Courses = cp2Courses; }

    public String getCp2Exams() { return cp2Exams; }
    public void setCp2Exams(String cp2Exams) { this.cp2Exams = cp2Exams; }

    public String getCp2PersonalityHas() { return cp2PersonalityHas; }
    public void setCp2PersonalityHas(String cp2PersonalityHas) { this.cp2PersonalityHas = cp2PersonalityHas; }

    public String getCp2PersonalityLacks() { return cp2PersonalityLacks; }
    public void setCp2PersonalityLacks(String cp2PersonalityLacks) { this.cp2PersonalityLacks = cp2PersonalityLacks; }

    public String getCp2IntelligenceHas() { return cp2IntelligenceHas; }
    public void setCp2IntelligenceHas(String cp2IntelligenceHas) { this.cp2IntelligenceHas = cp2IntelligenceHas; }

    public String getCp2IntelligenceLacks() { return cp2IntelligenceLacks; }
    public void setCp2IntelligenceLacks(String cp2IntelligenceLacks) { this.cp2IntelligenceLacks = cp2IntelligenceLacks; }

    public String getCp2SoiHas() { return cp2SoiHas; }
    public void setCp2SoiHas(String cp2SoiHas) { this.cp2SoiHas = cp2SoiHas; }

    public String getCp2SoiLacks() { return cp2SoiLacks; }
    public void setCp2SoiLacks(String cp2SoiLacks) { this.cp2SoiLacks = cp2SoiLacks; }

    public String getCp2AbilityHas() { return cp2AbilityHas; }
    public void setCp2AbilityHas(String cp2AbilityHas) { this.cp2AbilityHas = cp2AbilityHas; }

    public String getCp2AbilityLacks() { return cp2AbilityLacks; }
    public void setCp2AbilityLacks(String cp2AbilityLacks) { this.cp2AbilityLacks = cp2AbilityLacks; }

    public String getCp2ValuesHas() { return cp2ValuesHas; }
    public void setCp2ValuesHas(String cp2ValuesHas) { this.cp2ValuesHas = cp2ValuesHas; }

    public String getCp2ValuesLacks() { return cp2ValuesLacks; }
    public void setCp2ValuesLacks(String cp2ValuesLacks) { this.cp2ValuesLacks = cp2ValuesLacks; }

    public String getCp3Subjects() { return cp3Subjects; }
    public void setCp3Subjects(String cp3Subjects) { this.cp3Subjects = cp3Subjects; }

    public String getCp3Skills() { return cp3Skills; }
    public void setCp3Skills(String cp3Skills) { this.cp3Skills = cp3Skills; }

    public String getCp3Courses() { return cp3Courses; }
    public void setCp3Courses(String cp3Courses) { this.cp3Courses = cp3Courses; }

    public String getCp3Exams() { return cp3Exams; }
    public void setCp3Exams(String cp3Exams) { this.cp3Exams = cp3Exams; }

    public String getCp3PersonalityHas() { return cp3PersonalityHas; }
    public void setCp3PersonalityHas(String cp3PersonalityHas) { this.cp3PersonalityHas = cp3PersonalityHas; }

    public String getCp3PersonalityLacks() { return cp3PersonalityLacks; }
    public void setCp3PersonalityLacks(String cp3PersonalityLacks) { this.cp3PersonalityLacks = cp3PersonalityLacks; }

    public String getCp3IntelligenceHas() { return cp3IntelligenceHas; }
    public void setCp3IntelligenceHas(String cp3IntelligenceHas) { this.cp3IntelligenceHas = cp3IntelligenceHas; }

    public String getCp3IntelligenceLacks() { return cp3IntelligenceLacks; }
    public void setCp3IntelligenceLacks(String cp3IntelligenceLacks) { this.cp3IntelligenceLacks = cp3IntelligenceLacks; }

    public String getCp3SoiHas() { return cp3SoiHas; }
    public void setCp3SoiHas(String cp3SoiHas) { this.cp3SoiHas = cp3SoiHas; }

    public String getCp3SoiLacks() { return cp3SoiLacks; }
    public void setCp3SoiLacks(String cp3SoiLacks) { this.cp3SoiLacks = cp3SoiLacks; }

    public String getCp3AbilityHas() { return cp3AbilityHas; }
    public void setCp3AbilityHas(String cp3AbilityHas) { this.cp3AbilityHas = cp3AbilityHas; }

    public String getCp3AbilityLacks() { return cp3AbilityLacks; }
    public void setCp3AbilityLacks(String cp3AbilityLacks) { this.cp3AbilityLacks = cp3AbilityLacks; }

    public String getCp3ValuesHas() { return cp3ValuesHas; }
    public void setCp3ValuesHas(String cp3ValuesHas) { this.cp3ValuesHas = cp3ValuesHas; }

    public String getCp3ValuesLacks() { return cp3ValuesLacks; }
    public void setCp3ValuesLacks(String cp3ValuesLacks) { this.cp3ValuesLacks = cp3ValuesLacks; }

    public String getCanAtSchool() { return canAtSchool; }
    public void setCanAtSchool(String canAtSchool) { this.canAtSchool = canAtSchool; }

    public String getCanAtHome() { return canAtHome; }
    public void setCanAtHome(String canAtHome) { this.canAtHome = canAtHome; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public String getLearningStyleSummary() { return learningStyleSummary; }
    public void setLearningStyleSummary(String learningStyleSummary) { this.learningStyleSummary = learningStyleSummary; }

    public String getRecommendations() { return recommendations; }
    public void setRecommendations(String recommendations) { this.recommendations = recommendations; }

    public String getWeakAbility() { return weakAbility; }
    public void setWeakAbility(String weakAbility) { this.weakAbility = weakAbility; }

    public String getCareerMatchResult() { return careerMatchResult; }
    public void setCareerMatchResult(String careerMatchResult) { this.careerMatchResult = careerMatchResult; }

    public boolean isEligible() { return eligible; }
    public void setEligible(boolean eligible) { this.eligible = eligible; }

    public String getEligibilityIssues() { return eligibilityIssues; }
    public void setEligibilityIssues(String eligibilityIssues) { this.eligibilityIssues = eligibilityIssues; }

    public String getDataSignificance() { return dataSignificance; }
    public void setDataSignificance(String dataSignificance) { this.dataSignificance = dataSignificance; }

    public String getReportStatus() { return reportStatus; }
    public void setReportStatus(String reportStatus) { this.reportStatus = reportStatus; }

    public String getReportUrl() { return reportUrl; }
    public void setReportUrl(String reportUrl) { this.reportUrl = reportUrl; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
}
