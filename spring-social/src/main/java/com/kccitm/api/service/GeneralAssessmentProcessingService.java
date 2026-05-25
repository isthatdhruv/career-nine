package com.kccitm.api.service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.career9.*;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.AssessmentAnswerRepository;
import com.kccitm.api.repository.Career9.GeneralAssessmentResultRepository;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

/**
 * Translates the Python 6-phase pipeline into a single Java processing service.
 * Computes personality stanines, intelligence/ability rankings, suitability index,
 * career pathway analysis, and JSON enrichment.
 */
@Service
public class GeneralAssessmentProcessingService {

    private static final Logger logger = LoggerFactory.getLogger(GeneralAssessmentProcessingService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired private GeneralAssessmentResultRepository resultRepository;
    @Autowired private StudentAssessmentMappingRepository mappingRepository;
    @Autowired private AssessmentAnswerRepository answerRepository;
    @Autowired private AssessmentRawScoreRepository rawScoreRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private StudentInfoRepository studentInfoRepository;
    @Autowired private GeneralAssessmentJsonDataLoader jsonData;

    // =====================================================================
    // CONSTANTS — Translated from Python's 01_core_analysis.py
    // =====================================================================

    private static final List<String> PERSONALITY_TRAITS = Arrays.asList(
            "Realistic", "Investigative", "Artistic", "Social", "Enterprising", "Conventional");

    private static final List<String> INTELLIGENCE_TYPES = Arrays.asList(
            "Bodily-Kinesthetic", "Intrapersonal", "Interpersonal", "Linguistic",
            "Logical-Mathematical", "Musical", "Visual-Spatial", "Naturalistic");

    private static final List<String> ABILITY_TYPES = Arrays.asList(
            "Communication", "Decision making & problem solving", "Speed and accuracy",
            "Creativity", "Computational", "Logical reasoning", "Form perception",
            "Technical", "Motor movement", "Finger dexterity");

    // Stanine mapping — exact copy from Python
    private static final Map<String, Map<Integer, List<Double>>> STANINE_MAPPING = new HashMap<>();
    static {
        STANINE_MAPPING.put("Realistic", buildStanineMap(
                new int[]{1,2,3,4,5,6,7,8,9},
                new double[][]{{9,10,11,12},{13,14},{15},{16},{17},{18},{19.5},{19},{20}}));
        STANINE_MAPPING.put("Investigative", buildStanineMap(
                new int[]{1,2,3,4,5,6,7,8,9},
                new double[][]{{9,10,11,12,13},{14},{15},{16},{17},{18},{19.5},{19},{20}}));
        STANINE_MAPPING.put("Artistic", buildStanineMap(
                new int[]{1,2,3,4,5,6,7,8,9},
                new double[][]{{9,10,11,12,13},{14},{15,16},{17},{17.5},{18},{19.5},{19},{20}}));
        STANINE_MAPPING.put("Social", buildStanineMap(
                new int[]{1,2,3,4,5,6,7,8,9},
                new double[][]{{9,10,11,12,13},{14,15},{16},{17},{17.5},{18},{19.5},{19},{20}}));
        STANINE_MAPPING.put("Enterprising", buildStanineMap(
                new int[]{1,2,3,4,5,6,7,8,9},
                new double[][]{{9,10,11,12,13},{14},{15,16},{17},{17.5},{18},{19.5},{19},{20}}));
        STANINE_MAPPING.put("Conventional", buildStanineMap(
                new int[]{1,2,3,4,5,6,7,8,9},
                new double[][]{{9,10,11,12},{13},{14,15,16},{17},{17.5},{18},{19.5},{19},{20}}));
    }

    private static Map<Integer, List<Double>> buildStanineMap(int[] stanines, double[][] scoreArrays) {
        Map<Integer, List<Double>> map = new LinkedHashMap<>();
        for (int i = 0; i < stanines.length; i++) {
            List<Double> scores = new ArrayList<>();
            for (double s : scoreArrays[i]) scores.add(s);
            map.put(stanines[i], scores);
        }
        return map;
    }

    // Intelligence → Personality mapping for tie-breaking
    private static final Map<String, List<String>> INTEL_TO_PERSONALITY = new HashMap<>();
    static {
        INTEL_TO_PERSONALITY.put("Bodily-Kinesthetic", Arrays.asList("Realistic"));
        INTEL_TO_PERSONALITY.put("Naturalistic", Arrays.asList("Realistic"));
        INTEL_TO_PERSONALITY.put("Intrapersonal", Arrays.asList("Conventional"));
        INTEL_TO_PERSONALITY.put("Interpersonal", Arrays.asList("Social", "Enterprising"));
        INTEL_TO_PERSONALITY.put("Linguistic", Arrays.asList("Social"));
        INTEL_TO_PERSONALITY.put("Logical-Mathematical", Arrays.asList("Investigative"));
        INTEL_TO_PERSONALITY.put("Musical", Arrays.asList("Artistic"));
        INTEL_TO_PERSONALITY.put("Visual-Spatial", Arrays.asList("Artistic"));
    }

    // Personality → Intelligence score mapping for personality tie-breaking
    private static final Map<String, List<String>> PERSONALITY_TO_INTEL = new HashMap<>();
    static {
        PERSONALITY_TO_INTEL.put("Realistic", Arrays.asList("Bodily-Kinesthetic"));
        PERSONALITY_TO_INTEL.put("Investigative", Arrays.asList("Logical-Mathematical"));
        PERSONALITY_TO_INTEL.put("Artistic", Arrays.asList("Musical", "Visual-Spatial"));
        PERSONALITY_TO_INTEL.put("Social", Arrays.asList("Interpersonal"));
        PERSONALITY_TO_INTEL.put("Enterprising", Arrays.asList("Interpersonal"));
        PERSONALITY_TO_INTEL.put("Conventional", Arrays.asList("Intrapersonal"));
    }

    // Personality → Ability score mapping for tie-breaking
    private static final Map<String, List<String>> PERSONALITY_TO_ABILITY = new HashMap<>();
    static {
        PERSONALITY_TO_ABILITY.put("Realistic", Arrays.asList("Finger dexterity", "Motor movement"));
        PERSONALITY_TO_ABILITY.put("Investigative", Arrays.asList("Computational", "Technical", "Logical reasoning"));
        PERSONALITY_TO_ABILITY.put("Artistic", Arrays.asList("Form perception", "Creativity"));
        PERSONALITY_TO_ABILITY.put("Social", Arrays.asList("Communication"));
        PERSONALITY_TO_ABILITY.put("Enterprising", Arrays.asList("Communication", "Decision making & problem solving"));
        PERSONALITY_TO_ABILITY.put("Conventional", Arrays.asList("Speed and accuracy"));
    }

    // Suitability mapping table — 24 pathways (from Python's mapping_data)
    private static final List<Map<String, Object>> SUITABILITY_MAPPING = new ArrayList<>();
    static {
        addPathway("Architecture", "A", "I", "R", new int[]{0,2,5,1,3,0,0,4,0,0});
        addPathway("Art, Design", "A", "E", "S", new int[]{2,5,3,1,0,0,0,0,0,4});
        addPathway("Entertainment and Mass Media", "A", "S", "E", new int[]{2,0,3,1,0,5,0,4,0,0});
        addPathway("Management and Administration", "C", "E", "S", new int[]{4,3,2,0,1,5,0,0,0,0});
        addPathway("Banking and Finance", "C", "I", "E", new int[]{0,3,2,0,1,4,0,0,0,5});
        addPathway("Law Studies", "C", "I", "E", new int[]{1,2,4,5,0,3,0,0,0,0});
        addPathway("Government and Public Administration", "C", "I", "E", new int[]{2,1,4,0,5,3,0,0,0,0});
        addPathway("Marketing", "E", "S", "A", new int[]{1,2,4,3,0,5,0,0,0,0});
        addPathway("Entrepreneurship", "E", "S", "I", new int[]{2,1,0,4,3,5,0,0,0,0});
        addPathway("Sales", "E", "S", "I", new int[]{1,2,5,0,3,4,0,0,0,0});
        addPathway("Science and Mathematics", "I", "C", "R", new int[]{0,3,0,1,0,2,4,0,5,0});
        addPathway("Computer Science, IT and Allied Fields", "I", "R", "C", new int[]{2,4,5,0,0,3,0,1,0,0});
        addPathway("Life Sciences /Medicine and Healthcare", "I", "R", "S", new int[]{4,2,5,0,0,3,1,0,0,0});
        addPathway("Environmental Service", "I", "R", "S", new int[]{0,1,5,0,0,0,2,0,3,4});
        addPathway("Social Sciences and Humanities", "I", "S", "A", new int[]{1,2,5,3,0,4,0,0,0,0});
        addPathway("Defence/ Protective Service", "R", "C", "S", new int[]{4,1,3,0,5,0,2,0,0,0});
        addPathway("Sports", "R", "E", "S", new int[]{5,2,3,0,0,0,0,0,1,4});
        addPathway("Engineering and Technology", "R", "I", "C", new int[]{0,4,5,0,2,3,0,1,0,0});
        addPathway("Agriculture, Food Industry and Forestry", "R", "I", "E", new int[]{0,0,0,0,0,0,0,0,0,0});
        addPathway("Education and Training", "S", "A", "I", new int[]{1,4,5,2,0,3,0,0,0,0});
        addPathway("Paramedical", "S", "I", "R", new int[]{3,2,5,0,4,1,0,0,0,0});
        addPathway("Hospitality and Tourism", "S", "R", "A", new int[]{1,4,3,2,0,0,5,0,0,0});
        addPathway("Community and Social Service", "S", "R", "E", new int[]{1,3,4,2,0,0,5,0,2,0});
        addPathway("Personal Care and Services", "S", "R", "E", new int[]{1,0,5,4,0,0,3,0,2,0});
    }

    private static void addPathway(String name, String p1, String p2, String p3, int[] abilities) {
        Map<String, Object> m = new HashMap<>();
        m.put("Pathway", name);
        m.put("P1", p1); m.put("P2", p2); m.put("P3", p3);
        m.put("abilities", abilities); // Index 0=Communication .. 9=Finger dexterity
        SUITABILITY_MAPPING.add(m);
    }

    private static final Map<String, String> RIASEC_CODE = new HashMap<>();
    static {
        RIASEC_CODE.put("Realistic", "R"); RIASEC_CODE.put("Investigative", "I");
        RIASEC_CODE.put("Artistic", "A"); RIASEC_CODE.put("Social", "S");
        RIASEC_CODE.put("Enterprising", "E"); RIASEC_CODE.put("Conventional", "C");
    }

    // =====================================================================
    // MAIN PROCESSING METHOD
    // =====================================================================

    @Transactional
    public GeneralAssessmentResult processStudent(Long userStudentId, Long assessmentId) {
        logger.info("Processing general assessment for student {} assessment {}", userStudentId, assessmentId);

        // 1. Get student assessment mapping
        StudentAssessmentMapping mapping = mappingRepository
                .findFirstByUserStudentUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                .orElseThrow(() -> new RuntimeException("No assessment mapping found for student " + userStudentId + " assessment " + assessmentId));

        // 2. Get student class info
        Integer studentClass = getStudentClass(userStudentId);
        String classGroup = getClassGroup(studentClass);

        // 3. Load raw scores (MQT-level aggregated scores)
        List<AssessmentRawScore> rawScores = rawScoreRepository
                .findByStudentAssessmentMapping(mapping);

        // 4. Load answers (for SOI, values, aspirations + section-based routing)
        List<AssessmentAnswer> answers = answerRepository
                .findByUserStudentIdAndAssessmentIdWithDetails(userStudentId, assessmentId);

        // 5. Extract scores by dimension
        Map<String, Double> personalityRawScores = extractScoresByNames(rawScores, PERSONALITY_TRAITS);
        Map<String, Double> intelligenceRawScores = extractScoresByNames(rawScores, INTELLIGENCE_TYPES);
        Map<String, Double> abilityRawScores = extractScoresByNames(rawScores, ABILITY_TYPES);

        // 6. Extract answer-based data (SOI, values, aspirations) from section names
        Map<String, List<String>> answersBySection = extractAnswersBySection(answers);

        // --- PHASE 1: Core Analysis ---
        Map<String, Integer> stanines = computeStanines(personalityRawScores);
        List<String> top3Personality = rankTop3Personality(stanines, intelligenceRawScores, abilityRawScores);
        List<String> top3Intelligence = rankTop3Intelligence(intelligenceRawScores, new HashSet<>(top3Personality));
        List<String> top5Abilities = rankTop5Abilities(abilityRawScores);

        // --- PHASE 1 Step 5: Suitability Index ---
        List<String> suitabilityPathways = computeSuitabilityIndex(top3Personality, abilityRawScores);

        // --- PHASE 1 Step 6: Weak Ability ---
        String weakAbility = identifyWeakAbility(top5Abilities, suitabilityPathways.subList(0, Math.min(3, suitabilityPathways.size())));

        // --- PHASE 2: Career Pathway Analysis (Has/Lacks) ---
        List<Map<String, Object>> pathwayDetails = analyzeCareerPathways(
                top3Personality, top3Intelligence, top5Abilities,
                answersBySection.getOrDefault("soi", Collections.emptyList()),
                answersBySection.getOrDefault("values", Collections.emptyList()),
                suitabilityPathways, classGroup);

        // --- PHASE 3: Career Matching (skip for 6-8) ---
        String careerMatch = null;
        if (!classGroup.equals("6-8")) {
            careerMatch = matchCareerAspirations(
                    answersBySection.getOrDefault("aspirations", Collections.emptyList()),
                    suitabilityPathways.subList(0, Math.min(3, suitabilityPathways.size())));
        }

        // --- PHASE 5: Enrichment ---
        GeneralAssessmentResult result = new GeneralAssessmentResult();
        result.setStudentAssessmentMapping(mapping);
        result.setUserStudentId(userStudentId);
        result.setAssessmentId(assessmentId);
        result.setStudentClass(studentClass);
        result.setClassGroup(classGroup);

        // Personality
        result.setPersonalityScores(toJson(buildPersonalityScoresMap(personalityRawScores, stanines)));
        result.setPersonalityTop1(top3Personality.size() > 0 ? top3Personality.get(0) : null);
        result.setPersonalityTop2(top3Personality.size() > 1 ? top3Personality.get(1) : null);
        result.setPersonalityTop3(top3Personality.size() > 2 ? top3Personality.get(2) : null);
        result.setPersonalityProfiles(toJson(buildPersonalityProfiles(top3Personality, classGroup)));

        // Intelligence
        result.setIntelligenceScores(toJson(intelligenceRawScores));
        result.setIntelligenceTop1(top3Intelligence.size() > 0 ? top3Intelligence.get(0) : null);
        result.setIntelligenceTop2(top3Intelligence.size() > 1 ? top3Intelligence.get(1) : null);
        result.setIntelligenceTop3(top3Intelligence.size() > 2 ? top3Intelligence.get(2) : null);
        result.setIntelligenceProfiles(toJson(buildIntelligenceProfiles(top3Intelligence, classGroup)));

        // Abilities
        result.setAbilityScores(toJson(abilityRawScores));
        result.setAbilityTop1(top5Abilities.size() > 0 ? top5Abilities.get(0) : null);
        result.setAbilityTop2(top5Abilities.size() > 1 ? top5Abilities.get(1) : null);
        result.setAbilityTop3(top5Abilities.size() > 2 ? top5Abilities.get(2) : null);
        result.setAbilityTop4(top5Abilities.size() > 3 ? top5Abilities.get(3) : null);
        result.setAbilityTop5(top5Abilities.size() > 4 ? top5Abilities.get(4) : null);
        result.setWeakAbility(weakAbility);
        result.setWeakAbilityRecommendations(weakAbility != null && !weakAbility.isEmpty()
                ? jsonData.getAbilityRecommendation(weakAbility, classGroup) : null);

        // Learning Styles
        result.setLearningStyles(toJson(buildLearningStyles(top3Intelligence)));

        // Career Pathways
        result.setSuitabilityPathways(toJson(pathwayDetails));
        result.setCareerMatchResult(careerMatch);

        // Preferences
        result.setSubjectsOfInterest(toJson(answersBySection.getOrDefault("soi", Collections.emptyList())));
        result.setCareerAspirations(toJson(answersBySection.getOrDefault("aspirations", Collections.emptyList())));
        result.setStudentValues(toJson(answersBySection.getOrDefault("values", Collections.emptyList())));

        // Future Suggestions (from top personality)
        if (!top3Personality.isEmpty()) {
            Map<String, String> suggestions = new HashMap<>();
            suggestions.put("atSchool", jsonData.getFutureSuggestionsAtSchool(top3Personality.get(0), classGroup));
            suggestions.put("atHome", jsonData.getFutureSuggestionsAtHome(top3Personality.get(0), classGroup));
            result.setFutureSuggestions(toJson(suggestions));
        }

        // Eligibility
        String eligibility = checkEligibility(personalityRawScores, intelligenceRawScores, abilityRawScores);
        result.setEligibilityStatus(eligibility.equals("eligible") ? "eligible" : "ineligible");
        result.setEligibilityIssues(eligibility.equals("eligible") ? null : eligibility);

        result.setProcessedAt(LocalDateTime.now());

        // Delete existing result if re-processing
        resultRepository.findByUserStudentIdAndAssessmentId(userStudentId, assessmentId)
                .ifPresent(existing -> resultRepository.delete(existing));

        return resultRepository.save(result);
    }

    // =====================================================================
    // PHASE 1: STANINE COMPUTATION
    // =====================================================================

    private Map<String, Integer> computeStanines(Map<String, Double> rawScores) {
        Map<String, Integer> stanines = new LinkedHashMap<>();
        for (String trait : PERSONALITY_TRAITS) {
            Double raw = rawScores.getOrDefault(trait, 0.0);
            stanines.put(trait, getStanine(trait, raw));
        }
        return stanines;
    }

    private int getStanine(String trait, double rawScore) {
        Map<Integer, List<Double>> mapping = STANINE_MAPPING.get(trait);
        if (mapping == null) return 1;
        for (Map.Entry<Integer, List<Double>> entry : mapping.entrySet()) {
            for (Double val : entry.getValue()) {
                if (Math.abs(rawScore - val) < 0.01) return entry.getKey();
            }
        }
        // If no exact match, find closest stanine
        int bestStanine = 1;
        double bestDiff = Double.MAX_VALUE;
        for (Map.Entry<Integer, List<Double>> entry : mapping.entrySet()) {
            for (Double val : entry.getValue()) {
                double diff = Math.abs(rawScore - val);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestStanine = entry.getKey();
                }
            }
        }
        return bestStanine;
    }

