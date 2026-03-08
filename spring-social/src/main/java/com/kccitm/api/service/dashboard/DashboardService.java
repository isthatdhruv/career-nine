package com.kccitm.api.service.dashboard;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.AssessmentRawScore;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

@Service
public class DashboardService {

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private AssessmentRawScoreRepository assessmentRawScoreRepository;

    @Autowired
    private AssessmentAnswerRepository assessmentAnswerRepository;

    @Autowired
    private StudentAssessmentMappingRepository studentAssessmentMappingRepository;

    /**
     * Get student basic information
     */
    public Map<String, Object> getStudentBasicInfo(Long studentId) {
        try {
            UserStudent student = userStudentRepository.findById(studentId).orElse(null);

            if (student == null) {
                // Return demo data if student not found
                return getDefaultStudentInfo(studentId);
            }

            Map<String, Object> studentInfo = new HashMap<>();
            studentInfo.put("userStudentId", student.getUserStudentId());

            // Access student details through StudentInfo relationship
            if (student.getStudentInfo() != null) {
                studentInfo.put("name", student.getStudentInfo().getName() != null ? student.getStudentInfo().getName() : "Demo Student");
                studentInfo.put("grade", student.getStudentInfo().getStudentClass() != null ? student.getStudentInfo().getStudentClass() : 3);
                studentInfo.put("schoolBoard", student.getStudentInfo().getSchoolBoard() != null ? student.getStudentInfo().getSchoolBoard() : "CBSE");
                studentInfo.put("familyType", student.getStudentInfo().getFamily() != null ? student.getStudentInfo().getFamily() : "Nuclear");
                studentInfo.put("siblingsCount", student.getStudentInfo().getSibling() != null ? student.getStudentInfo().getSibling() : 1);
            } else {
                System.out.println("no data");
            }

            // Format current date as assessment date
            SimpleDateFormat dateFormat = new SimpleDateFormat("dd MMM yyyy");
            studentInfo.put("lastAssessmentDate", dateFormat.format(new Date()));

            // Institute information
            if (student.getInstitute() != null) {
                studentInfo.put("instituteName", student.getInstitute().getInstituteName());
                studentInfo.put("schoolLogo", null); // TODO: Add logo field to InstituteDetail entity
            } else {
                studentInfo.put("instituteName", "Demo School");
                studentInfo.put("schoolLogo", null);
            }

            return studentInfo;
        } catch (Exception e) {
            // If any error occurs, return demo data
            return getDefaultStudentInfo(studentId);
        }
    }

    /**
     * Get default student info for demo/testing
     */
    private Map<String, Object> getDefaultStudentInfo(Long studentId) {
        Map<String, Object> studentInfo = new HashMap<>();
        studentInfo.put("userStudentId", studentId);
        studentInfo.put("name", "Demo Student");
        studentInfo.put("grade", 3);
        studentInfo.put("schoolBoard", "CBSE");
        studentInfo.put("familyType", "Nuclear");
        studentInfo.put("siblingsCount", 1);
        SimpleDateFormat dateFormat = new SimpleDateFormat("dd MMM yyyy");
        studentInfo.put("lastAssessmentDate", dateFormat.format(new Date()));
        studentInfo.put("instituteName", "Demo School");
        studentInfo.put("schoolLogo", null);
        return studentInfo;
    }

    /**
     * Get cognitive game results
     * This includes: Attention, Working Memory, Cognitive Flexibility
     * @param studentId - Student ID
     * @param assessmentId - Optional assessment ID to filter by specific assessment
     */
    public Map<String, Object> getGameResults(Long studentId, Long assessmentId) {
        Map<String, Object> gameResults = new HashMap<>();

        // For MVP, return demo data structure
        // TODO: Replace with actual game results from game_results table when implemented
        // TODO: Use assessmentId to filter results when game_results table is implemented

        gameResults.put("attention", getAttentionData(studentId, assessmentId));
        gameResults.put("workingMemory", getWorkingMemoryData(studentId, assessmentId));
        gameResults.put("cognitiveFlexibility", getCognitiveFlexibilityData(studentId, assessmentId));

        return gameResults;
    }

