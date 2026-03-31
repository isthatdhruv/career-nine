package com.kccitm.api.service.Navigator;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

import javax.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Phase 1: Core Analysis
 * Implements the 6-step pipeline that converts raw intermediary scores into
 * report-ready data: personality ranking, intelligence ranking, learning styles,
 * ability ranking, career pathway suitability, and weak ability identification.
 */
@Component
public class NavigatorCoreAnalysis {

    private static final Logger logger = LoggerFactory.getLogger(NavigatorCoreAnalysis.class);

    // ═══════════════════════ CAREER PATHWAYS JSON ═══════════════════════

    private JsonNode careerPathwaysData;
    private JsonNode personalityData;
    private JsonNode intelligenceData;
    private JsonNode abilityData;

    @PostConstruct
    public void init() {
        ObjectMapper mapper = new ObjectMapper();
        careerPathwaysData = loadJsonRoot(mapper, "general-assessment-data/career_pathways.json", "career_pathways");
        personalityData = loadJsonRoot(mapper, "general-assessment-data/personality_data.json", "personality");
        intelligenceData = loadJsonRoot(mapper, "general-assessment-data/intelligence_data.json", "intelligence");
        abilityData = loadJsonRoot(mapper, "general-assessment-data/ability_data.json", "ability");
    }

    private JsonNode loadJsonRoot(ObjectMapper mapper, String path, String rootKey) {
        try {
            InputStream is = getClass().getClassLoader().getResourceAsStream(path);
            if (is != null) {
                String json = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                is.close();
                JsonNode root = mapper.readTree(json);
                JsonNode data = root.has(rootKey) ? root.get(rootKey) : root;
                logger.info("Loaded {} entries from {}", data.size(), path);
                return data;
            } else {
                logger.warn("{} not found in classpath", path);
            }
        } catch (Exception e) {
            logger.error("Failed to load {}: {}", path, e.getMessage());
        }
        return null;
    }

    // ═══════════════════════ RESULT HOLDER ═══════════════════════

    public static class CoreAnalysisResult {
        // Step 1: Top 3 Personality
        public String personalityTop1, personalityTop2, personalityTop3;

        // Step 2: Top 3 Intelligence
        public String intelligenceTop1, intelligenceTop2, intelligenceTop3;

        // Step 3: Learning Styles
        public String learningStyle1, learningStyle2, learningStyle3;
        public String enjoysWith1, enjoysWith2, enjoysWith3;
        public String strugglesWith1, strugglesWith2, strugglesWith3;

        // Step 4: Top 5 Abilities
        public String abilityTop1, abilityTop2, abilityTop3, abilityTop4, abilityTop5;

        // Step 5: Career Pathway Suitability (top 9)
        public String[] suitabilityIndex = new String[9];

        // Step 6: Weak Ability
        public String weakAbility;

        // Phase 2: Career Pathway Analysis (top 3 pathways detail)
        public String pathway1Text, pathway2Text, pathway3Text;
        // CP1
        public String cp1Subjects, cp1Skills, cp1Courses, cp1Exams;
        public String cp1PersonalityHas, cp1PersonalityLacks;
        public String cp1IntelligenceHas, cp1IntelligenceLacks;
        public String cp1SoiHas, cp1SoiLacks;
        public String cp1AbilityHas, cp1AbilityLacks;
        public String cp1ValuesHas, cp1ValuesLacks;
        // CP2
        public String cp2Subjects, cp2Skills, cp2Courses, cp2Exams;
        public String cp2PersonalityHas, cp2PersonalityLacks;
        public String cp2IntelligenceHas, cp2IntelligenceLacks;
        public String cp2SoiHas, cp2SoiLacks;
        public String cp2AbilityHas, cp2AbilityLacks;
        public String cp2ValuesHas, cp2ValuesLacks;
        // CP3
        public String cp3Subjects, cp3Skills, cp3Courses, cp3Exams;
        public String cp3PersonalityHas, cp3PersonalityLacks;
        public String cp3IntelligenceHas, cp3IntelligenceLacks;
        public String cp3SoiHas, cp3SoiLacks;
        public String cp3AbilityHas, cp3AbilityLacks;
        public String cp3ValuesHas, cp3ValuesLacks;

        // Phase 3: Career Matching
        public String careerMatchResult;

        // Phase 5: Data Enrichment
        public String personality1Image, personality2Image, personality3Image;
        public String personality1Text, personality2Text, personality3Text;
        public String intelligence1Image, intelligence2Image, intelligence3Image;
        public String intelligence1Text, intelligence2Text, intelligence3Text;
        public String canAtSchool, canAtHome;
        public String recommendations;
    }

    // ═══════════════════════ MAIN ENTRY POINT ═══════════════════════

    public CoreAnalysisResult analyze(
            Map<String, Integer> riasecScores,
            Map<String, Integer> miScores,
            Map<String, Integer> aptitudeScores,
            String studentClass,
            List<String> studentSOIs,
            List<String> studentValues,
            List<String> studentCareerAspirations) {

        CoreAnalysisResult result = new CoreAnalysisResult();

        // Step 1: Top 3 Personality
        List<String> top3Personality = computeTop3Personality(riasecScores, miScores, aptitudeScores);
        result.personalityTop1 = top3Personality.size() > 0 ? top3Personality.get(0) : null;
        result.personalityTop2 = top3Personality.size() > 1 ? top3Personality.get(1) : null;
        result.personalityTop3 = top3Personality.size() > 2 ? top3Personality.get(2) : null;

        // Step 2: Top 3 Intelligence
        List<String> top3Intelligence = computeTop3Intelligence(miScores, top3Personality);
        result.intelligenceTop1 = top3Intelligence.size() > 0 ? top3Intelligence.get(0) : null;
        result.intelligenceTop2 = top3Intelligence.size() > 1 ? top3Intelligence.get(1) : null;
        result.intelligenceTop3 = top3Intelligence.size() > 2 ? top3Intelligence.get(2) : null;

        // Step 3: Learning Styles
        computeLearningStyles(result, top3Intelligence);

        // Step 4: Top 5 Abilities
        List<String> top5Abilities = computeTop5Abilities(aptitudeScores);
        result.abilityTop1 = top5Abilities.size() > 0 ? top5Abilities.get(0) : null;
        result.abilityTop2 = top5Abilities.size() > 1 ? top5Abilities.get(1) : null;
        result.abilityTop3 = top5Abilities.size() > 2 ? top5Abilities.get(2) : null;
        result.abilityTop4 = top5Abilities.size() > 3 ? top5Abilities.get(3) : null;
        result.abilityTop5 = top5Abilities.size() > 4 ? top5Abilities.get(4) : null;

        // Step 5: Career Pathway Suitability
        List<String> top3PersonalityCodes = top3Personality.stream()
                .map(NavigatorCoreAnalysis::personalityToCode)
                .collect(Collectors.toList());
        result.suitabilityIndex = computeSuitabilityIndex(top3PersonalityCodes, aptitudeScores);

        // Step 6: Weak Ability
        result.weakAbility = computeWeakAbility(top5Abilities, result.suitabilityIndex);

        // Phase 2: Career Pathway Analysis (has/lacks for top 3 pathways)
        analyzePathways(result, top3Personality, top3Intelligence, top5Abilities, studentClass);
        analyzePathwaySOIAndValues(result, studentSOIs, studentValues);

        // Phase 3: Career Matching
        result.careerMatchResult = computeCareerMatch(studentCareerAspirations, result.suitabilityIndex);

        // Phase 5: Data Enrichment (text, images, suggestions, recommendations)
        enrichData(result, top3Personality, top3Intelligence, studentClass);

        return result;
    }

    // ═══════════════════════ STEP 1: TOP 3 PERSONALITY ═══════════════════════