    // =====================================================================
    // PHASE 1: TOP 3 PERSONALITY (with tie-breaking)
    // =====================================================================

    private List<String> rankTop3Personality(Map<String, Integer> stanines,
                                             Map<String, Double> intelligenceScores,
                                             Map<String, Double> abilityScores) {
        // Sort traits by stanine descending
        List<String> sorted = new ArrayList<>(PERSONALITY_TRAITS);
        sorted.sort((a, b) -> {
            int cmp = Integer.compare(stanines.getOrDefault(b, 0), stanines.getOrDefault(a, 0));
            if (cmp != 0) return cmp;
            // Tie-break by mapped intelligence score
            double intelA = getPersonalityIntelligenceScore(a, intelligenceScores);
            double intelB = getPersonalityIntelligenceScore(b, intelligenceScores);
            cmp = Double.compare(intelB, intelA);
            if (cmp != 0) return cmp;
            // Tie-break by mapped ability score
            double abilA = getPersonalityAbilityScore(a, abilityScores);
            double abilB = getPersonalityAbilityScore(b, abilityScores);
            return Double.compare(abilB, abilA);
        });
        return sorted.subList(0, Math.min(3, sorted.size()));
    }

    private double getPersonalityIntelligenceScore(String personality, Map<String, Double> intelScores) {
        List<String> mapped = PERSONALITY_TO_INTEL.getOrDefault(personality, Collections.emptyList());
        if (mapped.isEmpty()) return 0;
        return mapped.stream().mapToDouble(i -> intelScores.getOrDefault(i, 0.0)).average().orElse(0);
    }