    /**
     * Get attention game data (Leopard/Lion game)
     */
    private Map<String, Object> getAttentionData(Long studentId, Long assessmentId) {
        Map<String, Object> attention = new HashMap<>();

        // TODO: Query from actual game_results table filtered by assessmentId
        // For now, returning demo data structure
        attention.put("hits", 18);
        attention.put("misses", 6);
        attention.put("falsePositives", 6);
        attention.put("totalTargets", 24);
        attention.put("totalNonTargets", 96);

        return attention;
    }

    /**
     * Get working memory game data (Rabbit's Path game)
     */
    private Map<String, Object> getWorkingMemoryData(Long studentId, Long assessmentId) {
        Map<String, Object> workingMemory = new HashMap<>();

        // TODO: Query from actual game_results table filtered by assessmentId
        workingMemory.put("levelReached", 5);
        workingMemory.put("pathwaysCompleted", 10);
        workingMemory.put("rawScore", 10);

        return workingMemory;
    }

    /**
     * Get cognitive flexibility game data (Hydro Tube game)
     */
    private Map<String, Object> getCognitiveFlexibilityData(Long studentId, Long assessmentId) {
        Map<String, Object> cognitiveFlexibility = new HashMap<>();

        // TODO: Query from actual game_results table filtered by assessmentId
        cognitiveFlexibility.put("time", 85);
        cognitiveFlexibility.put("aimlessClicks", 2);
        cognitiveFlexibility.put("puzzlesCompleted", 2);
        cognitiveFlexibility.put("curiousClicks", 3);

        return cognitiveFlexibility;
    }

    /**
     * Get assessment scores (Social Insight, Values, Environmental Awareness)
     * @param studentId - Student ID
     * @param assessmentId - Optional assessment ID to filter by specific assessment
     */
    public Map<String, Object> getAssessmentScores(Long studentId, Long assessmentId) {
        Map<String, Object> assessmentScores = new HashMap<>();

        assessmentScores.put("socialInsight", getSocialInsightData(studentId, assessmentId));
        assessmentScores.put("values", getValuesData(studentId, assessmentId));
        assessmentScores.put("environmentalAwareness", getEnvironmentalAwarenessData(studentId, assessmentId));

        return assessmentScores;
    }

    /**
     * Get Social Insight Scale data from AssessmentRawScore
     */
    private Map<String, Object> getSocialInsightData(Long studentId, Long assessmentId) {
        Map<String, Object> socialInsight = new HashMap<>();

        try {
            // Get assessment mappings for this student
            List<StudentAssessmentMapping> mappings;
            if (assessmentId != null) {
                // Filter by specific assessment
                Optional<StudentAssessmentMapping> mapping = studentAssessmentMappingRepository
                        .findFirstByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId);
                mappings = mapping.isPresent() ? Arrays.asList(mapping.get()) : new ArrayList<>();
            } else {
                // Get all assessment mappings if no specific assessment selected
                mappings = studentAssessmentMappingRepository
                        .findByUserStudentUserStudentId(studentId);
            }

            // Get all raw scores for these mappings
            List<AssessmentRawScore> rawScores = new ArrayList<>();
            for (StudentAssessmentMapping mapping : mappings) {
                rawScores.addAll(assessmentRawScoreRepository
                        .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId()));
            }

            // Filter for social insight quality type
            List<AssessmentRawScore> socialInsightScores = rawScores.stream()
                    .filter(score -> {
                        if (score.getMeasuredQuality() == null) return false;
                        String qualityName = score.getMeasuredQuality().getMeasuredQualityName();
                        return qualityName != null &&
                               qualityName.toLowerCase().contains("social insight");
                    })
                    .collect(Collectors.toList());

            // Calculate total score
            int totalScore = socialInsightScores.stream()
                    .mapToInt(AssessmentRawScore::getRawScore)
                    .sum();

            socialInsight.put("totalScore", totalScore);