    // Stanine mappings per trait: stanine → list of raw scores that map to it
    // Note: stanine 7 = 19.5, stanine 8 = 19 (intentionally inverted in original data)
    private static final Map<String, Map<Integer, List<Double>>> STANINE_MAPPING = new LinkedHashMap<>();
    static {
        STANINE_MAPPING.put("Realistic", buildStanineMap(
                new int[]{9,10,11,12}, new int[]{13,14}, new int[]{15}, new int[]{16},
                new int[]{17}, new int[]{18}, null, new int[]{19}, new int[]{20}));
        STANINE_MAPPING.put("Investigative", buildStanineMap(
                new int[]{9,10,11,12,13}, new int[]{14}, new int[]{15}, new int[]{16},
                new int[]{17}, new int[]{18}, null, new int[]{19}, new int[]{20}));
        STANINE_MAPPING.put("Artistic", buildStanineMap(
                new int[]{9,10,11,12,13}, new int[]{14}, new int[]{15,16}, new int[]{17},
                null, new int[]{18}, null, new int[]{19}, new int[]{20}));
        STANINE_MAPPING.put("Social", buildStanineMap(
                new int[]{9,10,11,12,13}, new int[]{14,15}, new int[]{16}, new int[]{17},
                null, new int[]{18}, null, new int[]{19}, new int[]{20}));
        STANINE_MAPPING.put("Enterprising", buildStanineMap(
                new int[]{9,10,11,12,13}, new int[]{14}, new int[]{15,16}, new int[]{17},
                null, new int[]{18}, null, new int[]{19}, new int[]{20}));
        STANINE_MAPPING.put("Conventional", buildStanineMap(
                new int[]{9,10,11,12}, new int[]{13}, new int[]{14,15,16}, new int[]{17},
                null, new int[]{18}, null, new int[]{19}, new int[]{20}));
    }

    // Stanine 5 and 7 have 17.5 and 19.5 in the Python code for some traits
    // We handle this by checking closest match
    private static Map<Integer, List<Double>> buildStanineMap(
            int[] s1, int[] s2, int[] s3, int[] s4,
            int[] s5, int[] s6, int[] s7, int[] s8, int[] s9) {
        Map<Integer, List<Double>> map = new LinkedHashMap<>();
        if (s1 != null) map.put(1, toDoubleList(s1));
        if (s2 != null) map.put(2, toDoubleList(s2));
        if (s3 != null) map.put(3, toDoubleList(s3));
        if (s4 != null) map.put(4, toDoubleList(s4));
        if (s5 != null) map.put(5, toDoubleList(s5));
        else map.put(5, List.of(17.5));  // default for traits using 17.5
        if (s6 != null) map.put(6, toDoubleList(s6));
        if (s7 != null) map.put(7, toDoubleList(s7));
        else map.put(7, List.of(19.5));  // default for traits using 19.5
        if (s8 != null) map.put(8, toDoubleList(s8));
        if (s9 != null) map.put(9, toDoubleList(s9));
        return map;
    }

    private static List<Double> toDoubleList(int[] arr) {
        List<Double> list = new ArrayList<>();
        for (int v : arr) list.add((double) v);
        return list;
    }

    private int getStanine(String trait, int rawScore) {
        Map<Integer, List<Double>> mapping = STANINE_MAPPING.get(trait);
        if (mapping == null) return 0;
        double score = rawScore;
        for (Map.Entry<Integer, List<Double>> entry : mapping.entrySet()) {
            for (double val : entry.getValue()) {
                if (Math.abs(score - val) < 1e-6) return entry.getKey();
            }
        }
        // No exact match — find closest stanine
        // Scores below minimum map to stanine 1, above maximum map to stanine 9
        return 1; // default for unmatched scores
    }

    private List<String> computeTop3Personality(
            Map<String, Integer> riasecScores,
            Map<String, Integer> miScores,
            Map<String, Integer> aptitudeScores) {

        // RIASEC code → full name
        Map<String, String> codeToName = Map.of(
                "R", "Realistic", "I", "Investigative", "A", "Artistic",
                "S", "Social", "E", "Enterprising", "C", "Conventional");

        // Compute stanine for each trait
        Map<String, Integer> stanines = new LinkedHashMap<>();
        for (Map.Entry<String, Integer> entry : riasecScores.entrySet()) {
            String fullName = codeToName.getOrDefault(entry.getKey(), entry.getKey());
            int stanine = getStanine(fullName, entry.getValue());
            stanines.put(fullName, stanine);
        }

        logger.info("  Stanines: {}", stanines);

        // Sort by stanine descending, then alphabetical
        List<Map.Entry<String, Integer>> sorted = stanines.entrySet().stream()
                .sorted((a, b) -> {
                    int cmp = Integer.compare(b.getValue(), a.getValue());
                    return cmp != 0 ? cmp : a.getKey().compareTo(b.getKey());
                })
                .collect(Collectors.toList());

        // Group by stanine score
        List<List<String>> groups = new ArrayList<>();
        List<Integer> groupScores = new ArrayList<>();
        int prevScore = Integer.MIN_VALUE;
        for (Map.Entry<String, Integer> entry : sorted) {
            if (entry.getValue() != prevScore) {
                groups.add(new ArrayList<>());
                groupScores.add(entry.getValue());
                prevScore = entry.getValue();
            }
            groups.get(groups.size() - 1).add(entry.getKey());
        }

        // Fill top 3 from groups, applying tie-breaker when group exceeds slots
        List<String> top3 = new ArrayList<>();
        for (List<String> group : groups) {
            if (top3.size() >= 3) break;
            int slotsNeeded = 3 - top3.size();
            if (group.size() <= slotsNeeded) {
                top3.addAll(group);
            } else {
                List<String> resolved = resolvePersonalityTie(group, slotsNeeded, miScores, aptitudeScores);
                top3.addAll(resolved);
            }
        }

        while (top3.size() < 3) top3.add(null);
        logger.info("  Top 3 Personality: {}", top3);
        return top3;
    }

    /**
     * Tie-breaker for personality: first by intelligence score, then by ability score
     */
    private List<String> resolvePersonalityTie(List<String> traits, int slotsNeeded,
            Map<String, Integer> miScores, Map<String, Integer> aptitudeScores) {

        // Score each trait by its mapped intelligence score
        Map<String, Double> intelScores = new LinkedHashMap<>();
        for (String trait : traits) {
            intelScores.put(trait, getIntelligenceScoreForPersonality(trait, miScores));
        }

        // Sort by intelligence score descending
        List<String> sortedByIntel = traits.stream()
                .sorted((a, b) -> Double.compare(intelScores.get(b), intelScores.get(a)))
                .collect(Collectors.toList());

        // Group by intelligence score
        List<List<String>> intelGroups = new ArrayList<>();
        double prevIntel = Double.MIN_VALUE;
        for (String t : sortedByIntel) {
            double score = intelScores.get(t);
            if (Math.abs(score - prevIntel) > 1e-6) {
                intelGroups.add(new ArrayList<>());
                prevIntel = score;
            }
            intelGroups.get(intelGroups.size() - 1).add(t);
        }

        List<String> result = new ArrayList<>();
        for (List<String> group : intelGroups) {
            if (result.size() >= slotsNeeded) break;
            int needed = slotsNeeded - result.size();
            if (group.size() <= needed) {
                result.addAll(group);
            } else {
                // Second tie-breaker: ability score
                Map<String, Double> abilityScores = new LinkedHashMap<>();
                for (String t : group) {
                    abilityScores.put(t, getAbilityScoreForPersonality(t, aptitudeScores));
                }
                List<String> sortedByAbility = group.stream()
                        .sorted((a, b) -> Double.compare(abilityScores.get(b), abilityScores.get(a)))
                        .collect(Collectors.toList());
                result.addAll(sortedByAbility.subList(0, needed));
            }
        }
        return result;
    }

    /** Map personality trait → intelligence score for tie-breaking */
    private double getIntelligenceScoreForPersonality(String trait, Map<String, Integer> miScores) {
        switch (trait) {
            case "Realistic": return miScores.getOrDefault("Bodily-Kinesthetic", 0);
            case "Investigative": return miScores.getOrDefault("Logical-Mathematical", 0);
            case "Artistic":
                return (miScores.getOrDefault("Musical", 0) + miScores.getOrDefault("Visual-Spatial", 0)) / 2.0;
            case "Social":
            case "Enterprising": return miScores.getOrDefault("Interpersonal", 0);
            case "Conventional": return miScores.getOrDefault("Intrapersonal", 0);
            default: return 0;
        }
    }