    private double getPersonalityAbilityScore(String personality, Map<String, Double> abilityScores) {
        List<String> mapped = PERSONALITY_TO_ABILITY.getOrDefault(personality, Collections.emptyList());
        if (mapped.isEmpty()) return 0;
        return mapped.stream().mapToDouble(a -> abilityScores.getOrDefault(a, 0.0)).average().orElse(0);
    }

    // =====================================================================
    // PHASE 1: TOP 3 INTELLIGENCE (with personality-based tie-breaking)
    // =====================================================================

    private List<String> rankTop3Intelligence(Map<String, Double> scores, Set<String> topPersonalities) {
        List<String> types = new ArrayList<>(INTELLIGENCE_TYPES);
        // Exclude Naturalistic if score <= 3
        types.removeIf(t -> t.equals("Naturalistic") && scores.getOrDefault(t, 0.0) <= 3);

        types.sort((a, b) -> {
            int cmp = Double.compare(scores.getOrDefault(b, 0.0), scores.getOrDefault(a, 0.0));
            if (cmp != 0) return cmp;
            // Tie-break: prefer intelligence types that map to top personalities
            boolean aMapped = INTEL_TO_PERSONALITY.getOrDefault(a, Collections.emptyList())
                    .stream().anyMatch(topPersonalities::contains);
            boolean bMapped = INTEL_TO_PERSONALITY.getOrDefault(b, Collections.emptyList())
                    .stream().anyMatch(topPersonalities::contains);
            if (aMapped != bMapped) return aMapped ? -1 : 1;
            return a.compareTo(b);
        });
        return types.subList(0, Math.min(3, types.size()));
    }

