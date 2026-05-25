package com.kccitm.api.service.dashboard;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentRawScore;
import com.kccitm.api.model.career9.AssessmentTable;
import com.kccitm.api.model.career9.Career;
import com.kccitm.api.model.career9.MeasuredQualities;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.userDefinedModel.StudentDashboardResponse;
import com.kccitm.api.model.userDefinedModel.StudentDashboardResponse.*;
import com.kccitm.api.model.userDefinedModel.StudentPortalComputedData;
import com.kccitm.api.model.userDefinedModel.StudentPortalComputedData.*;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.AssessmentTableRepository;
import com.kccitm.api.repository.Career9.CareerRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

/**
 * Service to build StudentDashboardResponse data for a given userStudentId.
 * Extracted from AssessmentAnswerController to be reusable across controllers.
 */
@Service
public class StudentDashboardDataService {

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private AssessmentTableRepository assessmentTableRepository;

    @Autowired
    private AssessmentAnswerRepository assessmentAnswerRepository;

    @Autowired
    private AssessmentRawScoreRepository assessmentRawScoreRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    @Autowired
    private CareerRepository careerRepository;

    // Pillar name keywords for mapping MeasuredQuality names to the 6 pillars
    private static final Map<String, List<String>> PILLAR_KEYWORDS = new HashMap<>();
    static {
        PILLAR_KEYWORDS.put("Career Personality", Arrays.asList("personality", "career personality", "holland", "riasec"));
        PILLAR_KEYWORDS.put("Learning Styles", Arrays.asList("learning", "multiple intelligence", "mi", "gardner"));
        PILLAR_KEYWORDS.put("Ability", Arrays.asList("ability", "cognitive", "aptitude", "computational", "reasoning"));
        PILLAR_KEYWORDS.put("Values", Arrays.asList("values", "value"));
        PILLAR_KEYWORDS.put("Subjects Interest", Arrays.asList("subject", "interest"));
        PILLAR_KEYWORDS.put("Aspirations", Arrays.asList("aspiration", "career aspiration", "goal"));
    }