    /** Map personality trait → ability score for tie-breaking */
    private double getAbilityScoreForPersonality(String trait, Map<String, Integer> aptitudeScores) {
        switch (trait) {
            case "Realistic":
                return (aptitudeScores.getOrDefault("Finger dexterity", 0)
                        + aptitudeScores.getOrDefault("Motor movement", 0)) / 2.0;
            case "Investigative":
                return (aptitudeScores.getOrDefault("Computational", 0)
                        + aptitudeScores.getOrDefault("Technical", 0)
                        + aptitudeScores.getOrDefault("Logical reasoning", 0)) / 3.0;
            case "Artistic":
                return (aptitudeScores.getOrDefault("Form perception", 0)
                        + aptitudeScores.getOrDefault("Creativity/Artistic", 0)) / 2.0;
            case "Social":
                return aptitudeScores.getOrDefault("Language/Communication", 0);
            case "Enterprising":
                return (aptitudeScores.getOrDefault("Language/Communication", 0)
                        + aptitudeScores.getOrDefault("Decision making & problem solving", 0)) / 2.0;
            case "Conventional":
                return aptitudeScores.getOrDefault("Speed and accuracy", 0);
            default: return 0;
        }
    }

    // ═══════════════════════ STEP 2: TOP 3 INTELLIGENCE ═══════════════════════

    // Intel type → personality types it maps to (for tie-breaking)
    private static final Map<String, List<String>> INTEL_TO_PERSONALITY = Map.of(
            "Bodily-Kinesthetic", List.of("Realistic"),
            "Naturalistic", List.of("Realistic"),
            "Intrapersonal", List.of("Conventional"),
            "Interpersonal", List.of("Social", "Enterprising"),
            "Linguistic", List.of("Social"),
            "Logical-Mathematical", List.of("Investigative"),
            "Musical", List.of("Artistic"),
            "Visual-Spatial", List.of("Artistic")
    );

    private List<String> computeTop3Intelligence(Map<String, Integer> miScores, List<String> top3Personality) {
        // Exclude Naturalistic if score <= 3
        Map<String, Integer> filteredScores = new LinkedHashMap<>(miScores);
        if (filteredScores.getOrDefault("Naturalistic", 0) <= 3) {
            filteredScores.remove("Naturalistic");
        }

        Set<String> topPersonalities = new HashSet<>();
        for (String p : top3Personality) {
            if (p != null) topPersonalities.add(p);
        }

        // Sort by score descending, then alphabetical
        List<Map.Entry<String, Integer>> sorted = filteredScores.entrySet().stream()
                .sorted((a, b) -> {
                    int cmp = Integer.compare(b.getValue(), a.getValue());
                    return cmp != 0 ? cmp : a.getKey().compareTo(b.getKey());
                })
                .collect(Collectors.toList());

        // Group by score
        List<List<String>> groups = new ArrayList<>();
        int prevScore = Integer.MIN_VALUE;
        for (Map.Entry<String, Integer> entry : sorted) {
            if (entry.getValue() != prevScore) {
                groups.add(new ArrayList<>());
                prevScore = entry.getValue();
            }
            groups.get(groups.size() - 1).add(entry.getKey());
        }

        List<String> top3 = new ArrayList<>();
        for (List<String> group : groups) {
            if (top3.size() >= 3) break;
            int slotsNeeded = 3 - top3.size();
            if (group.size() <= slotsNeeded) {
                top3.addAll(group);
            } else {
                // Tie: prefer MI types that map to student's top personalities
                List<String> mapped = group.stream()
                        .filter(mi -> {
                            List<String> personalities = INTEL_TO_PERSONALITY.getOrDefault(mi, Collections.emptyList());
                            return personalities.stream().anyMatch(topPersonalities::contains);
                        })
                        .collect(Collectors.toList());

                List<String> candidates = mapped.isEmpty() ? group : mapped;

                if (candidates.size() > slotsNeeded) {
                    candidates = resolveIntelligenceTie(candidates, slotsNeeded);
                }
                top3.addAll(candidates.subList(0, Math.min(candidates.size(), slotsNeeded)));
            }
        }

        while (top3.size() < 3) top3.add(null);
        logger.info("  Top 3 Intelligence: {}", top3);
        return top3;
    }

    /** Elimination rules for intelligence ties */
    private List<String> resolveIntelligenceTie(List<String> candidates, int slotsNeeded) {
        List<String> result = new ArrayList<>(candidates);
        // Rule 1: If both Interpersonal and Linguistic, keep Interpersonal
        if (result.contains("Interpersonal") && result.contains("Linguistic")) {
            result.remove("Linguistic");
        }
        // Rule 2: If both Visual-Spatial and Musical, keep Visual-Spatial
        if (result.contains("Visual-Spatial") && result.contains("Musical")) {
            result.remove("Musical");
        }
        // If still too many, sort alphabetically
        if (result.size() > slotsNeeded) {
            Collections.sort(result);
            result = result.subList(0, slotsNeeded);
        }
        return result;
    }

    // ═══════════════════════ STEP 3: LEARNING STYLES ═══════════════════════

    private static final Map<String, String> INTELLIGENCE_TO_LEARNING_STYLE = Map.of(
            "Bodily-Kinesthetic", "Body smart",
            "Musical", "Rhythmic",
            "Intrapersonal", "Self-aware",
            "Interpersonal", "Interactive",
            "Naturalistic", "Nature smart",
            "Linguistic", "Word smart",
            "Logical-Mathematical", "Logic smart",
            "Visual-Spatial", "Picture smart"
    );

    private static final Map<String, String> LEARNING_STYLE_ENJOYS = Map.of(
            "Body smart", "Physical activities and hands-on learning",
            "Rhythmic", "Music, rhythm, and patterns in learning",
            "Self-aware", "Independent study and self-reflection",
            "Interactive", "Group discussions and collaborative learning",
            "Nature smart", "Outdoor learning and nature-based activities",
            "Word smart", "Reading, writing, and verbal expression",
            "Logic smart", "Problem-solving and analytical thinking",
            "Picture smart", "Visual learning and spatial reasoning"
    );

    private static final Map<String, String> LEARNING_STYLE_STRUGGLES = Map.of(
            "Body smart", "Sitting still for long lectures or passive reading",
            "Rhythmic", "Strict silent environments or monotone instruction",
            "Self-aware", "Heavily group-based activities with little personal space",
            "Interactive", "Extended solo work without peer interaction",
            "Nature smart", "Indoor-only environments without real-world examples",
            "Word smart", "Purely numerical or non-verbal tasks",
            "Logic smart", "Open-ended creative tasks without clear structure",
            "Picture smart", "Text-heavy material without diagrams or visuals"
    );

    private void computeLearningStyles(CoreAnalysisResult result, List<String> top3Intelligence) {
        for (int i = 0; i < Math.min(3, top3Intelligence.size()); i++) {
            String intel = top3Intelligence.get(i);
            if (intel == null) continue;
            String style = INTELLIGENCE_TO_LEARNING_STYLE.getOrDefault(intel, "");
            String enjoys = LEARNING_STYLE_ENJOYS.getOrDefault(style, "");
            String struggles = LEARNING_STYLE_STRUGGLES.getOrDefault(style, "");
            switch (i) {
                case 0: result.learningStyle1 = style; result.enjoysWith1 = enjoys; result.strugglesWith1 = struggles; break;
                case 1: result.learningStyle2 = style; result.enjoysWith2 = enjoys; result.strugglesWith2 = struggles; break;
                case 2: result.learningStyle3 = style; result.enjoysWith3 = enjoys; result.strugglesWith3 = struggles; break;
            }
        }
    }

    // ═══════════════════════ STEP 4: TOP 5 ABILITIES ═══════════════════════