    // =====================================================================
    // PHASE 1: TOP 5 ABILITIES (predefined tie-break order)
    // =====================================================================

    private List<String> rankTop5Abilities(Map<String, Double> scores) {
        List<String> sorted = new ArrayList<>(ABILITY_TYPES);
        sorted.sort((a, b) -> {
            int cmp = Double.compare(scores.getOrDefault(b, 0.0), scores.getOrDefault(a, 0.0));
            if (cmp != 0) return cmp;
            // Tie-break by predefined order (index in ABILITY_TYPES)
            return Integer.compare(ABILITY_TYPES.indexOf(a), ABILITY_TYPES.indexOf(b));
        });
        return sorted.subList(0, Math.min(5, sorted.size()));
    }

    // =====================================================================
    // PHASE 1 STEP 5: SUITABILITY INDEX
    // =====================================================================

    private List<String> computeSuitabilityIndex(List<String> top3Personality, Map<String, Double> abilityScores) {
        Set<String> personalityCodes = new HashSet<>();
        Map<String, Integer> personalityRank = new HashMap<>();
        for (int i = 0; i < top3Personality.size(); i++) {
            String code = RIASEC_CODE.getOrDefault(top3Personality.get(i), "");
            personalityCodes.add(code);
            personalityRank.put(code, i + 1);
        }

        // Map ability names to Ab indices for tie-breaking
        List<String> topAbilityKeys = new ArrayList<>();
        List<Map.Entry<String, Double>> sortedAbilities = new ArrayList<>(abilityScores.entrySet());
        sortedAbilities.sort((a, b) -> Double.compare(b.getValue(), a.getValue()));
        for (int i = 0; i < Math.min(5, sortedAbilities.size()); i++) {
            int idx = ABILITY_TYPES.indexOf(sortedAbilities.get(i).getKey());
            if (idx >= 0) topAbilityKeys.add(String.valueOf(idx));
        }

        // Filter pathways where P1 matches student's top personalities
        List<Map<String, Object>> candidates = new ArrayList<>();
        for (Map<String, Object> pathway : SUITABILITY_MAPPING) {
            if (personalityCodes.contains(pathway.get("P1"))) {
                candidates.add(pathway);
            }
        }

        // Sort by personality match quality then ability tie-break
        candidates.sort((a, b) -> {
            int[] matchA = getPersonalityMatchKey(a, personalityRank);
            int[] matchB = getPersonalityMatchKey(b, personalityRank);
            int cmp = Integer.compare(matchB[0], matchA[0]); // more matches first
            if (cmp != 0) return cmp;
            cmp = Integer.compare(matchA[1], matchB[1]); // lower order index first
            if (cmp != 0) return cmp;
            // Ability tie-break
            int[] abA = (int[]) a.get("abilities");
            int[] abB = (int[]) b.get("abilities");
            return compareAbilityTieBreak(abA, abB, topAbilityKeys);
        });

        return candidates.stream()
                .map(c -> (String) c.get("Pathway"))
                .limit(9)
                .collect(Collectors.toList());
    }