            // Get top domains (highest scoring quality types)
            List<Map<String, Object>> topDomains = socialInsightScores.stream()
                    .filter(score -> score.getMeasuredQualityType() != null)
                    .sorted(Comparator.comparing(AssessmentRawScore::getRawScore).reversed())
                    .limit(3)
                    .map(score -> {
                        Map<String, Object> domain = new HashMap<>();
                        domain.put("name", score.getMeasuredQualityType().getMeasuredQualityTypeName());
                        domain.put("score", score.getRawScore());
                        return domain;
                    })
                    .collect(Collectors.toList());

            socialInsight.put("topDomains", topDomains.isEmpty() ? getDefaultTopDomains() : topDomains);

            // Get growth areas (lowest scoring quality types)
            List<Map<String, Object>> growthAreas = socialInsightScores.stream()
                    .filter(score -> score.getMeasuredQualityType() != null)
                    .sorted(Comparator.comparing(AssessmentRawScore::getRawScore))
                    .limit(2)
                    .map(score -> {
                        Map<String, Object> domain = new HashMap<>();
                        domain.put("name", score.getMeasuredQualityType().getMeasuredQualityTypeName());
                        domain.put("score", score.getRawScore());
                        return domain;
                    })
                    .collect(Collectors.toList());

            socialInsight.put("growthAreas", growthAreas.isEmpty() ? getDefaultGrowthAreas() : growthAreas);

        } catch (Exception e) {
            // Return demo data if no data found
            System.out.println(e);
        }

        return socialInsight;
    }

    /**
     * Get Values Checklist data (Top 3 ranked values)
     */
    private List<Map<String, Object>> getValuesData(Long studentId, Long assessmentId) {
        List<Map<String, Object>> values = new ArrayList<>();

        try {
            // Get UserStudent entity
            UserStudent userStudent = userStudentRepository.findById(studentId)
                    .orElseThrow(() -> new RuntimeException("Student not found"));

            // Get assessment answers for values questionnaire
            // Filter by assessmentId if provided
            List<AssessmentAnswer> valueAnswers = assessmentAnswerRepository
                    .findByUserStudent(userStudent).stream()
                    .filter(answer -> {
                        // Filter by assessmentId if provided
                        if (assessmentId != null && answer.getAssessment() != null) {
                            return answer.getAssessment().getId().equals(assessmentId);
                        }
                        return true;
                    })
                    .filter(answer -> answer.getRankOrder() != null && answer.getRankOrder() > 0)
                    .sorted(Comparator.comparing(AssessmentAnswer::getRankOrder))
                    .limit(3)
                    .collect(Collectors.toList());

            if (!valueAnswers.isEmpty()) {
                for (AssessmentAnswer answer : valueAnswers) {
                    if (answer.getOption() == null) continue;
                    Map<String, Object> value = new HashMap<>();
                    String valueName = answer.getOption().getOptionText();
                    if (valueName == null) valueName = "Unknown Value";
                    value.put("name", valueName);
                    value.put("phrase", getValuePhrase(valueName));
                    value.put("meaning", getValueMeaning(answer.getRankOrder()));
                    value.put("rank", answer.getRankOrder());
                    values.add(value);
                }
            }

            if (values.isEmpty()) {
                // Return demo data
                values = getDefaultValues();
            }
        } catch (Exception e) {
            values = getDefaultValues();
        }

        return values;
    }

    /**
     * Get kid-friendly phrase for a value
     */
    private String getValuePhrase(String valueName) {
        Map<String, String> phrases = new HashMap<>();
        phrases.put("Honesty", "Telling the truth even if it's a bit scary");
        phrases.put("Kindness", "Helping others and being kind to everyone");
        phrases.put("Hard Work", "Doing my best even when the work is hard");
        phrases.put("Fairness", "Making sure everyone gets a fair turn");
        phrases.put("Courage", "Standing up for a friend or trying new things");
        phrases.put("Curiosity", "Asking 'Why?' and wanting to learn more");
        phrases.put("Respect", "Listening to others and being polite");
        phrases.put("Patience", "Waiting calmly without getting upset");
        phrases.put("Gratitude", "Saying thank you and feeling happy for what I have");
        phrases.put("Cleanliness", "Keeping my desk and my surroundings clean");

        return phrases.getOrDefault(valueName, "Living by this value every day");
    }

    /**
     * Get meaning explanation based on rank
     */
    private String getValueMeaning(int rank) {
        if (rank == 1) {
            return "This is your core identity - the 'WHY' behind your biggest choices";
        } else if (rank == 2) {
            return "This is your style of action - the 'HOW' you interact with the world";
        } else {
            return "This is your safety net - the value you lean on when things get tough";
        }
    }

    /**
     * Default values if no data found
     */
    private List<Map<String, Object>> getDefaultValues() {
        List<Map<String, Object>> values = new ArrayList<>();

        Map<String, Object> value1 = new HashMap<>();
        value1.put("name", "Honesty");
        value1.put("phrase", "Telling the truth even if it's a bit scary");
        value1.put("meaning", "This is your core identity - the 'WHY' behind your biggest choices");
        value1.put("rank", 1);
        values.add(value1);

        Map<String, Object> value2 = new HashMap<>();
        value2.put("name", "Kindness");
        value2.put("phrase", "Helping others and being kind to everyone");
        value2.put("meaning", "This is your style of action - the 'HOW' you interact with the world");
        value2.put("rank", 2);
        values.add(value2);

        Map<String, Object> value3 = new HashMap<>();
        value3.put("name", "Curiosity");
        value3.put("phrase", "Asking 'Why?' and wanting to learn more");
        value3.put("meaning", "This is your safety net - the value you lean on when things get tough");
        value3.put("rank", 3);
        values.add(value3);

        return values;
    }

    /**
     * Get Environmental Awareness data
     */
    private Map<String, Object> getEnvironmentalAwarenessData(Long studentId, Long assessmentId) {
        Map<String, Object> environmental = new HashMap<>();

        try {
            // Get UserStudent entity
            UserStudent userStudent = userStudentRepository.findById(studentId)
                    .orElseThrow(() -> new RuntimeException("Student not found"));

            // Count friendly vs unfriendly choices
            List<AssessmentAnswer> envAnswers = assessmentAnswerRepository
                    .findByUserStudent(userStudent).stream()
                    .filter(answer -> {
                        // Filter by assessmentId if provided
                        if (assessmentId != null && answer.getAssessment() != null) {
                            if (!answer.getAssessment().getId().equals(assessmentId)) {
                                return false;
                            }
                        }
                        if (answer.getQuestionnaireQuestion() == null) return false;
                        if (answer.getQuestionnaireQuestion().getQuestion() == null) return false;
                        String questionText = answer.getQuestionnaireQuestion().getQuestion().getQuestionText();
                        return questionText != null &&
                               questionText.toLowerCase().contains("environment");
                    })
                    .collect(Collectors.toList());

            int friendlyChoices = 3; // TODO: Calculate from actual data
            int unfriendlyChoices = 1;

            environmental.put("friendlyChoices", friendlyChoices);
            environmental.put("unfriendlyChoices", unfriendlyChoices);

        } catch (Exception e) {
            environmental.put("friendlyChoices", 3);
            environmental.put("unfriendlyChoices", 1);
        }

        return environmental;
    }

    /**
     * Get Self-Management data (Self-Efficacy, Emotional Regulation, Self-Regulation)
     * @param studentId - Student ID
     * @param assessmentId - Optional assessment ID to filter by specific assessment
     */
    public Map<String, Object> getSelfManagement(Long studentId, Long assessmentId) {
        Map<String, Object> selfManagement = new HashMap<>();

        selfManagement.put("selfEfficacy", getSelfEfficacyData(studentId, assessmentId));
        selfManagement.put("emotionalRegulation", getEmotionalRegulationData(studentId, assessmentId));
        selfManagement.put("selfRegulation", getSelfRegulationData(studentId, assessmentId));

        return selfManagement;
    }

    /**
     * Get Self-Efficacy data from raw scores
     */
    private Map<String, Object> getSelfEfficacyData(Long studentId, Long assessmentId) {
        Map<String, Object> selfEfficacy = new HashMap<>();

        try {
            // Get assessment mappings for this student
            List<StudentAssessmentMapping> mappings;
            if (assessmentId != null) {
                // Filter by specific assessment
                Optional<StudentAssessmentMapping> mapping = studentAssessmentMappingRepository
                        .findFirstByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId);
                mappings = mapping.isPresent() ? Arrays.asList(mapping.get()) : new ArrayList<>();
            } else {
                // Get all assessment mappings if no specific assessment selected
                mappings = studentAssessmentMappingRepository
                        .findByUserStudentUserStudentId(studentId);
            }

            // Get all raw scores for these mappings
            List<AssessmentRawScore> rawScores = new ArrayList<>();
            for (StudentAssessmentMapping mapping : mappings) {
                rawScores.addAll(assessmentRawScoreRepository
                        .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId()));
            }

            // Find self-efficacy scores
            Optional<AssessmentRawScore> efficacyScore = rawScores.stream()
                    .filter(score -> {
                        if (score.getMeasuredQuality() == null) return false;
                        String qualityName = score.getMeasuredQuality().getMeasuredQualityName();
                        return qualityName != null &&
                               qualityName.toLowerCase().contains("efficacy");
                    })
                    .findFirst();

            if (efficacyScore.isPresent()) {
                int score = efficacyScore.get().getRawScore();
                selfEfficacy.put("level", determineSelfEfficacyLevel(score));
                selfEfficacy.put("interpretation", getSelfEfficacyInterpretation(score));
            } else {
                // Default data
                selfEfficacy.put("level", "High");
                selfEfficacy.put("interpretation",
                    "Your child has a 'can-do' attitude, seeing mistakes as a natural part of learning and staying determined even when a task gets tough.");
            }
        } catch (Exception e) {
            selfEfficacy.put("level", "High");
            selfEfficacy.put("interpretation",
                "Your child has a 'can-do' attitude, seeing mistakes as a natural part of learning and staying determined even when a task gets tough.");
        }

        return selfEfficacy;
    }

    /**
     * Get Emotional Regulation data
     */
    private Map<String, Object> getEmotionalRegulationData(Long studentId, Long assessmentId) {
        Map<String, Object> emotionalRegulation = new HashMap<>();

        // TODO: Calculate from actual assessment data filtered by assessmentId
        emotionalRegulation.put("level", "Moderate");
        emotionalRegulation.put("interpretation",
            "Your child handles daily emotions well but may struggle to stay calm during high-pressure moments, like a big school test or a lost game.");

        return emotionalRegulation;
    }

    /**
     * Get Self-Regulation data
     */
    private Map<String, Object> getSelfRegulationData(Long studentId, Long assessmentId) {
        Map<String, Object> selfRegulation = new HashMap<>();

        // TODO: Calculate from actual assessment data filtered by assessmentId
        selfRegulation.put("level", "High");
        selfRegulation.put("interpretation",
            "Your child shows excellent impulse control and can follow rules well, staying focused even in exciting environments.");

        return selfRegulation;
    }

    // ========== HELPER METHODS ==========

    private String determineSelfEfficacyLevel(int score) {
        if (score >= 15) return "High";
        if (score >= 8) return "Moderate";
        return "Low";
    }

    private String getSelfEfficacyInterpretation(int score) {
        if (score >= 15) {
            return "Your child has a 'can-do' attitude, seeing mistakes as a natural part of learning and staying determined even when a task gets tough.";
        } else if (score >= 8) {
            return "Your child feels confident with things they already know but might need a little extra encouragement to try something brand new or difficult.";
        } else {
            return "Your child might feel like they aren't 'good' at things yet, which makes them want to avoid hard tasks. Remember that being smart or good at sports is a skill you can build step-by-step.";
        }
    }

    private Map<String, Object> createDomain(String name, int score) {
        Map<String, Object> domain = new HashMap<>();
        domain.put("name", name);
        domain.put("score", score);
        return domain;
    }

    private List<Map<String, Object>> getDefaultTopDomains() {
        return Arrays.asList(
            createDomain("Pro-social Deception", 2),
            createDomain("Sarcasm Detection", 2),
            createDomain("Intention Attribution", 2)
        );
    }

    private List<Map<String, Object>> getDefaultGrowthAreas() {
        return Arrays.asList(
            createDomain("Social Faux Pas", 0),
            createDomain("Double Bluffing", 1)
        );
    }
}