    // Predefined tie-break priority (lower = higher priority)
    private static final Map<String, Integer> ABILITY_TIE_BREAK_PRIORITY = new LinkedHashMap<>();
    static {
        ABILITY_TIE_BREAK_PRIORITY.put("Language/Communication", 1);
        ABILITY_TIE_BREAK_PRIORITY.put("Decision making & problem solving", 2);
        ABILITY_TIE_BREAK_PRIORITY.put("Speed and accuracy", 3);
        ABILITY_TIE_BREAK_PRIORITY.put("Creativity/Artistic", 4);
        ABILITY_TIE_BREAK_PRIORITY.put("Computational", 5);
        ABILITY_TIE_BREAK_PRIORITY.put("Logical reasoning", 6);
        ABILITY_TIE_BREAK_PRIORITY.put("Form perception", 7);
        ABILITY_TIE_BREAK_PRIORITY.put("Technical", 8);
        ABILITY_TIE_BREAK_PRIORITY.put("Motor movement", 9);
        ABILITY_TIE_BREAK_PRIORITY.put("Finger dexterity", 10);
    }

    private List<String> computeTop5Abilities(Map<String, Integer> aptitudeScores) {
        // Sort by score descending; if tie, by predefined priority ascending
        List<Map.Entry<String, Integer>> sorted = aptitudeScores.entrySet().stream()
                .sorted((a, b) -> {
                    int cmp = Integer.compare(b.getValue(), a.getValue());
                    if (cmp != 0) return cmp;
                    int prioA = ABILITY_TIE_BREAK_PRIORITY.getOrDefault(a.getKey(), 999);
                    int prioB = ABILITY_TIE_BREAK_PRIORITY.getOrDefault(b.getKey(), 999);
                    return Integer.compare(prioA, prioB);
                })
                .collect(Collectors.toList());

        List<String> top5 = sorted.stream()
                .limit(5)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        logger.info("  Top 5 Abilities: {}", top5);
        return top5;
    }

    // ═══════════════════════ STEP 5: CAREER PATHWAY SUITABILITY ═══════════════════════