    private int[] getPersonalityMatchKey(Map<String, Object> pathway, Map<String, Integer> personalityRank) {
        int matchCount = 0;
        int orderSum = 0;
        for (String key : Arrays.asList("P1", "P2", "P3")) {
            String code = (String) pathway.get(key);
            if (personalityRank.containsKey(code)) {
                matchCount++;
                orderSum += personalityRank.get(code);
            }
        }
        return new int[]{matchCount, orderSum};
    }

    private int compareAbilityTieBreak(int[] abA, int[] abB, List<String> topAbilityKeys) {
        // Compare minimum non-zero ability rank in student's top abilities
        int minA = getMinAbilityRank(abA, topAbilityKeys);
        int minB = getMinAbilityRank(abB, topAbilityKeys);
        return Integer.compare(minA, minB);
    }

    private int getMinAbilityRank(int[] abilities, List<String> topKeys) {
        int min = 999;
        for (String key : topKeys) {
            int idx = Integer.parseInt(key);
            if (idx < abilities.length && abilities[idx] > 0) {
                min = Math.min(min, abilities[idx]);
            }
        }
        return min;
    }

    // =====================================================================
    // PHASE 1 STEP 6: WEAK ABILITY
    // =====================================================================

    private String identifyWeakAbility(List<String> top5Abilities, List<String> top3Pathways) {
        Set<String> top5Norm = top5Abilities.stream()
                .map(a -> a.toLowerCase().trim())
                .collect(Collectors.toSet());

        Set<String> requiredAbilities = new LinkedHashSet<>();
        for (String pathway : top3Pathways) {
            List<String> pathwayAbilities = jsonData.getPathwayAbilities(pathway);
            for (String ability : pathwayAbilities) {
                requiredAbilities.add(ability.toLowerCase().trim());
            }
        }

        for (String required : requiredAbilities) {
            if (!top5Norm.contains(required)) {
                // Find original casing
                for (String a : ABILITY_TYPES) {
                    if (a.toLowerCase().trim().equals(required)) return a;
                }
                return required;
            }
        }
        return "";
    }

