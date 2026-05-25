package com.kccitm.api.model.career9;

import java.io.Serializable;
import java.time.LocalDateTime;

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

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "general_assessment_result")
@JsonIgnoreProperties(ignoreUnknown = true)
public class GeneralAssessmentResult implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_assessment_mapping_id", referencedColumnName = "student_assessment_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private StudentAssessmentMapping studentAssessmentMapping;

    @Column(name = "user_student_id", nullable = false)
    private Long userStudentId;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @Column(name = "class_group", length = 10)
    private String classGroup;

    @Column(name = "student_class")
    private Integer studentClass;

    // --- PERSONALITY (RIASEC) ---
    @Column(name = "personality_scores", columnDefinition = "TEXT")
    private String personalityScores; // JSON: {"Realistic": {"raw": 15, "stanine": 3}, ...}

    @Column(name = "personality_top1", length = 50)
    private String personalityTop1;

    @Column(name = "personality_top2", length = 50)
    private String personalityTop2;

    @Column(name = "personality_top3", length = 50)
    private String personalityTop3;

    @Column(name = "personality_profiles", columnDefinition = "TEXT")
    private String personalityProfiles; // JSON: [{name, title, description, image}, ...]

    // --- INTELLIGENCE (8 types) ---
    @Column(name = "intelligence_scores", columnDefinition = "TEXT")
    private String intelligenceScores; // JSON: {"Bodily-Kinesthetic": 7, ...}

    @Column(name = "intelligence_top1", length = 50)
    private String intelligenceTop1;

    @Column(name = "intelligence_top2", length = 50)
    private String intelligenceTop2;

    @Column(name = "intelligence_top3", length = 50)
    private String intelligenceTop3;

    @Column(name = "intelligence_profiles", columnDefinition = "TEXT")
    private String intelligenceProfiles; // JSON: [{name, title, description, image}, ...]

    // --- ABILITIES (10 types) ---
    @Column(name = "ability_scores", columnDefinition = "TEXT")
    private String abilityScores; // JSON: {"Communication": 8, "Creativity": 6, ...}

    @Column(name = "ability_top1", length = 80)
    private String abilityTop1;

    @Column(name = "ability_top2", length = 80)
    private String abilityTop2;

    @Column(name = "ability_top3", length = 80)
    private String abilityTop3;

    @Column(name = "ability_top4", length = 80)
    private String abilityTop4;

    @Column(name = "ability_top5", length = 80)
    private String abilityTop5;

    @Column(name = "weak_ability", length = 80)
    private String weakAbility;

    @Column(name = "weak_ability_recommendations", columnDefinition = "TEXT")
    private String weakAbilityRecommendations;

    // --- LEARNING STYLES ---
    @Column(name = "learning_styles", columnDefinition = "TEXT")
    private String learningStyles; // JSON: [{style, enjoys, struggles}, ...]

    // --- CAREER PATHWAYS ---
    @Column(name = "suitability_pathways", columnDefinition = "TEXT")
    private String suitabilityPathways; // JSON: [{rank, name, description, subjects, skills, courses, exams, hasLacks}, ...]

    @Column(name = "career_match_result", columnDefinition = "TEXT")
    private String careerMatchResult;

    // --- PREFERENCES (from answers) ---
    @Column(name = "subjects_of_interest", columnDefinition = "TEXT")
    private String subjectsOfInterest; // JSON array of SOI names

    @Column(name = "career_aspirations", columnDefinition = "TEXT")
    private String careerAspirations; // JSON array of aspiration names

    @Column(name = "student_values", columnDefinition = "TEXT")
    private String studentValues; // JSON array of value names

    // --- AI GENERATED ---
    @Column(name = "ai_summary", columnDefinition = "TEXT")
    private String aiSummary;

    @Column(name = "learning_style_summary", columnDefinition = "TEXT")
    private String learningSummary;

    // --- ENRICHED FROM JSON ---
    @Column(name = "future_suggestions", columnDefinition = "TEXT")
    private String futureSuggestions; // JSON: {atSchool, atHome}

    // --- ELIGIBILITY ---
    @Column(name = "eligibility_status", length = 20)
    private String eligibilityStatus;

    @Column(name = "eligibility_issues", columnDefinition = "TEXT")
    private String eligibilityIssues;

    // --- METADATA ---
    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    @PrePersist
    public void prePersist() {
        if (this.processedAt == null) {
            this.processedAt = LocalDateTime.now();
        }
    }

    public GeneralAssessmentResult() {
    }

    // --- GETTERS AND SETTERS ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public StudentAssessmentMapping getStudentAssessmentMapping() { return studentAssessmentMapping; }
    public void setStudentAssessmentMapping(StudentAssessmentMapping studentAssessmentMapping) { this.studentAssessmentMapping = studentAssessmentMapping; }

    public Long getUserStudentId() { return userStudentId; }
    public void setUserStudentId(Long userStudentId) { this.userStudentId = userStudentId; }

    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long assessmentId) { this.assessmentId = assessmentId; }

    public String getClassGroup() { return classGroup; }
    public void setClassGroup(String classGroup) { this.classGroup = classGroup; }

    public Integer getStudentClass() { return studentClass; }
    public void setStudentClass(Integer studentClass) { this.studentClass = studentClass; }

    public String getPersonalityScores() { return personalityScores; }
    public void setPersonalityScores(String personalityScores) { this.personalityScores = personalityScores; }

    public String getPersonalityTop1() { return personalityTop1; }
    public void setPersonalityTop1(String personalityTop1) { this.personalityTop1 = personalityTop1; }

    public String getPersonalityTop2() { return personalityTop2; }
    public void setPersonalityTop2(String personalityTop2) { this.personalityTop2 = personalityTop2; }

    public String getPersonalityTop3() { return personalityTop3; }
    public void setPersonalityTop3(String personalityTop3) { this.personalityTop3 = personalityTop3; }

    public String getPersonalityProfiles() { return personalityProfiles; }
    public void setPersonalityProfiles(String personalityProfiles) { this.personalityProfiles = personalityProfiles; }

    public String getIntelligenceScores() { return intelligenceScores; }
    public void setIntelligenceScores(String intelligenceScores) { this.intelligenceScores = intelligenceScores; }

    public String getIntelligenceTop1() { return intelligenceTop1; }
    public void setIntelligenceTop1(String intelligenceTop1) { this.intelligenceTop1 = intelligenceTop1; }

    public String getIntelligenceTop2() { return intelligenceTop2; }
    public void setIntelligenceTop2(String intelligenceTop2) { this.intelligenceTop2 = intelligenceTop2; }

    public String getIntelligenceTop3() { return intelligenceTop3; }
    public void setIntelligenceTop3(String intelligenceTop3) { this.intelligenceTop3 = intelligenceTop3; }

    public String getIntelligenceProfiles() { return intelligenceProfiles; }
    public void setIntelligenceProfiles(String intelligenceProfiles) { this.intelligenceProfiles = intelligenceProfiles; }

    public String getAbilityScores() { return abilityScores; }
    public void setAbilityScores(String abilityScores) { this.abilityScores = abilityScores; }

    public String getAbilityTop1() { return abilityTop1; }
    public void setAbilityTop1(String abilityTop1) { this.abilityTop1 = abilityTop1; }

    public String getAbilityTop2() { return abilityTop2; }
    public void setAbilityTop2(String abilityTop2) { this.abilityTop2 = abilityTop2; }

    public String getAbilityTop3() { return abilityTop3; }
    public void setAbilityTop3(String abilityTop3) { this.abilityTop3 = abilityTop3; }

    public String getAbilityTop4() { return abilityTop4; }
    public void setAbilityTop4(String abilityTop4) { this.abilityTop4 = abilityTop4; }

    public String getAbilityTop5() { return abilityTop5; }
    public void setAbilityTop5(String abilityTop5) { this.abilityTop5 = abilityTop5; }

    public String getWeakAbility() { return weakAbility; }
    public void setWeakAbility(String weakAbility) { this.weakAbility = weakAbility; }

    public String getWeakAbilityRecommendations() { return weakAbilityRecommendations; }
    public void setWeakAbilityRecommendations(String weakAbilityRecommendations) { this.weakAbilityRecommendations = weakAbilityRecommendations; }

    public String getLearningStyles() { return learningStyles; }
    public void setLearningStyles(String learningStyles) { this.learningStyles = learningStyles; }

    public String getSuitabilityPathways() { return suitabilityPathways; }
    public void setSuitabilityPathways(String suitabilityPathways) { this.suitabilityPathways = suitabilityPathways; }

    public String getCareerMatchResult() { return careerMatchResult; }
    public void setCareerMatchResult(String careerMatchResult) { this.careerMatchResult = careerMatchResult; }

    public String getSubjectsOfInterest() { return subjectsOfInterest; }
    public void setSubjectsOfInterest(String subjectsOfInterest) { this.subjectsOfInterest = subjectsOfInterest; }

    public String getCareerAspirations() { return careerAspirations; }
    public void setCareerAspirations(String careerAspirations) { this.careerAspirations = careerAspirations; }

    public String getStudentValues() { return studentValues; }
    public void setStudentValues(String studentValues) { this.studentValues = studentValues; }

    public String getAiSummary() { return aiSummary; }
    public void setAiSummary(String aiSummary) { this.aiSummary = aiSummary; }

    public String getLearningSummary() { return learningSummary; }
    public void setLearningSummary(String learningSummary) { this.learningSummary = learningSummary; }

    public String getFutureSuggestions() { return futureSuggestions; }
    public void setFutureSuggestions(String futureSuggestions) { this.futureSuggestions = futureSuggestions; }

    public String getEligibilityStatus() { return eligibilityStatus; }
    public void setEligibilityStatus(String eligibilityStatus) { this.eligibilityStatus = eligibilityStatus; }

    public String getEligibilityIssues() { return eligibilityIssues; }
    public void setEligibilityIssues(String eligibilityIssues) { this.eligibilityIssues = eligibilityIssues; }

    public LocalDateTime getProcessedAt() { return processedAt; }
    public void setProcessedAt(LocalDateTime processedAt) { this.processedAt = processedAt; }
}