    /**
     * Build the complete StudentDashboardResponse for a given userStudentId.
     * This is the same logic previously in AssessmentAnswerController's /dashboard endpoint.
     */
    @Transactional
    public StudentDashboardResponse buildDashboardData(Long userStudentId) {
        UserStudent userStudent = userStudentRepository.findById(userStudentId)
                .orElseThrow(() -> new RuntimeException("UserStudent not found with ID: " + userStudentId));

        // Build student basic info
        StudentBasicInfo studentInfo = new StudentBasicInfo();
        studentInfo.setUserStudentId(userStudent.getUserStudentId());
        studentInfo.setUserId(userStudent.getUserId());

        if (userStudent.getInstitute() != null) {
            studentInfo.setInstituteName(userStudent.getInstitute().getInstituteName());
            studentInfo.setInstituteCode(userStudent.getInstitute().getInstituteCode());
        }

        // Fetch all assessments for this student
        List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                .findByUserStudentUserStudentId(userStudentId);

        List<AssessmentData> assessmentDataList = new ArrayList<>();

        for (StudentAssessmentMapping mapping : mappings) {
            Long assessmentId = mapping.getAssessmentId();
            AssessmentTable assessment = assessmentTableRepository.findById(assessmentId).orElse(null);
            if (assessment == null) continue;

            AssessmentData assessmentData = new AssessmentData();
            assessmentData.setAssessmentId(assessmentId);
            assessmentData.setAssessmentName(assessment.getAssessmentName());
            assessmentData.setStatus(mapping.getStatus());
            assessmentData.setIsActive(assessment.getIsActive());
            assessmentData.setStartDate(assessment.getStarDate());
            assessmentData.setEndDate(assessment.getEndDate());
            assessmentData.setStudentAssessmentMappingId(mapping.getStudentAssessmentId());

            if (assessment.getQuestionnaire() != null) {
                assessmentData.setQuestionnaireType(assessment.getQuestionnaire().getType());
            }

            // Fetch answers
            ArrayList<AssessmentAnswer> answers = assessmentAnswerRepository
                    .findByUserStudentIdAndAssessmentIdWithDetails(userStudentId, assessmentId);

            List<AnswerDetail> answerDetails = new ArrayList<>();
            for (AssessmentAnswer answer : answers) {
                AnswerDetail answerDetail = new AnswerDetail();
                answerDetail.setAssessmentAnswerId(answer.getAssessmentAnswerId());

                if (answer.getQuestionnaireQuestion() != null) {
                    answerDetail.setQuestionnaireQuestionId(
                            answer.getQuestionnaireQuestion().getQuestionnaireQuestionId());
                }
                answerDetail.setRankOrder(answer.getRankOrder());
                if (answer.getTextResponse() != null) {
                    answerDetail.setTextResponse(answer.getTextResponse());
                }

                AssessmentQuestionOptions effectiveOption = answer.getOption() != null
                        ? answer.getOption()
                        : answer.getMappedOption();
                if (effectiveOption != null) {
                    OptionData optionData = new OptionData();
                    optionData.setOptionId(effectiveOption.getOptionId());
                    optionData.setOptionText(effectiveOption.getOptionText());
                    optionData.setOptionDescription(effectiveOption.getOptionDescription());
                    optionData.setIsCorrect(effectiveOption.isCorrect());

                    List<OptionScoreBasedOnMEasuredQualityTypes> optionScores = effectiveOption.getOptionScores();
                    List<MQTScore> mqtScores = new ArrayList<>();

                    if (optionScores != null) {
                        for (OptionScoreBasedOnMEasuredQualityTypes optionScore : optionScores) {
                            MQTScore mqtScore = new MQTScore();
                            mqtScore.setScoreId(optionScore.getScoreId());
                            mqtScore.setScore(optionScore.getScore());

                            if (optionScore.getMeasuredQualityType() != null) {
                                MeasuredQualityTypes mqt = optionScore.getMeasuredQualityType();
                                MQTData mqtData = new MQTData();
                                mqtData.setMeasuredQualityTypeId(mqt.getMeasuredQualityTypeId());
                                mqtData.setName(mqt.getMeasuredQualityTypeName());
                                mqtData.setDescription(mqt.getMeasuredQualityTypeDescription());
                                mqtData.setDisplayName(mqt.getMeasuredQualityTypeDisplayName());

                                if (mqt.getMeasuredQuality() != null) {
                                    MeasuredQualities mq = mqt.getMeasuredQuality();
                                    MQData mqData = new MQData();
                                    mqData.setMeasuredQualityId(mq.getMeasuredQualityId());
                                    mqData.setName(mq.getMeasuredQualityName());
                                    mqData.setDescription(mq.getMeasuredQualityDescription());
                                    mqData.setDisplayName(mq.getQualityDisplayName());
                                    mqtData.setMeasuredQuality(mqData);
                                }

                                mqtScore.setMeasuredQualityType(mqtData);
                            }
                            mqtScores.add(mqtScore);
                        }
                    }

                    optionData.setMqtScores(mqtScores);
                    answerDetail.setSelectedOption(optionData);
                }

                answerDetails.add(answerDetail);
            }

            assessmentData.setAnswers(answerDetails);

            // Fetch raw scores
            List<AssessmentRawScore> rawScores = assessmentRawScoreRepository
                    .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId());

            List<RawScoreData> rawScoreDataList = new ArrayList<>();
            for (AssessmentRawScore rawScore : rawScores) {
                RawScoreData rawScoreData = new RawScoreData();
                rawScoreData.setAssessmentRawScoreId(rawScore.getAssessmentRawScoreId());
                rawScoreData.setRawScore(rawScore.getRawScore());

                if (rawScore.getMeasuredQualityType() != null) {
                    MeasuredQualityTypes mqt = rawScore.getMeasuredQualityType();
                    MQTData mqtData = new MQTData();
                    mqtData.setMeasuredQualityTypeId(mqt.getMeasuredQualityTypeId());
                    mqtData.setName(mqt.getMeasuredQualityTypeName());
                    mqtData.setDescription(mqt.getMeasuredQualityTypeDescription());
                    mqtData.setDisplayName(mqt.getMeasuredQualityTypeDisplayName());

                    if (mqt.getMeasuredQuality() != null) {
                        MeasuredQualities mq = mqt.getMeasuredQuality();
                        MQData mqData = new MQData();
                        mqData.setMeasuredQualityId(mq.getMeasuredQualityId());
                        mqData.setName(mq.getMeasuredQualityName());
                        mqData.setDescription(mq.getMeasuredQualityDescription());
                        mqData.setDisplayName(mq.getQualityDisplayName());
                        mqtData.setMeasuredQuality(mqData);
                    }

                    rawScoreData.setMeasuredQualityType(mqtData);
                }

                if (rawScore.getMeasuredQuality() != null) {
                    MeasuredQualities mq = rawScore.getMeasuredQuality();
                    MQData mqData = new MQData();
                    mqData.setMeasuredQualityId(mq.getMeasuredQualityId());
                    mqData.setName(mq.getMeasuredQualityName());
                    mqData.setDescription(mq.getMeasuredQualityDescription());
                    mqData.setDisplayName(mq.getQualityDisplayName());
                    rawScoreData.setMeasuredQuality(mqData);
                }

                rawScoreDataList.add(rawScoreData);
            }

            assessmentData.setRawScores(rawScoreDataList);
            assessmentDataList.add(assessmentData);
        }