    // =====================================================================
    // PHASE 2: CAREER PATHWAY ANALYSIS (Has/Lacks)
    // =====================================================================

    private List<Map<String, Object>> analyzeCareerPathways(
            List<String> top3Personality, List<String> top3Intelligence,
            List<String> top5Abilities, List<String> soi, List<String> values,
            List<String> suitabilityPathways, String classGroup) {

        List<Map<String, Object>> details = new ArrayList<>();
        int limit = classGroup.equals("6-8") ? 3 : Math.min(9, suitabilityPathways.size());

        for (int i = 0; i < limit && i < suitabilityPathways.size(); i++) {
            String pathwayName = suitabilityPathways.get(i);
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("rank", i + 1);
            detail.put("name", pathwayName);

            // Only enrich top 3 with full details
            if (i < 3) {
                detail.put("description", jsonData.getPathwayDescription(pathwayName, classGroup));
                detail.put("subjects", jsonData.getPathwaySubjects(pathwayName, classGroup));
                detail.put("skills", jsonData.getPathwaySkills(pathwayName, classGroup));
                detail.put("courses", jsonData.getPathwayCourses(pathwayName));
                detail.put("exams", jsonData.getPathwayExams(pathwayName));

                // Has/Lacks for 5 attributes
                Map<String, Object> hasLacks = new LinkedHashMap<>();

                // Personality: compare display names (doer/thinker/etc.)
                List<String> studentPersonalityDisplay = top3Personality.stream()
                        .map(p -> GeneralAssessmentJsonDataLoader.PERSONALITY_DISPLAY_MAP
                                .getOrDefault(p.toLowerCase(), p.toLowerCase()))
                        .collect(Collectors.toList());
                List<String> reqPersonality = jsonData.getPathwayPersonalityTypes(pathwayName);
                hasLacks.put("personality", computeHasLacks(studentPersonalityDisplay, reqPersonality));

                // Intelligence
                List<String> studentIntelNorm = top3Intelligence.stream()
                        .map(this::normalizeForComparison).collect(Collectors.toList());
                List<String> reqIntel = jsonData.getPathwayIntelligenceTypes(pathwayName);
                hasLacks.put("intelligence", computeHasLacks(studentIntelNorm, reqIntel));

                // SOI
                List<String> soiNorm = soi.stream().map(this::normalizeForComparison).collect(Collectors.toList());
                List<String> reqSoi = jsonData.getPathwaySubjectsOfInterest(pathwayName);
                hasLacks.put("soi", computeHasLacks(soiNorm, reqSoi));

                // Abilities
                List<String> abilNorm = top5Abilities.stream().map(this::normalizeForComparison).collect(Collectors.toList());
                List<String> reqAbil = jsonData.getPathwayAbilities(pathwayName);
                hasLacks.put("abilities", computeHasLacks(abilNorm, reqAbil));

                // Values
                List<String> valNorm = values.stream().map(this::normalizeForComparison).collect(Collectors.toList());
                List<String> reqVal = jsonData.getPathwayValues(pathwayName);
                hasLacks.put("values", computeHasLacks(valNorm, reqVal));

                detail.put("hasLacks", hasLacks);
            }

            details.add(detail);
        }
        return details;
    }