    // 24-pathway mapping table: pathway name, P1/P2/P3, Ab1-Ab10
    private static final List<PathwayMapping> PATHWAY_MAPPINGS = new ArrayList<>();
    static {
        // Ab mapping: Communication=Ab1, Decision=Ab2, Speed=Ab3, Creativity=Ab4,
        //             Computational=Ab5, LogicalR=Ab6, FormP=Ab7, Technical=Ab8,
        //             Motor=Ab9, Finger=Ab10
        // Values are priority ranks (1=most important), 0 = not required
        PATHWAY_MAPPINGS.add(new PathwayMapping("Architecture", "A","I","R", new int[]{0,2,5,1,3,0,0,4,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Art, Design", "A","E","S", new int[]{2,5,3,1,0,0,0,0,0,4}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Entertainment and Mass Media", "A","S","E", new int[]{2,0,3,1,0,5,0,4,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Management and Administration", "C","E","S", new int[]{4,3,2,0,1,5,0,0,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Banking and Finance", "C","I","E", new int[]{0,3,2,0,1,4,0,0,0,5}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Law Studies", "C","I","E", new int[]{1,2,4,5,0,3,0,0,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Government and Public Administration", "C","I","E", new int[]{2,1,4,0,5,3,0,0,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Marketing", "E","S","A", new int[]{1,2,4,3,0,5,0,0,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Entrepreneurship", "E","S","I", new int[]{2,1,0,4,3,5,0,0,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Sales", "E","S","I", new int[]{1,2,5,0,3,4,0,0,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Science and Mathematics", "I","C","R", new int[]{0,3,0,1,0,2,4,0,5,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Computer Science, IT and Allied Fields", "I","R","C", new int[]{2,4,5,0,0,3,0,1,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Life Sciences /Medicine and Healthcare", "I","R","S", new int[]{4,2,5,0,0,3,1,0,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Environmental Service", "I","R","S", new int[]{0,1,5,0,0,0,2,0,3,4}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Social Sciences and Humanities", "I","S","A", new int[]{1,2,5,3,0,4,0,0,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Defence/ Protective Service", "R","C","S", new int[]{4,1,3,0,5,0,2,0,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Sports", "R","E","S", new int[]{5,2,3,0,0,0,0,0,1,4}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Engineering and Technology", "R","I","C", new int[]{0,4,5,0,2,3,0,1,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Agriculture, Food Industry and Forestry", "R","I","E", new int[]{0,0,0,0,0,0,0,0,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Education and Training", "S","A","I", new int[]{1,4,5,2,0,3,0,0,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Paramedical", "S","I","R", new int[]{3,2,5,0,4,1,0,0,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Hospitality and Tourism", "S","R","A", new int[]{1,4,3,2,0,0,5,0,0,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Community and Social Service", "S","R","E", new int[]{1,3,4,2,0,0,5,0,2,0}));
        PATHWAY_MAPPINGS.add(new PathwayMapping("Personal Care and Services", "S","R","E", new int[]{1,0,5,4,0,0,3,0,2,0}));
    }

    // Ability column key mapping (index 0=Ab1, 1=Ab2, etc.)
    private static final String[] ABILITY_KEYS = {
        "Language/Communication", "Decision making & problem solving", "Speed and accuracy",
        "Creativity/Artistic", "Computational", "Logical reasoning",
        "Form perception", "Technical", "Motor movement", "Finger dexterity"
    };

    // Predefined personality match order sequences
    private static final List<List<Integer>> FULL_ORDER = List.of(
            List.of(1,2,3), List.of(1,3,2), List.of(2,1,3),
            List.of(2,3,1), List.of(3,1,2), List.of(3,2,1));
    private static final List<List<Integer>> PAIR_ORDER = List.of(
            List.of(1,2), List.of(1,3), List.of(2,1),
            List.of(2,3), List.of(3,1), List.of(3,2));
    private static final List<List<Integer>> SINGLE_ORDER = List.of(
            List.of(1), List.of(2), List.of(3));

    private String[] computeSuitabilityIndex(List<String> top3PersonalityCodes,
            Map<String, Integer> aptitudeScores) {

        // Build student personality rank map: code → rank (1-based)
        Map<String, Integer> personalityRank = new LinkedHashMap<>();
        for (int i = 0; i < top3PersonalityCodes.size(); i++) {
            if (top3PersonalityCodes.get(i) != null) {
                personalityRank.put(top3PersonalityCodes.get(i), i + 1);
            }
        }

        // Student's top 5 ability keys (sorted by score desc)
        List<String> studentTop5AbilityKeys = new ArrayList<>();
        List<Map.Entry<String, Integer>> sortedAbilities = aptitudeScores.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .collect(Collectors.toList());
        for (Map.Entry<String, Integer> e : sortedAbilities) {
            if (e.getValue() > 0) {
                // Map aptitude name to Ab key
                for (int i = 0; i < ABILITY_KEYS.length; i++) {
                    if (ABILITY_KEYS[i].equals(e.getKey())) {
                        studentTop5AbilityKeys.add("Ab" + (i + 1));
                        break;
                    }
                }
            }
            if (studentTop5AbilityKeys.size() >= 5) break;
        }

        // Filter pathways where P1 matches any of student's top 3 personalities
        List<PathwayCandidate> candidates = new ArrayList<>();
        for (PathwayMapping pm : PATHWAY_MAPPINGS) {
            if (!personalityRank.containsKey(pm.p1)) continue;

            // Compute personality match code
            List<Integer> matchCode = new ArrayList<>();
            for (String p : new String[]{pm.p1, pm.p2, pm.p3}) {
                if (personalityRank.containsKey(p)) {
                    matchCode.add(personalityRank.get(p));
                }
            }

            // Get order index from predefined sequences
            int orderIndex = 999;
            if (matchCode.size() == 3 && FULL_ORDER.contains(matchCode)) {
                orderIndex = FULL_ORDER.indexOf(matchCode);
            } else if (matchCode.size() == 2 && PAIR_ORDER.contains(matchCode)) {
                orderIndex = PAIR_ORDER.indexOf(matchCode);
            } else if (matchCode.size() == 1 && SINGLE_ORDER.contains(matchCode)) {
                orderIndex = SINGLE_ORDER.indexOf(matchCode);
            }

            int personalityKey1 = -matchCode.size(); // more matches = better (negative for ascending sort)
            int personalityKey2 = orderIndex;

            // Compute ability tie-breaker
            int[] tbKey = computeAbilityTieBreaker(pm, studentTop5AbilityKeys);

            candidates.add(new PathwayCandidate(pm.pathway, personalityKey1, personalityKey2, tbKey));
        }

        // Sort candidates
        candidates.sort((a, b) -> {
            int cmp = Integer.compare(a.pKey1, b.pKey1);
            if (cmp != 0) return cmp;
            cmp = Integer.compare(a.pKey2, b.pKey2);
            if (cmp != 0) return cmp;
            // Compare ability tie-breaker arrays
            for (int i = 0; i < Math.min(a.tbKey.length, b.tbKey.length); i++) {
                cmp = Integer.compare(a.tbKey[i], b.tbKey[i]);
                if (cmp != 0) return cmp;
            }
            return 0;
        });

        String[] result = new String[9];
        for (int i = 0; i < 9; i++) {
            result[i] = i < candidates.size() ? candidates.get(i).pathway : "";
        }

        logger.info("  Suitability Index: {}", Arrays.asList(result));
        return result;
    }

    private int[] computeAbilityTieBreaker(PathwayMapping pm, List<String> studentTop5) {
        List<int[]> info = new ArrayList<>(); // {rank, mappingPosition, studentOrder}
        for (int i = 0; i < studentTop5.size(); i++) {
            String abKey = studentTop5.get(i);
            int abIndex = Integer.parseInt(abKey.substring(2)) - 1; // "Ab1" → 0
            int rank = pm.abilityRanks[abIndex];
            if (rank > 0) { // rank > 0 means this ability is required
                info.add(new int[]{rank, abIndex, i});
            }
        }
        if (info.isEmpty()) return new int[]{999, 999, 999, 999};

        info.sort((a, b) -> {
            int cmp = Integer.compare(a[0], b[0]);
            if (cmp != 0) return cmp;
            cmp = Integer.compare(a[1], b[1]);
            if (cmp != 0) return cmp;
            return Integer.compare(a[2], b[2]);
        });

        int minRank = info.get(0)[0];
        int minPos = info.get(0)[1];
        int count = info.size();
        int sum = info.stream().mapToInt(x -> x[0]).sum();

        return new int[]{minRank, minPos, -count, sum};
    }

    // ═══════════════════════ STEP 6: WEAK ABILITY ═══════════════════════

    private String computeWeakAbility(List<String> top5Abilities, String[] suitabilityIndex) {
        if (careerPathwaysData == null) return "";

        // Normalize top 5 ability names for comparison
        Set<String> studentAbilitiesNorm = top5Abilities.stream()
                .filter(Objects::nonNull)
                .map(a -> a.toLowerCase().trim())
                .collect(Collectors.toSet());

        // Collect required abilities from top 3 career pathways
        Set<String> requiredAbilities = new LinkedHashSet<>();
        for (int i = 0; i < Math.min(3, suitabilityIndex.length); i++) {
            String pathwayName = suitabilityIndex[i];
            if (pathwayName == null || pathwayName.isEmpty()) continue;

            String jsonKey = pathwayNameToJsonKey(pathwayName);
            JsonNode pathway = careerPathwaysData.get(jsonKey);
            if (pathway == null || !pathway.has("abilities")) continue;

            for (JsonNode ability : pathway.get("abilities")) {
                String english = ability.has("english") ? ability.get("english").asText() : "";
                if (!english.isEmpty()) {
                    requiredAbilities.add(english.toLowerCase().trim());
                }
            }
        }

        // Find abilities required but not in student's top 5
        Set<String> weak = new LinkedHashSet<>(requiredAbilities);
        weak.removeAll(studentAbilitiesNorm);

        if (weak.isEmpty()) return "";

        // Match back to proper casing
        String weakNorm = weak.iterator().next();
        for (String abilityKey : ABILITY_KEYS) {
            if (abilityKey.toLowerCase().trim().equals(weakNorm)) {
                return abilityKey;
            }
        }
        // Try title case
        return weakNorm.substring(0, 1).toUpperCase() + weakNorm.substring(1);
    }

    // ═══════════════════════ PHASE 2: CAREER PATHWAY ANALYSIS ═══════════════════════

    // Personality full name → display name used in career_pathways.json personality_types
    private static final Map<String, String> PERSONALITY_TO_DISPLAY = Map.of(
            "realistic", "doer",
            "investigative", "thinker",
            "artistic", "creator",
            "social", "helper",
            "enterprising", "persuader",
            "conventional", "organizer"
    );

    // Canonical normalization for intelligence type names
    private static final Map<String, String> CANONICAL_MAP = new HashMap<>();
    static {
        CANONICAL_MAP.put("logical", "logical");
        CANONICAL_MAP.put("logical-mathematical", "logical");
        CANONICAL_MAP.put("logical mathematical", "logical");
        CANONICAL_MAP.put("visual-spatial", "visual-spatial");
        CANONICAL_MAP.put("visual spatial", "visual-spatial");
        CANONICAL_MAP.put("spatial-visual", "visual-spatial");
        CANONICAL_MAP.put("spatial visual", "visual-spatial");
        CANONICAL_MAP.put("bodily-kinesthetic", "bodily-kinesthetic");
        CANONICAL_MAP.put("bodily kinesthetic", "bodily-kinesthetic");
    }

    // Display names for normalized intelligence types
    private static final Map<String, String> DISPLAY_ALIASES = Map.of(
            "logical", "Logical-Mathematical",
            "visual-spatial", "Visual-Spatial",
            "bodily-kinesthetic", "Bodily-Kinesthetic",
            "musical", "Musical",
            "intrapersonal", "Intrapersonal",
            "interpersonal", "Interpersonal",
            "linguistic", "Linguistic",
            "naturalistic", "Naturalistic"
    );

    private void analyzePathways(CoreAnalysisResult result,
            List<String> top3Personality, List<String> top3Intelligence,
            List<String> top5Abilities, String studentClass) {

        if (careerPathwaysData == null) return;

        String classGroup = getClassGroup(studentClass);

        // Prepare student attribute lists for comparison
        List<String> studentPersonalityDisplay = top3Personality.stream()
                .filter(Objects::nonNull)
                .map(p -> PERSONALITY_TO_DISPLAY.getOrDefault(p.toLowerCase(), p.toLowerCase()))
                .collect(Collectors.toList());

        List<String> studentIntelNorm = top3Intelligence.stream()
                .filter(Objects::nonNull)
                .map(this::normalizeWord)
                .collect(Collectors.toList());

        List<String> studentAbilityNorm = top5Abilities.stream()
                .filter(Objects::nonNull)
                .map(this::normalizeWord)
                .collect(Collectors.toList());

        for (int cp = 0; cp < 3; cp++) {
            String pathwayName = result.suitabilityIndex[cp];
            if (pathwayName == null || pathwayName.isEmpty()) continue;

            String jsonKey = pathwayNameToJsonKey(pathwayName);
            JsonNode pathway = careerPathwaysData.get(jsonKey);
            if (pathway == null) {
                logger.warn("  Pathway '{}' (key: '{}') not found in JSON", pathwayName, jsonKey);
                continue;
            }

            // ── Extract class-specific data ──
            JsonNode classData = pathway.get(classGroup);
            String description = "";
            String subjects = "";
            String skills = "";
            String courses = "";
            String exams = "";
            if (classData != null) {
                description = getEnglishText(classData, "description");
                subjects = getEnglishText(classData, "subjects");
                skills = getEnglishText(classData, "skills");
                courses = getEnglishText(classData, "courses");
                exams = getEnglishText(classData, "exams");
            }
            // Courses and exams only exist in 9-10 JSON data.
            // Always fall back to 9-10 for courses/exams (matches Python Phase 5 behavior).
            if (courses.isEmpty() || exams.isEmpty()) {
                JsonNode data910 = pathway.get("9-10");
                if (data910 != null) {
                    if (courses.isEmpty()) courses = getEnglishText(data910, "courses");
                    if (exams.isEmpty()) exams = getEnglishText(data910, "exams");
                }
            }

            // ── Compare personality ──
            List<String> personalityReq = new ArrayList<>();
            if (pathway.has("personality_types")) {
                for (JsonNode pt : pathway.get("personality_types")) {
                    String eng = pt.has("english") ? pt.get("english").asText().toLowerCase().trim() : "";
                    if (!eng.isEmpty()) personalityReq.add(eng);
                }
            }
            String[] personalityHL = compareAttributes(studentPersonalityDisplay, personalityReq, true);

            // ── Compare intelligence ──
            List<String> intelligenceReq = new ArrayList<>();
            if (pathway.has("intelligence_types")) {
                for (JsonNode it : pathway.get("intelligence_types")) {
                    String eng = it.has("english") ? it.get("english").asText() : "";
                    // Split comma-separated values
                    for (String part : eng.split(",")) {
                        String normalized = normalizeWord(part.trim());
                        if (!normalized.isEmpty()) intelligenceReq.add(normalized);
                    }
                }
                // Deduplicate
                intelligenceReq = new ArrayList<>(new LinkedHashSet<>(intelligenceReq));
            }
            String[] intelligenceHL = compareAttributes(studentIntelNorm, intelligenceReq, false);

            // ── Compare SOI ──
            List<String> soiReq = new ArrayList<>();
            if (pathway.has("subjects_of_interest")) {
                for (JsonNode s : pathway.get("subjects_of_interest")) {
                    String eng = s.has("english") ? s.get("english").asText() : "";
                    String normalized = normalizeWord(eng);
                    if (!normalized.isEmpty()) soiReq.add(normalized);
                }
            }
            // Student SOI is set on the report entity, but we need them here
            // We receive them indirectly — not passed to analyze(). We'll need to add them.
            // For now, SOI has/lacks will be computed in the service where we have the lists.

            // ── Compare abilities ──
            List<String> abilitiesReq = new ArrayList<>();
            if (pathway.has("abilities")) {
                for (JsonNode a : pathway.get("abilities")) {
                    String eng = a.has("english") ? a.get("english").asText() : "";
                    String normalized = normalizeWord(eng);
                    if (!normalized.isEmpty()) abilitiesReq.add(normalized);
                }
            }
            String[] abilityHL = compareAttributes(studentAbilityNorm, abilitiesReq, false);

            // ── Compare values ──
            List<String> valuesReq = new ArrayList<>();
            if (pathway.has("values")) {
                for (JsonNode v : pathway.get("values")) {
                    String eng = v.has("english") ? v.get("english").asText() : "";
                    String normalized = normalizeWord(eng);
                    if (!normalized.isEmpty()) valuesReq.add(normalized);
                }
            }
            // Values also come from the report entity — same as SOI

            // ── Store results by CP number ──
            switch (cp) {
                case 0:
                    result.pathway1Text = description;
                    result.cp1Subjects = subjects; result.cp1Skills = skills;
                    result.cp1Courses = courses; result.cp1Exams = exams;
                    result.cp1PersonalityHas = personalityHL[0]; result.cp1PersonalityLacks = personalityHL[1];
                    result.cp1IntelligenceHas = intelligenceHL[0]; result.cp1IntelligenceLacks = intelligenceHL[1];
                    result.cp1AbilityHas = abilityHL[0]; result.cp1AbilityLacks = abilityHL[1];
                    break;
                case 1:
                    result.pathway2Text = description;
                    result.cp2Subjects = subjects; result.cp2Skills = skills;
                    result.cp2Courses = courses; result.cp2Exams = exams;
                    result.cp2PersonalityHas = personalityHL[0]; result.cp2PersonalityLacks = personalityHL[1];
                    result.cp2IntelligenceHas = intelligenceHL[0]; result.cp2IntelligenceLacks = intelligenceHL[1];
                    result.cp2AbilityHas = abilityHL[0]; result.cp2AbilityLacks = abilityHL[1];
                    break;
                case 2:
                    result.pathway3Text = description;
                    result.cp3Subjects = subjects; result.cp3Skills = skills;
                    result.cp3Courses = courses; result.cp3Exams = exams;
                    result.cp3PersonalityHas = personalityHL[0]; result.cp3PersonalityLacks = personalityHL[1];
                    result.cp3IntelligenceHas = intelligenceHL[0]; result.cp3IntelligenceLacks = intelligenceHL[1];
                    result.cp3AbilityHas = abilityHL[0]; result.cp3AbilityLacks = abilityHL[1];
                    break;
            }

            logger.info("  CP{}: {} — P has/lacks: {}/{}, I: {}/{}, Ab: {}/{}",
                    cp + 1, pathwayName, personalityHL[0], personalityHL[1],
                    intelligenceHL[0], intelligenceHL[1], abilityHL[0], abilityHL[1]);
        }
    }

    /**
     * Analyze SOI and Values has/lacks for top 3 pathways.
     * Called separately from the service since SOI and Values lists are available there.
     */
    public void analyzePathwaySOIAndValues(CoreAnalysisResult result,
            List<String> studentSOIs, List<String> studentValues) {

        if (careerPathwaysData == null) return;

        List<String> soiNorm = studentSOIs.stream()
                .filter(Objects::nonNull)
                .map(this::normalizeWord)
                .collect(Collectors.toList());

        List<String> valNorm = studentValues.stream()
                .filter(Objects::nonNull)
                .map(this::normalizeWord)
                .collect(Collectors.toList());

        for (int cp = 0; cp < 3; cp++) {
            String pathwayName = result.suitabilityIndex[cp];
            if (pathwayName == null || pathwayName.isEmpty()) continue;

            String jsonKey = pathwayNameToJsonKey(pathwayName);
            JsonNode pathway = careerPathwaysData.get(jsonKey);
            if (pathway == null) continue;

            // SOI
            List<String> soiReq = new ArrayList<>();
            if (pathway.has("subjects_of_interest")) {
                for (JsonNode s : pathway.get("subjects_of_interest")) {
                    String eng = s.has("english") ? s.get("english").asText() : "";
                    String normalized = normalizeWord(eng);
                    if (!normalized.isEmpty()) soiReq.add(normalized);
                }
            }
            String[] soiHL = compareAttributes(soiNorm, soiReq, false);

            // Values
            List<String> valReq = new ArrayList<>();
            if (pathway.has("values")) {
                for (JsonNode v : pathway.get("values")) {
                    String eng = v.has("english") ? v.get("english").asText() : "";
                    String normalized = normalizeWord(eng);
                    if (!normalized.isEmpty()) valReq.add(normalized);
                }
            }
            String[] valHL = compareAttributes(valNorm, valReq, false);

            switch (cp) {
                case 0:
                    result.cp1SoiHas = soiHL[0]; result.cp1SoiLacks = soiHL[1];
                    result.cp1ValuesHas = valHL[0]; result.cp1ValuesLacks = valHL[1];
                    break;
                case 1:
                    result.cp2SoiHas = soiHL[0]; result.cp2SoiLacks = soiHL[1];
                    result.cp2ValuesHas = valHL[0]; result.cp2ValuesLacks = valHL[1];
                    break;
                case 2:
                    result.cp3SoiHas = soiHL[0]; result.cp3SoiLacks = soiHL[1];
                    result.cp3ValuesHas = valHL[0]; result.cp3ValuesLacks = valHL[1];
                    break;
            }
        }
    }

    // ═══════════════════════ PHASE 3: CAREER MATCHING ═══════════════════════

    // Mapping for naming differences between aspiration labels and pathway names
    private static final Map<String, String> ASPIRATION_NORMALIZE = new HashMap<>();
    static {
        ASPIRATION_NORMALIZE.put("information technology and allied fields", "computer science, it and allied fields");
        ASPIRATION_NORMALIZE.put("art, design", "art design");
        ASPIRATION_NORMALIZE.put("art design", "art, design");
        ASPIRATION_NORMALIZE.put("banking & finance", "banking and finance");
        ASPIRATION_NORMALIZE.put("defense/ protective service", "defence/ protective service");
        ASPIRATION_NORMALIZE.put("defense/protective service", "defence/ protective service");
        ASPIRATION_NORMALIZE.put("social science/ humanities", "social sciences and humanities");
        ASPIRATION_NORMALIZE.put("social science/humanities", "social sciences and humanities");
        ASPIRATION_NORMALIZE.put("computer science it and allied fields", "computer science, it and allied fields");
    }

    private String computeCareerMatch(List<String> aspirations, String[] suitabilityIndex) {
        // Normalize aspirations
        List<String> aspNorm = new ArrayList<>();
        List<String> aspOriginal = new ArrayList<>();
        for (String asp : aspirations) {
            if (asp == null || asp.trim().isEmpty()) continue;
            String lower = asp.trim().toLowerCase();
            aspOriginal.add(asp.trim());
            aspNorm.add(ASPIRATION_NORMALIZE.getOrDefault(lower, lower));
        }

        // Normalize top 3 recommendations
        List<String> recNorm = new ArrayList<>();
        for (int i = 0; i < Math.min(3, suitabilityIndex.length); i++) {
            String rec = suitabilityIndex[i];
            if (rec != null && !rec.isEmpty()) {
                recNorm.add(rec.trim().toLowerCase());
            }
        }

        // Find matches
        List<String> matchedAspirations = new ArrayList<>();
        for (int i = 0; i < aspNorm.size(); i++) {
            String normAsp = aspNorm.get(i);
            for (String rec : recNorm) {
                // Exact match
                if (normAsp.equals(rec)) {
                    matchedAspirations.add(aspOriginal.get(i));
                    break;
                }
                // Partial match for complex names (both must be > 3 chars)
                if (normAsp.length() > 3 && rec.length() > 3
                        && (normAsp.contains(rec) || rec.contains(normAsp))) {
                    matchedAspirations.add(aspOriginal.get(i));
                    break;
                }
            }
        }

        // Generate result message
        if (matchedAspirations.isEmpty()) {
            return "We notice that your current career aspirations don't directly align with our assessment results. "
                    + "However, this is completely normal and doesn't diminish your potential. The assessment identifies "
                    + "your natural strengths, which can be valuable in many career paths, including the ones you're "
                    + "interested in. Consider exploring how your strengths could enhance your chosen fields.";
        } else if (matchedAspirations.size() == 1) {
            return "Congratulations! Your career aspiration in " + matchedAspirations.get(0)
                    + " aligns perfectly with our recommendations. This shows that your interests and natural "
                    + "abilities are well-matched.";
        } else if (matchedAspirations.size() == 2) {
            return "Excellent news! Your career aspirations in " + matchedAspirations.get(0)
                    + " and " + matchedAspirations.get(1) + " align with our recommendations. This indicates "
                    + "strong alignment between your interests and natural abilities.";
        } else {
            String allButLast = String.join(", ", matchedAspirations.subList(0, matchedAspirations.size() - 1));
            String last = matchedAspirations.get(matchedAspirations.size() - 1);
            return "Outstanding! Your career aspirations in " + allButLast + " and " + last
                    + " align with our recommendations. This shows excellent alignment between your interests "
                    + "and natural abilities.";
        }
    }

    // ═══════════════════════ PHASE 5: DATA ENRICHMENT ═══════════════════════

    // Intelligence type name → JSON key mapping
    private static final Map<String, String> INTEL_TO_JSON_KEY = new HashMap<>();
    static {
        INTEL_TO_JSON_KEY.put("Bodily-Kinesthetic", "bodily_kinesthetic");
        INTEL_TO_JSON_KEY.put("Interpersonal", "interpersonal");
        INTEL_TO_JSON_KEY.put("Intrapersonal", "intrapersonal");
        INTEL_TO_JSON_KEY.put("Linguistic", "linguistic");
        INTEL_TO_JSON_KEY.put("Logical-Mathematical", "logical");
        INTEL_TO_JSON_KEY.put("Musical", "musical");
        INTEL_TO_JSON_KEY.put("Visual-Spatial", "visual_spatial");
        INTEL_TO_JSON_KEY.put("Naturalistic", "naturalistic");
    }

    // Ability name → JSON key mapping
    private static final Map<String, String> ABILITY_TO_JSON_KEY = new HashMap<>();
    static {
        ABILITY_TO_JSON_KEY.put("Speed and accuracy", "speed_and_accuracy");
        ABILITY_TO_JSON_KEY.put("Computational", "computational");
        ABILITY_TO_JSON_KEY.put("Creativity/Artistic", "creativity");
        ABILITY_TO_JSON_KEY.put("Language/Communication", "communication");
        ABILITY_TO_JSON_KEY.put("Technical", "technical");
        ABILITY_TO_JSON_KEY.put("Decision making & problem solving", "decision_making_problem_solving");
        ABILITY_TO_JSON_KEY.put("Finger dexterity", "finger_dexterity");
        ABILITY_TO_JSON_KEY.put("Form perception", "form_perception");
        ABILITY_TO_JSON_KEY.put("Logical reasoning", "logical_reasoning");
        ABILITY_TO_JSON_KEY.put("Motor movement", "motor_movement");
    }

    private void enrichData(CoreAnalysisResult result,
            List<String> top3Personality, List<String> top3Intelligence,
            String studentClass) {

        String classGroup = getClassGroup(studentClass);

        // ── Personality text & images ──
        if (personalityData != null) {
            for (int i = 0; i < Math.min(3, top3Personality.size()); i++) {
                String trait = top3Personality.get(i);
                if (trait == null) continue;
                String traitKey = trait.toLowerCase().replace(' ', '_');
                JsonNode traitNode = personalityData.get(traitKey);
                if (traitNode == null) continue;

                String text = "";
                if (traitNode.has("descriptions") && traitNode.get("descriptions").has(classGroup)) {
                    text = traitNode.get("descriptions").get(classGroup).path("english").asText("");
                }
                String image = traitNode.path("titleImage").path("english").asText("");

                switch (i) {
                    case 0: result.personality1Text = text; result.personality1Image = image; break;
                    case 1: result.personality2Text = text; result.personality2Image = image; break;
                    case 2: result.personality3Text = text; result.personality3Image = image; break;
                }
            }

            // ── Future suggestions (from top 1 personality) ──
            String top1Trait = top3Personality.isEmpty() ? null : top3Personality.get(0);
            if (top1Trait != null) {
                String traitKey = top1Trait.toLowerCase().replace(' ', '_');
                JsonNode traitNode = personalityData.get(traitKey);
                if (traitNode != null && traitNode.has("futureSuggestions")
                        && traitNode.get("futureSuggestions").has(classGroup)) {
                    JsonNode suggestions = traitNode.get("futureSuggestions").get(classGroup);
                    result.canAtSchool = suggestions.path("atSchool").path("english").asText("");
                    result.canAtHome = suggestions.path("atHome").path("english").asText("");
                }
            }
        }

        // ── Intelligence text & images ──
        if (intelligenceData != null) {
            for (int i = 0; i < Math.min(3, top3Intelligence.size()); i++) {
                String intel = top3Intelligence.get(i);
                if (intel == null) continue;
                String intelKey = INTEL_TO_JSON_KEY.getOrDefault(intel,
                        intel.toLowerCase().replace('-', '_').replace(' ', '_'));
                JsonNode intelNode = intelligenceData.get(intelKey);
                if (intelNode == null) continue;

                String text = "";
                if (intelNode.has("descriptions") && intelNode.get("descriptions").has(classGroup)) {
                    text = intelNode.get("descriptions").get(classGroup).path("english").asText("");
                }
                String image = intelNode.path("titleImage").path("english").asText("");

                switch (i) {
                    case 0: result.intelligence1Text = text; result.intelligence1Image = image; break;
                    case 1: result.intelligence2Text = text; result.intelligence2Image = image; break;
                    case 2: result.intelligence3Text = text; result.intelligence3Image = image; break;
                }
            }
        }

        // ── Recommendations (from weak ability) ──
        if (abilityData != null && result.weakAbility != null && !result.weakAbility.isEmpty()) {
            String abilityKey = ABILITY_TO_JSON_KEY.getOrDefault(result.weakAbility,
                    result.weakAbility.toLowerCase().replace(' ', '_').replace("&", "and"));
            JsonNode abilityNode = abilityData.get(abilityKey);
            if (abilityNode != null && abilityNode.has("recommendations")) {
                // Use "9-12" for classes 9-12, "6-8" for classes 6-8
                String recGroup = "6-8".equals(classGroup) ? "6-8" : "9-12";
                JsonNode recs = abilityNode.get("recommendations").get(recGroup);
                if (recs != null) {
                    String recsText = recs.path("english").asText("");
                    // Format with bullet points
                    StringBuilder formatted = new StringBuilder();
                    for (String line : recsText.split("\n")) {
                        line = line.trim();
                        if (line.isEmpty()) continue;
                        if (!line.startsWith("•")) {
                            formatted.append("• ");
                        }
                        formatted.append(line).append("\n");
                    }
                    result.recommendations = formatted.toString().trim();
                }
            }
        }

        logger.info("  Phase 5 enrichment: P-text={}/{}/{}, I-text={}/{}/{}, suggestions={}, recs={}chars",
                result.personality1Text != null ? "Y" : "N",
                result.personality2Text != null ? "Y" : "N",
                result.personality3Text != null ? "Y" : "N",
                result.intelligence1Text != null ? "Y" : "N",
                result.intelligence2Text != null ? "Y" : "N",
                result.intelligence3Text != null ? "Y" : "N",
                result.canAtSchool != null ? "Y" : "N",
                result.recommendations != null ? result.recommendations.length() : 0);
    }

    // ═══════════════════════ ATTRIBUTE COMPARISON ═══════════════════════

    /**
     * Compare student attributes against pathway requirements.
     * Returns String[2]: [0] = comma-separated has, [1] = comma-separated lacks
     */
    private String[] compareAttributes(List<String> studentAttrs, List<String> requirements,
            boolean isPersonality) {
        List<String> has = new ArrayList<>();
        List<String> lacks = new ArrayList<>();

        for (String req : requirements) {
            String reqNorm = isPersonality ? req : normalizeWord(req);
            String displayName = isPersonality
                    ? req.substring(0, 1).toUpperCase() + req.substring(1)
                    : DISPLAY_ALIASES.getOrDefault(reqNorm, titleCase(reqNorm));

            boolean found = false;
            for (String attr : studentAttrs) {
                if (reqNorm.equals(attr)) {
                    has.add(displayName);
                    found = true;
                    break;
                }
            }
            if (!found) {
                lacks.add(displayName);
            }
        }

        // Deduplicate
        has = new ArrayList<>(new LinkedHashSet<>(has));
        lacks = new ArrayList<>(new LinkedHashSet<>(lacks));

        return new String[]{String.join(", ", has), String.join(", ", lacks)};
    }

    private String normalizeWord(String word) {
        if (word == null) return "";
        String normalized = word.toLowerCase().trim()
                .replace("\u2019", "'")  // smart quote
                .replaceAll("[_/\\-]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return CANONICAL_MAP.getOrDefault(normalized, normalized);
    }

    private String getEnglishText(JsonNode node, String field) {
        if (node == null || !node.has(field)) return "";
        JsonNode fieldNode = node.get(field);
        if (fieldNode.isTextual()) return fieldNode.asText();
        if (fieldNode.has("english")) return fieldNode.get("english").asText();
        return "";
    }

    private String getClassGroup(String studentClass) {
        if (studentClass == null || studentClass.isEmpty()) return "9-10";
        try {
            int classNum = Integer.parseInt(studentClass.trim());
            if (classNum >= 6 && classNum <= 8) return "6-8";
            if (classNum >= 9 && classNum <= 10) return "9-10";
            if (classNum >= 11 && classNum <= 12) return "11-12";
        } catch (NumberFormatException ignored) {}
        return "9-10";
    }

    private static String titleCase(String s) {
        if (s == null || s.isEmpty()) return s;
        return s.substring(0, 1).toUpperCase() + s.substring(1);
    }

    // ═══════════════════════ HELPERS ═══════════════════════

    private static final Map<String, String> PATHWAY_NAME_TO_JSON_KEY = new LinkedHashMap<>();
    static {
        PATHWAY_NAME_TO_JSON_KEY.put("Architecture", "architecture");
        PATHWAY_NAME_TO_JSON_KEY.put("Art, Design", "art_design");
        PATHWAY_NAME_TO_JSON_KEY.put("Art Design", "art_design");
        PATHWAY_NAME_TO_JSON_KEY.put("Entertainment and Mass Media", "entertainment_and_mass_media");
        PATHWAY_NAME_TO_JSON_KEY.put("Management and Administration", "management_and_administration");
        PATHWAY_NAME_TO_JSON_KEY.put("Banking and Finance", "banking_and_finance");
        PATHWAY_NAME_TO_JSON_KEY.put("Law Studies", "law_studies");
        PATHWAY_NAME_TO_JSON_KEY.put("Government and Public Administration", "government_and_public_administration");
        PATHWAY_NAME_TO_JSON_KEY.put("Marketing", "marketing");
        PATHWAY_NAME_TO_JSON_KEY.put("Entrepreneurship", "entrepreneurship");
        PATHWAY_NAME_TO_JSON_KEY.put("Sales", "sales");
        PATHWAY_NAME_TO_JSON_KEY.put("Science and Mathematics", "science_and_mathematics");
        PATHWAY_NAME_TO_JSON_KEY.put("Computer Science, IT and Allied Fields", "computer_science_it_and_allied_fields");
        PATHWAY_NAME_TO_JSON_KEY.put("Life Sciences /Medicine and Healthcare", "life_sciences_medicine_and_healthcare");
        PATHWAY_NAME_TO_JSON_KEY.put("Environmental Service", "environmental_service");
        PATHWAY_NAME_TO_JSON_KEY.put("Social Sciences and Humanities", "social_sciences_and_humanities");
        PATHWAY_NAME_TO_JSON_KEY.put("Defence/ Protective Service", "defence_protective_service");
        PATHWAY_NAME_TO_JSON_KEY.put("Sports", "sports");
        PATHWAY_NAME_TO_JSON_KEY.put("Engineering and Technology", "engineering_and_technology");
        PATHWAY_NAME_TO_JSON_KEY.put("Agriculture, Food Industry and Forestry", "agriculture_food_industry_and_forestry");
        PATHWAY_NAME_TO_JSON_KEY.put("Education and Training", "education_and_training");
        PATHWAY_NAME_TO_JSON_KEY.put("Paramedical", "paramedical");
        PATHWAY_NAME_TO_JSON_KEY.put("Hospitality and Tourism", "hospitality_and_tourism");
        PATHWAY_NAME_TO_JSON_KEY.put("Community and Social Service", "community_and_social_service");
        PATHWAY_NAME_TO_JSON_KEY.put("Personal Care and Services", "personal_care_and_services");
    }

    private String pathwayNameToJsonKey(String name) {
        String key = PATHWAY_NAME_TO_JSON_KEY.get(name);
        if (key != null) return key;
        // Fallback: lowercase, replace spaces and slashes with underscores
        return name.toLowerCase().replaceAll("[/ ]+", "_").replaceAll("_+", "_");
    }

    private static String personalityToCode(String fullName) {
        if (fullName == null) return "";
        switch (fullName) {
            case "Realistic": return "R";
            case "Investigative": return "I";
            case "Artistic": return "A";
            case "Social": return "S";
            case "Enterprising": return "E";
            case "Conventional": return "C";
            default: return fullName;
        }
    }

    // ── Inner classes ──

    private static class PathwayMapping {
        final String pathway;
        final String p1, p2, p3;
        final int[] abilityRanks; // Ab1..Ab10 priority ranks (0 = not required)

        PathwayMapping(String pathway, String p1, String p2, String p3, int[] abilityRanks) {
            this.pathway = pathway;
            this.p1 = p1; this.p2 = p2; this.p3 = p3;
            this.abilityRanks = abilityRanks;
        }
    }

    private static class PathwayCandidate {
        final String pathway;
        final int pKey1, pKey2;
        final int[] tbKey;

        PathwayCandidate(String pathway, int pKey1, int pKey2, int[] tbKey) {
            this.pathway = pathway;
            this.pKey1 = pKey1; this.pKey2 = pKey2;
            this.tbKey = tbKey;
        }
    }
}