        StudentDashboardResponse response = new StudentDashboardResponse();
        response.setStudentInfo(studentInfo);
        response.setAssessments(assessmentDataList);

        return response;
    }

    /**
     * Compute pre-processed portal data: pillar scores, career matches, CCI level,
     * insight text, and trait tags for a student.
     */
    @Transactional
    public StudentPortalComputedData computePortalData(Long userStudentId) {
        // Fetch all mappings for the student
        List<StudentAssessmentMapping> mappings = studentAssessmentMappingRepository
                .findByUserStudentUserStudentId(userStudentId);

        // Prefer completed assessments, fall back to all
        List<StudentAssessmentMapping> targetMappings = mappings.stream()
                .filter(m -> "completed".equals(m.getStatus()))
                .collect(Collectors.toList());
        if (targetMappings.isEmpty()) {
            targetMappings = mappings;
        }

        // Gather all raw scores
        List<Long> mappingIds = targetMappings.stream()
                .map(StudentAssessmentMapping::getStudentAssessmentId)
                .collect(Collectors.toList());

        List<AssessmentRawScore> allRawScores = mappingIds.isEmpty()
                ? new ArrayList<>()
                : assessmentRawScoreRepository.findByStudentAssessmentMappingStudentAssessmentIdIn(mappingIds);

        // Compute each section
        List<PillarScore> pillarScores = computePillarScores(allRawScores);
        List<CareerMatchResult> careerMatches = computeCareerMatches(allRawScores);
        String cciLevel = computeCCILevel(pillarScores, careerMatches, allRawScores);
        List<String> traitTags = extractTopTraits(allRawScores);
        String insightText = generateInsight(careerMatches, pillarScores);

        StudentPortalComputedData data = new StudentPortalComputedData();
        data.setPillarScores(pillarScores);
        data.setCareerMatches(careerMatches);
        data.setCciLevel(cciLevel);
        data.setTraitTags(traitTags);
        data.setInsightText(insightText);

        return data;
    }

    // ── Pillar Scores ──

    private List<PillarScore> computePillarScores(List<AssessmentRawScore> rawScores) {
        // Group raw scores by MeasuredQuality parent name
        Map<String, List<Integer>> scoresByQuality = new HashMap<>();

        for (AssessmentRawScore rs : rawScores) {
            String qualityName = getQualityName(rs);
            scoresByQuality.computeIfAbsent(qualityName, k -> new ArrayList<>()).add(rs.getRawScore());
        }

        // Map each quality group to one of the 6 pillars
        Map<String, Double> pillarAverages = new HashMap<>();
        Map<String, String> qualityToPillar = new HashMap<>();

        for (String qualityName : scoresByQuality.keySet()) {
            String pillar = mapQualityToPillar(qualityName);
            qualityToPillar.put(qualityName, pillar);
        }

        // Aggregate scores per pillar
        Map<String, List<Integer>> pillarRawScores = new HashMap<>();
        for (Map.Entry<String, List<Integer>> entry : scoresByQuality.entrySet()) {
            String pillar = qualityToPillar.get(entry.getKey());
            pillarRawScores.computeIfAbsent(pillar, k -> new ArrayList<>()).addAll(entry.getValue());
        }

        // Compute average per pillar
        for (Map.Entry<String, List<Integer>> entry : pillarRawScores.entrySet()) {
            double avg = entry.getValue().stream().mapToInt(Integer::intValue).average().orElse(0);
            pillarAverages.put(entry.getKey(), avg);
        }

        // Normalize to 0-100: find max average, scale all relative to it (max → 90)
        double maxAvg = pillarAverages.values().stream().mapToDouble(Double::doubleValue).max().orElse(1);
        if (maxAvg <= 0) maxAvg = 1;

        List<String> pillarNames = Arrays.asList(
                "Career Personality", "Learning Styles", "Ability",
                "Values", "Subjects Interest", "Aspirations");

        List<PillarScore> result = new ArrayList<>();
        for (String pillarName : pillarNames) {
            Double avg = pillarAverages.get(pillarName);
            int value = 0;
            if (avg != null && avg > 0) {
                value = (int) Math.round((avg / maxAvg) * 90);
                value = Math.max(20, Math.min(100, value)); // clamp between 20-100
            }
            result.add(new PillarScore(pillarName, value));
        }

        return result;
    }

    private String getQualityName(AssessmentRawScore rs) {
        if (rs.getMeasuredQuality() != null) {
            String name = rs.getMeasuredQuality().getQualityDisplayName();
            return name != null ? name : rs.getMeasuredQuality().getMeasuredQualityName();
        }
        if (rs.getMeasuredQualityType() != null && rs.getMeasuredQualityType().getMeasuredQuality() != null) {
            MeasuredQualities mq = rs.getMeasuredQualityType().getMeasuredQuality();
            String name = mq.getQualityDisplayName();
            return name != null ? name : mq.getMeasuredQualityName();
        }
        return "Unknown";
    }

    private String mapQualityToPillar(String qualityName) {
        String lower = qualityName.toLowerCase();
        for (Map.Entry<String, List<String>> entry : PILLAR_KEYWORDS.entrySet()) {
            for (String keyword : entry.getValue()) {
                if (lower.contains(keyword)) {
                    return entry.getKey();
                }
            }
        }
        // If no keyword match, use the quality name itself if it matches a pillar name
        for (String pillarName : PILLAR_KEYWORDS.keySet()) {
            if (pillarName.equalsIgnoreCase(qualityName)) {
                return pillarName;
            }
        }
        // Default: map to Ability as catch-all
        return "Ability";
    }

    // ── Career Matches ──

    private List<CareerMatchResult> computeCareerMatches(List<AssessmentRawScore> rawScores) {
        if (rawScores.isEmpty()) return new ArrayList<>();

        // Build MQT ID → total score map
        Map<Long, Integer> mqtScoreMap = new HashMap<>();
        Map<Long, String> mqtNameMap = new HashMap<>();

        for (AssessmentRawScore rs : rawScores) {
            if (rs.getMeasuredQualityType() != null) {
                Long mqtId = rs.getMeasuredQualityType().getMeasuredQualityTypeId();
                mqtScoreMap.merge(mqtId, rs.getRawScore(), Integer::sum);

                String name = rs.getMeasuredQualityType().getMeasuredQualityTypeDisplayName();
                if (name == null) name = rs.getMeasuredQualityType().getMeasuredQualityTypeName();
                mqtNameMap.putIfAbsent(mqtId, name);
            }
        }

        // Fetch all careers with their linked MQTs
        List<Career> careers = careerRepository.findAllWithMeasuredQualityTypes();

        // Score each career
        List<ScoredCareer> scoredCareers = new ArrayList<>();
        for (Career career : careers) {
            if (career.getMeasuredQualityTypes() == null || career.getMeasuredQualityTypes().isEmpty()) {
                continue;
            }

            int totalScore = 0;
            int matchedCount = 0;
            List<String> matchingTraits = new ArrayList<>();

            for (MeasuredQualityTypes mqt : career.getMeasuredQualityTypes()) {
                Integer studentScore = mqtScoreMap.get(mqt.getMeasuredQualityTypeId());
                if (studentScore != null && studentScore > 0) {
                    totalScore += studentScore;
                    matchedCount++;
                    String traitName = mqt.getMeasuredQualityTypeDisplayName() != null
                            ? mqt.getMeasuredQualityTypeDisplayName()
                            : mqt.getMeasuredQualityTypeName();
                    matchingTraits.add(traitName);
                }
            }

            if (matchedCount > 0) {
                double matchRatio = (double) matchedCount / career.getMeasuredQualityTypes().size();
                double weightedScore = totalScore * matchRatio;
                scoredCareers.add(new ScoredCareer(career, weightedScore, matchingTraits));
            }
        }

        // Sort descending by score
        scoredCareers.sort(Comparator.comparingDouble((ScoredCareer sc) -> sc.score).reversed());

        // Take top 3
        String[] ranks = {"best", "strong", "good"};
        double topScore = scoredCareers.isEmpty() ? 1 : scoredCareers.get(0).score;

        List<CareerMatchResult> results = new ArrayList<>();
        for (int i = 0; i < Math.min(3, scoredCareers.size()); i++) {
            ScoredCareer sc = scoredCareers.get(i);
            CareerMatchResult result = new CareerMatchResult();
            result.setRank(ranks[i]);

            // Convert to X/9 display score
            int displayScore = (int) Math.round((sc.score / topScore) * 9);
            displayScore = Math.max(5, Math.min(9, displayScore));
            if (i == 0) displayScore = 9;
            result.setScore(displayScore + "/9");

            result.setName(sc.career.getTitle());
            result.setTraits(sc.traits.subList(0, Math.min(3, sc.traits.size())));

            // Extract courses from career description if available
            result.setCourses(extractCourses(sc.career));

            results.add(result);
        }

        return results;
    }

    private List<String> extractCourses(Career career) {
        if (career.getDescription() == null || career.getDescription().trim().isEmpty()) {
            return new ArrayList<>();
        }
        // Split description by commas or semicolons to get course suggestions
        String desc = career.getDescription().trim();
        String[] parts = desc.split("[,;]");
        List<String> courses = new ArrayList<>();
        for (String part : parts) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty() && trimmed.length() <= 50) {
                courses.add(trimmed);
            }
        }
        return courses.subList(0, Math.min(3, courses.size()));
    }

    // ── CCI Level ──

    private String computeCCILevel(List<PillarScore> pillars, List<CareerMatchResult> careers,
                                   List<AssessmentRawScore> rawScores) {
        // Pillars with data (value > 0)
        long activePillars = pillars.stream().filter(p -> p.getValue() > 0).count();
        // Average pillar score
        double avgPillar = pillars.stream().mapToInt(PillarScore::getValue).average().orElse(0);
        boolean hasCareerMatches = !careers.isEmpty();

        if (activePillars >= 4 && avgPillar >= 40 && hasCareerMatches) return "HIGH";
        if (activePillars >= 2 || rawScores.size() > 5) return "MEDIUM";
        return "LOW";
    }

    // ── Trait Tags ──

    private List<String> extractTopTraits(List<AssessmentRawScore> rawScores) {
        return rawScores.stream()
                .filter(rs -> rs.getMeasuredQualityType() != null)
                .sorted(Comparator.comparingInt(AssessmentRawScore::getRawScore).reversed())
                .map(rs -> {
                    String name = rs.getMeasuredQualityType().getMeasuredQualityTypeDisplayName();
                    return name != null ? name : rs.getMeasuredQualityType().getMeasuredQualityTypeName();
                })
                .filter(name -> name != null && !name.isEmpty())
                .distinct()
                .limit(4)
                .collect(Collectors.toList());
    }

    // ── Insight Text ──

    private String generateInsight(List<CareerMatchResult> careers, List<PillarScore> pillars) {
        // Find strongest pillar
        PillarScore strongest = pillars.stream()
                .max(Comparator.comparingInt(PillarScore::getValue))
                .orElse(null);

        String topCareer = !careers.isEmpty() ? careers.get(0).getName() : null;

        if (topCareer != null && strongest != null && strongest.getValue() > 0) {
            return "Your strength in " + strongest.getName() + " aligns well with " + topCareer
                    + ". Explore the Career Library to discover related paths and build on your profile.";
        }

        if (topCareer != null) {
            return "Based on your assessment results, " + topCareer
                    + " is a strong fit. Explore the Career Library to learn more about this path.";
        }

        return "Complete your assessments to unlock personalised career insights and match recommendations.";
    }

    // Helper class for career scoring
    private static class ScoredCareer {
        final Career career;
        final double score;
        final List<String> traits;

        ScoredCareer(Career career, double score, List<String> traits) {
            this.career = career;
            this.score = score;
            this.traits = traits;
        }
    }
}