    private Map<String, List<String>> computeHasLacks(List<String> studentAttrs, List<String> required) {
        List<String> has = new ArrayList<>();
        List<String> lacks = new ArrayList<>();
        Set<String> studentNorm = studentAttrs.stream()
                .map(this::normalizeForComparison).collect(Collectors.toSet());

        for (String req : required) {
            String reqNorm = normalizeForComparison(req);
            if (studentNorm.contains(reqNorm)) {
                has.add(req);
            } else {
                lacks.add(req);
            }
        }
        Map<String, List<String>> result = new HashMap<>();
        result.put("has", has);
        result.put("lacks", lacks);
        return result;
    }

    private String normalizeForComparison(String value) {
        if (value == null) return "";
        return value.toLowerCase().trim()
                .replace('-', ' ')
                .replace('_', ' ')
                .replace('/', ' ')
                .replaceAll("\\s+", " ");
    }

    // =====================================================================
    // PHASE 3: CAREER MATCHING
    // =====================================================================

    private String matchCareerAspirations(List<String> aspirations, List<String> recommendations) {
        if (aspirations.isEmpty()) return null;

        List<String> recNorm = recommendations.stream()
                .map(r -> r.toLowerCase().trim()).collect(Collectors.toList());

        List<String> matched = new ArrayList<>();
        for (String asp : aspirations) {
            String aspNorm = asp.toLowerCase().trim();
            for (String rec : recNorm) {
                if (aspNorm.equals(rec) || aspNorm.contains(rec) || rec.contains(aspNorm)) {
                    matched.add(asp);
                    break;
                }
            }
        }

        if (matched.isEmpty()) {
            return "We notice that your current career aspirations don't directly align with our assessment results. However, this is completely normal and doesn't diminish your potential. The assessment identifies your natural strengths, which can be valuable in many career paths, including the ones you're interested in.";
        } else if (matched.size() == 1) {
            return "Congratulations! Your career aspiration in " + matched.get(0) + " aligns perfectly with our recommendations.";
        } else {
            String text = String.join(", ", matched.subList(0, matched.size() - 1)) + " and " + matched.get(matched.size() - 1);
            return "Excellent news! Your career aspirations in " + text + " align with our recommendations.";
        }
    }

    // =====================================================================
    // ELIGIBILITY CHECK
    // =====================================================================

    private String checkEligibility(Map<String, Double> personality, Map<String, Double> intelligence, Map<String, Double> ability) {
        List<String> issues = new ArrayList<>();
        int lowPersonalityCount = 0;

        for (String trait : PERSONALITY_TRAITS) {
            double score = personality.getOrDefault(trait, 0.0);
            if (score < 9) issues.add("Personality " + trait + ": " + score + " (< 9)");
            if (score == 1) lowPersonalityCount++;
        }
        if (lowPersonalityCount > 3) {
            return "DISQUALIFIED: More than 3 personality traits scoring 1 (" + lowPersonalityCount + " traits)";
        }

        for (String type : INTELLIGENCE_TYPES) {
            if (type.equals("Naturalistic")) continue;
            double score = intelligence.getOrDefault(type, 0.0);
            if (score < 3) issues.add("Intelligence " + type + ": " + score + " (< 3)");
        }

        for (String ability_ : ABILITY_TYPES) {
            double score = ability.getOrDefault(ability_, 0.0);
            if (score < 3) issues.add("Ability " + ability_ + ": " + score + " (< 3)");
        }

        return issues.isEmpty() ? "eligible" : String.join("; ", issues);
    }

    // =====================================================================
    // HELPER METHODS
    // =====================================================================

    private Integer getStudentClass(Long userStudentId) {
        try {
            return userStudentRepository.findById(userStudentId)
                    .map(us -> {
                        if (us.getStudentInfo() != null) {
                            return us.getStudentInfo().getStudentClass();
                        }
                        return null;
                    })
                    .orElse(null);
        } catch (Exception e) {
            logger.warn("Could not get student class for {}: {}", userStudentId, e.getMessage());
            return null;
        }
    }

