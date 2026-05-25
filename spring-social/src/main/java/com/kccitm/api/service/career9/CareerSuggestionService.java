package com.kccitm.api.service.career9;

import com.kccitm.api.model.career9.*;
import com.kccitm.api.repository.AssessmentRawScoreRepository;
import com.kccitm.api.repository.Career9.CareerRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class CareerSuggestionService {

    @Autowired
    private StudentAssessmentMappingRepository mappingRepo;

    @Autowired
    private AssessmentRawScoreRepository rawScoreRepo;

    @Autowired
    private CareerRepository careerRepo;

    /**
     * Main entry point — runs the full Section 1 → 2 → 4 → 5 algorithm.
     */
    public CareerSuggestionResult suggest(Long studentId, Long assessmentId) {
        // Step A: Fetch and group raw scores
        StudentAssessmentMapping mapping = mappingRepo
                .findFirstByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId)
                .orElseThrow(() -> new RuntimeException("No assessment mapping found for student " + studentId));

        List<AssessmentRawScore> scores = rawScoreRepo
                .findByStudentAssessmentMappingStudentAssessmentId(mapping.getStudentAssessmentId());

        // Group by MQ category name
        Map<String, Integer> personalityScores = new LinkedHashMap<>();
        Map<String, Integer> intelligenceScores = new LinkedHashMap<>();
        Map<String, Integer> abilityScores = new LinkedHashMap<>();

        for (AssessmentRawScore s : scores) {
            String mqName = s.getMeasuredQuality() != null ? s.getMeasuredQuality().getMeasuredQualityName() : "";
            String mqtName = s.getMeasuredQualityType() != null ? s.getMeasuredQualityType().getMeasuredQualityTypeName() : "";
            int rawScore = s.getRawScore() != null ? s.getRawScore() : 0;

            if (mqName.toLowerCase().contains("personality")) {
                personalityScores.put(mqtName, rawScore);
            } else if (mqName.toLowerCase().contains("intelligence")) {
                intelligenceScores.put(mqtName, rawScore);
            } else if (mqName.toLowerCase().contains("abilit")) {
                abilityScores.put(mqtName, rawScore);
            }
        }

        // Step B: Top 3 personality traits (with stanine + tie-breaking)
        List<String> top3Personality = getTop3Personality(personalityScores, intelligenceScores, abilityScores);

        // Step C: Top 3 intelligence types
        List<String> top3Intelligence = getTop3Intelligence(intelligenceScores, top3Personality, personalityScores);

        // Step D: Top 5 abilities
        List<String> top5Abilities = getTop5Abilities(abilityScores);

        // Step E: Suitability index — rank all 24 careers
        List<Career> allCareers = careerRepo.findAll();
        List<Career> rankedCareers = rankCareers(allCareers, top3Personality, abilityScores);

        // Build result
        CareerSuggestionResult result = new CareerSuggestionResult();
        result.setGreenPathways(rankedCareers.size() >= 3 ? rankedCareers.subList(0, 3) : rankedCareers);
        result.setOrangePathways(rankedCareers.size() >= 6 ? rankedCareers.subList(3, 6) : Collections.emptyList());
        result.setRedPathways(rankedCareers.size() >= 9 ? rankedCareers.subList(rankedCareers.size() - 3, rankedCareers.size()) : Collections.emptyList());

        // Top traits for response
        result.setTopPersonalityTraits(top3Personality.stream().map(name -> {
            String code = CareerSuggestionTables.NAME_TO_RIASEC.getOrDefault(name, "");
            int raw = personalityScores.getOrDefault(name, 0);
            int stanine = CareerSuggestionTables.getPersonalityStanine(code, raw);
            return new CareerSuggestionResult.MQTScore(name, raw, stanine);
        }).collect(Collectors.toList()));

        result.setTopIntelligenceTypes(top3Intelligence.stream().map(name ->
                new CareerSuggestionResult.MQTScore(name, intelligenceScores.getOrDefault(name, 0), null)
        ).collect(Collectors.toList()));

        result.setTopAbilities(top5Abilities.stream().map(name ->
                new CareerSuggestionResult.MQTScore(name, abilityScores.getOrDefault(name, 0), null)
        ).collect(Collectors.toList()));

        return result;
    }

    // -------------------------------------------------------------------------
    // Section 1: Top 3 Personality Traits
    // -------------------------------------------------------------------------
    private List<String> getTop3Personality(Map<String, Integer> personalityScores,
                                             Map<String, Integer> intelligenceScores,
                                             Map<String, Integer> abilityScores) {
        // Convert names to RIASEC codes for stanine lookup, then sort by stanine desc
        List<String> traits = new ArrayList<>(personalityScores.keySet());

        traits.sort((a, b) -> {
            String codeA = CareerSuggestionTables.NAME_TO_RIASEC.getOrDefault(a, "");
            String codeB = CareerSuggestionTables.NAME_TO_RIASEC.getOrDefault(b, "");
            int stanineA = CareerSuggestionTables.getPersonalityStanine(codeA, personalityScores.getOrDefault(a, 0));
            int stanineB = CareerSuggestionTables.getPersonalityStanine(codeB, personalityScores.getOrDefault(b, 0));

            if (stanineB != stanineA) return stanineB - stanineA;

            // Tie-break 1: intelligence scores
            double avgIntA = avgScoreForPersonality(a, intelligenceScores, CareerSuggestionTables.PERSONALITY_TO_INTELLIGENCE);
            double avgIntB = avgScoreForPersonality(b, intelligenceScores, CareerSuggestionTables.PERSONALITY_TO_INTELLIGENCE);
            if (Double.compare(avgIntB, avgIntA) != 0) return Double.compare(avgIntB, avgIntA);

            // Tie-break 2: ability scores
            double avgAbA = avgScoreForPersonality(a, abilityScores, CareerSuggestionTables.PERSONALITY_TO_ABILITIES);
            double avgAbB = avgScoreForPersonality(b, abilityScores, CareerSuggestionTables.PERSONALITY_TO_ABILITIES);
            if (Double.compare(avgAbB, avgAbA) != 0) return Double.compare(avgAbB, avgAbA);

            // Tie-break 3: count of mapped abilities
            int countA = CareerSuggestionTables.PERSONALITY_TO_ABILITIES.getOrDefault(
                    CareerSuggestionTables.NAME_TO_RIASEC.getOrDefault(a, ""), Collections.emptyList()).size();
            int countB = CareerSuggestionTables.PERSONALITY_TO_ABILITIES.getOrDefault(
                    CareerSuggestionTables.NAME_TO_RIASEC.getOrDefault(b, ""), Collections.emptyList()).size();
            if (countB != countA) return countB - countA;

            // Final fallback defaults: Enterprising > others; Artistic > Realistic
            return personalityFallback(a, b);
        });

        return traits.stream().limit(3).collect(Collectors.toList());
    }

    private double avgScoreForPersonality(String traitName, Map<String, Integer> scores,
                                           Map<String, List<String>> mapping) {
        String code = CareerSuggestionTables.NAME_TO_RIASEC.getOrDefault(traitName, "");
        List<String> mapped = mapping.getOrDefault(code, Collections.emptyList());
        if (mapped.isEmpty()) return 0;
        return mapped.stream().mapToInt(m -> scores.getOrDefault(m, 0)).average().orElse(0);
    }

    private int personalityFallback(String a, String b) {
        // Enterprising wins over all others
        if ("Enterprising".equals(a)) return -1;
        if ("Enterprising".equals(b)) return 1;
        // Artistic beats Realistic
        if ("Artistic".equals(a) && "Realistic".equals(b)) return -1;
        if ("Artistic".equals(b) && "Realistic".equals(a)) return 1;
        return 0;
    }

    // -------------------------------------------------------------------------
    // Section 2: Top 3 Intelligence Types
    // -------------------------------------------------------------------------
    private List<String> getTop3Intelligence(Map<String, Integer> intelligenceScores,
                                              List<String> top3Personality,
                                              Map<String, Integer> personalityScores) {
        List<String> intelligences = new ArrayList<>(intelligenceScores.keySet());

        intelligences.sort((a, b) -> {
            int scoreA = intelligenceScores.getOrDefault(a, 0);
            int scoreB = intelligenceScores.getOrDefault(b, 0);
            if (scoreB != scoreA) return scoreB - scoreA;

            // Tie-break: prefer intelligence that maps to a top personality
            int rankA = intelligencePersonalityRank(a, top3Personality, personalityScores);
            int rankB = intelligencePersonalityRank(b, top3Personality, personalityScores);
            if (rankA != rankB) return rankA - rankB; // lower rank = higher personality priority

            // Elimination: if both map to same personality, apply elimination rule
            String elimA = eliminationPreference(a, top3Personality);
            String elimB = eliminationPreference(b, top3Personality);
            if (elimA != null && elimB == null) return -1;
            if (elimA == null && elimB != null) return 1;

            return 0;
        });

        return intelligences.stream().limit(3).collect(Collectors.toList());
    }

    /** Returns the index (0-based) of the top personality this intelligence maps to, or 999 if none */
    private int intelligencePersonalityRank(String intelligenceName, List<String> top3Personality,
                                             Map<String, Integer> personalityScores) {
        for (int i = 0; i < top3Personality.size(); i++) {
            String code = CareerSuggestionTables.NAME_TO_RIASEC.getOrDefault(top3Personality.get(i), "");
            List<String> mapped = CareerSuggestionTables.PERSONALITY_TO_INTELLIGENCE.getOrDefault(code, Collections.emptyList());
            if (mapped.contains(intelligenceName)) return i;
        }
        return 999;
    }

    /** Returns the intelligence name if it is the preferred one under elimination rules, else null */
    private String eliminationPreference(String intelligenceName, List<String> top3Personality) {
        for (String trait : top3Personality) {
            String code = CareerSuggestionTables.NAME_TO_RIASEC.getOrDefault(trait, "");
            String preferred = CareerSuggestionTables.INTELLIGENCE_ELIMINATION.get(code);
            if (intelligenceName.equals(preferred)) return intelligenceName;
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // Section 4: Top 5 Abilities
    // -------------------------------------------------------------------------
    private List<String> getTop5Abilities(Map<String, Integer> abilityScores) {
        List<String> abilities = new ArrayList<>(abilityScores.keySet());

        abilities.sort((a, b) -> {
            int scoreA = abilityScores.getOrDefault(a, 0);
            int scoreB = abilityScores.getOrDefault(b, 0);
            if (scoreB != scoreA) return scoreB - scoreA;

            // Tie-break: lower index in ABILITY_PRIORITY = higher importance
            int idxA = CareerSuggestionTables.ABILITY_PRIORITY.indexOf(a);
            int idxB = CareerSuggestionTables.ABILITY_PRIORITY.indexOf(b);
            if (idxA < 0) idxA = 999;
            if (idxB < 0) idxB = 999;
            return idxA - idxB;
        });

        return abilities.stream().limit(5).collect(Collectors.toList());
    }

    // -------------------------------------------------------------------------
    // Section 5: Suitability Index — rank careers by personality match + ability
    // -------------------------------------------------------------------------
    private List<Career> rankCareers(List<Career> careers, List<String> top3Personality,
                                      Map<String, Integer> abilityScores) {
        String p1 = top3Personality.size() > 0 ? CareerSuggestionTables.NAME_TO_RIASEC.getOrDefault(top3Personality.get(0), "") : "";
        String p2 = top3Personality.size() > 1 ? CareerSuggestionTables.NAME_TO_RIASEC.getOrDefault(top3Personality.get(1), "") : "";
        String p3 = top3Personality.size() > 2 ? CareerSuggestionTables.NAME_TO_RIASEC.getOrDefault(top3Personality.get(2), "") : "";

        // Assign match level to each career
        Map<Career, Integer> matchLevel = new LinkedHashMap<>();
        for (Career career : careers) {
            int level = getMatchLevel(career, p1, p2, p3);
            matchLevel.put(career, level);
        }

        // Sort: lower level index = better match; tie-break by ability score
        List<Career> sorted = new ArrayList<>(careers);
        sorted.sort((a, b) -> {
            int la = matchLevel.getOrDefault(a, 999);
            int lb = matchLevel.getOrDefault(b, 999);
            if (la != lb) return la - lb;

            // Tie-break: compute career ability match score (sum of weighted ability scores)
            double scoreA = careerAbilityScore(a.getTitle(), abilityScores);
            double scoreB = careerAbilityScore(b.getTitle(), abilityScores);
            return Double.compare(scoreB, scoreA);
        });

        return sorted;
    }

    /**
     * Returns the priority index (lower = better) of the best personality match
     * for this career against student's top 3 personality codes.
     */
    private int getMatchLevel(Career career, String p1, String p2, String p3) {
        String c1 = career.getPersonalityCode1() != null ? career.getPersonalityCode1() : "";
        String c2 = career.getPersonalityCode2() != null ? career.getPersonalityCode2() : "";
        String c3 = career.getPersonalityCode3() != null ? career.getPersonalityCode3() : "";

        List<String> sequence = CareerSuggestionTables.MATCH_PRIORITY_SEQUENCE;
        for (int i = 0; i < sequence.size(); i++) {
            String pattern = sequence.get(i);
            if (matchesPattern(pattern, p1, p2, p3, c1, c2, c3)) return i;
        }
        return sequence.size(); // no match
    }

    /**
     * Checks if a career (c1,c2,c3) matches the pattern using student codes (p1,p2,p3).
     * Pattern digits: 1=student's P1, 2=student's P2, 3=student's P3, _=any position
     */
    private boolean matchesPattern(String pattern, String p1, String p2, String p3,
                                    String c1, String c2, String c3) {
        // Build what we expect c1, c2, c3 to be for this pattern
        char pos1 = pattern.charAt(0);
        char pos2 = pattern.charAt(1);
        char pos3 = pattern.charAt(2);

        String exp1 = charToCode(pos1, p1, p2, p3);
        String exp2 = charToCode(pos2, p1, p2, p3);
        String exp3 = charToCode(pos3, p1, p2, p3);

        return matchCode(c1, exp1) && matchCode(c2, exp2) && matchCode(c3, exp3);
    }

    private String charToCode(char c, String p1, String p2, String p3) {
        if (c == '1') return p1;
        if (c == '2') return p2;
        if (c == '3') return p3;
        return "_"; // wildcard
    }

    private boolean matchCode(String careerCode, String expected) {
        if ("_".equals(expected)) return true; // wildcard matches anything
        return careerCode.equals(expected);
    }

    /**
     * Computes a weighted ability match score for a career.
     * Higher score = better ability match.
     */
    private double careerAbilityScore(String careerTitle, Map<String, Integer> abilityScores) {
        int[] ranks = CareerSuggestionTables.CAREER_ABILITY_RANKS.get(careerTitle);
        if (ranks == null) return 0;
        double total = 0;
        List<String> abilityOrder = CareerSuggestionTables.ABILITY_PRIORITY;
        for (int i = 0; i < ranks.length && i < abilityOrder.size(); i++) {
            if (ranks[i] == 0) continue;
            int studentScore = abilityScores.getOrDefault(abilityOrder.get(i), 0);
            // Weight: rank 1 = most important → higher weight (6 - rank)
            double weight = 6.0 - ranks[i];
            total += weight * studentScore;
        }
        return total;
    }
}