    private String getClassGroup(Integer studentClass) {
        if (studentClass == null) return "9-10"; // default
        if (studentClass >= 6 && studentClass <= 8) return "6-8";
        if (studentClass >= 9 && studentClass <= 10) return "9-10";
        if (studentClass >= 11 && studentClass <= 12) return "11-12";
        return "9-10";
    }

    private Map<String, Double> extractScoresByNames(List<AssessmentRawScore> rawScores, List<String> dimensionNames) {
        Map<String, Double> result = new LinkedHashMap<>();
        Set<String> namesLower = dimensionNames.stream()
                .map(String::toLowerCase).collect(Collectors.toSet());

        for (AssessmentRawScore rs : rawScores) {
            if (rs.getMeasuredQualityType() != null) {
                String mqtName = rs.getMeasuredQualityType().getMeasuredQualityTypeName();
                if (mqtName != null) {
                    // Try exact match first
                    for (String dim : dimensionNames) {
                        if (dim.equalsIgnoreCase(mqtName.trim())) {
                            result.put(dim, (double) rs.getRawScore());
                            break;
                        }
                    }
                }
            }
        }
        return result;
    }

    private Map<String, List<String>> extractAnswersBySection(List<AssessmentAnswer> answers) {
        Map<String, List<String>> result = new HashMap<>();
        result.put("soi", new ArrayList<>());
        result.put("values", new ArrayList<>());
        result.put("aspirations", new ArrayList<>());

        for (AssessmentAnswer answer : answers) {
            if (answer.getQuestionnaireQuestion() == null || answer.getQuestionnaireQuestion().getSection() == null)
                continue;

            String sectionName = "";
            if (answer.getQuestionnaireQuestion().getSection().getSection() != null) {
                sectionName = answer.getQuestionnaireQuestion().getSection().getSection().getSectionName();
            }
            if (sectionName == null) sectionName = "";
            String sectionLower = sectionName.toLowerCase().trim();

            String optionText = "";
            if (answer.getOption() != null && answer.getOption().getOptionText() != null) {
                optionText = answer.getOption().getOptionText().trim();
            }
            if (optionText.isEmpty()) continue;

            if (sectionLower.contains("subject") || sectionLower.contains("soi") || sectionLower.contains("interest")) {
                result.get("soi").add(optionText);
            } else if (sectionLower.contains("value")) {
                result.get("values").add(optionText);
            } else if (sectionLower.contains("aspiration") || sectionLower.contains("career asp")) {
                result.get("aspirations").add(optionText);
            }
        }
        return result;
    }

    private Map<String, Map<String, Object>> buildPersonalityScoresMap(Map<String, Double> raw, Map<String, Integer> stanines) {
        Map<String, Map<String, Object>> result = new LinkedHashMap<>();
        for (String trait : PERSONALITY_TRAITS) {
            Map<String, Object> entry = new HashMap<>();
            entry.put("raw", raw.getOrDefault(trait, 0.0));
            entry.put("stanine", stanines.getOrDefault(trait, 0));
            result.put(trait, entry);
        }
        return result;
    }

    private List<Map<String, String>> buildPersonalityProfiles(List<String> top3, String classGroup) {
        List<Map<String, String>> profiles = new ArrayList<>();
        for (String trait : top3) {
            Map<String, String> profile = new LinkedHashMap<>();
            profile.put("name", trait);
            profile.put("title", jsonData.getPersonalityTitle(trait));
            profile.put("description", jsonData.getPersonalityDescription(trait, classGroup));
            profile.put("image", jsonData.getPersonalityImage(trait));
            profiles.add(profile);
        }
        return profiles;
    }

    private List<Map<String, String>> buildIntelligenceProfiles(List<String> top3, String classGroup) {
        List<Map<String, String>> profiles = new ArrayList<>();
        for (String type : top3) {
            Map<String, String> profile = new LinkedHashMap<>();
            profile.put("name", type);
            profile.put("title", jsonData.getIntelligenceTitle(type));
            profile.put("description", jsonData.getIntelligenceDescription(type, classGroup));
            profile.put("image", jsonData.getIntelligenceImage(type));
            profiles.add(profile);
        }
        return profiles;
    }

    private List<Map<String, String>> buildLearningStyles(List<String> top3Intelligence) {
        List<Map<String, String>> styles = new ArrayList<>();
        for (String intel : top3Intelligence) {
            Map<String, String> style = new LinkedHashMap<>();
            style.put("intelligence", intel);
            style.put("style", jsonData.getIntelligenceLearningStyleName(intel));
            style.put("enjoys", jsonData.getIntelligenceEnjoyStudiesWith(intel));
            style.put("struggles", jsonData.getIntelligenceStruggleWith(intel));
            styles.add(style);
        }
        return styles;
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            logger.error("JSON serialization error", e);
            return "{}";
        }
    }
}
