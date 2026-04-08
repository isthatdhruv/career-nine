package com.kccitm.api.service.career9;

import java.util.*;

/**
 * Static lookup tables for the career suggestion algorithm.
 * All data is derived from Career-9 Report Logic document.
 */
public class CareerSuggestionTables {

    // -------------------------------------------------------------------------
    // Personality trait codes mapped to MQT display names
    // -------------------------------------------------------------------------
    public static final Map<String, String> RIASEC_TO_NAME = new LinkedHashMap<>();
    static {
        RIASEC_TO_NAME.put("R", "Realistic");
        RIASEC_TO_NAME.put("I", "Investigative");
        RIASEC_TO_NAME.put("A", "Artistic");
        RIASEC_TO_NAME.put("S", "Social");
        RIASEC_TO_NAME.put("E", "Enterprising");
        RIASEC_TO_NAME.put("C", "Conventional");
    }

    public static final Map<String, String> NAME_TO_RIASEC = new LinkedHashMap<>();
    static {
        NAME_TO_RIASEC.put("Realistic", "R");
        NAME_TO_RIASEC.put("Investigative", "I");
        NAME_TO_RIASEC.put("Artistic", "A");
        NAME_TO_RIASEC.put("Social", "S");
        NAME_TO_RIASEC.put("Enterprising", "E");
        NAME_TO_RIASEC.put("Conventional", "C");
    }

    // -------------------------------------------------------------------------
    // Personality stanine conversion tables (raw score -> stanine 1-9)
    // Format: int[9][2] where each row is {minScore, maxScore} for stanines 1..9
    // Source: Section 1 of Career-9 Report Logic doc
    // -------------------------------------------------------------------------
    // Each entry: stanine index 0=stanine1 ... 8=stanine9, value = max raw score for that stanine
    public static final Map<String, int[]> PERSONALITY_STANINE_MAX = new LinkedHashMap<>();
    static {
        // Realistic (R): stanine thresholds (max raw score inclusive for each stanine 1-9)
        PERSONALITY_STANINE_MAX.put("R", new int[]{2, 4, 6, 8, 10, 12, 14, 16, Integer.MAX_VALUE});
        // Investigative (I)
        PERSONALITY_STANINE_MAX.put("I", new int[]{2, 4, 6, 8, 10, 12, 14, 16, Integer.MAX_VALUE});
        // Artistic (A)
        PERSONALITY_STANINE_MAX.put("A", new int[]{2, 4, 6, 8, 10, 12, 14, 16, Integer.MAX_VALUE});
        // Social (S)
        PERSONALITY_STANINE_MAX.put("S", new int[]{2, 4, 6, 8, 10, 12, 14, 16, Integer.MAX_VALUE});
        // Enterprising (E)
        PERSONALITY_STANINE_MAX.put("E", new int[]{2, 4, 6, 8, 10, 12, 14, 16, Integer.MAX_VALUE});
        // Conventional (C)
        PERSONALITY_STANINE_MAX.put("C", new int[]{2, 4, 6, 8, 10, 12, 14, 16, Integer.MAX_VALUE});
    }

    /**
     * Convert a raw personality score to a stanine (1-9) for the given RIASEC code.
     */
    public static int getPersonalityStanine(String riasecCode, int rawScore) {
        int[] maxScores = PERSONALITY_STANINE_MAX.get(riasecCode);
        if (maxScores == null) return 5; // default mid
        for (int i = 0; i < maxScores.length; i++) {
            if (rawScore <= maxScores[i]) return i + 1;
        }
        return 9;
    }

    // -------------------------------------------------------------------------
    // Personality -> Intelligence types mapping (for tie-breaking)
    // -------------------------------------------------------------------------
    public static final Map<String, List<String>> PERSONALITY_TO_INTELLIGENCE = new LinkedHashMap<>();
    static {
        PERSONALITY_TO_INTELLIGENCE.put("R", Arrays.asList("Bodily-Kinesthetic", "Naturalistic"));
        PERSONALITY_TO_INTELLIGENCE.put("I", Arrays.asList("Logical-Mathematical", "Naturalistic"));
        PERSONALITY_TO_INTELLIGENCE.put("A", Arrays.asList("Musical", "Spatial-Visual", "Linguistic"));
        PERSONALITY_TO_INTELLIGENCE.put("S", Arrays.asList("Interpersonal", "Linguistic"));
        PERSONALITY_TO_INTELLIGENCE.put("E", Arrays.asList("Interpersonal", "Linguistic"));
        PERSONALITY_TO_INTELLIGENCE.put("C", Arrays.asList("Logical-Mathematical", "Intrapersonal"));
    }

    // -------------------------------------------------------------------------
    // Personality -> Abilities mapping (for tie-breaking)
    // -------------------------------------------------------------------------
    public static final Map<String, List<String>> PERSONALITY_TO_ABILITIES = new LinkedHashMap<>();
    static {
        PERSONALITY_TO_ABILITIES.put("R", Arrays.asList("Motor Movement", "Finger Dexterity", "Technical", "Form Perception"));
        PERSONALITY_TO_ABILITIES.put("I", Arrays.asList("Computational", "Logical Reasoning", "Form Perception"));
        PERSONALITY_TO_ABILITIES.put("A", Arrays.asList("Creativity", "Spatial", "Communication"));
        PERSONALITY_TO_ABILITIES.put("S", Arrays.asList("Communication", "Decision Making"));
        PERSONALITY_TO_ABILITIES.put("E", Arrays.asList("Communication", "Decision Making", "Creativity"));
        PERSONALITY_TO_ABILITIES.put("C", Arrays.asList("Computational", "Speed & Accuracy", "Logical Reasoning"));
    }

    // -------------------------------------------------------------------------
    // Intelligence elimination rules: when same personality maps to multiple
    // intelligences, keep only the primary one.
    // Key = RIASEC code, Value = primary intelligence to keep
    // -------------------------------------------------------------------------
    public static final Map<String, String> INTELLIGENCE_ELIMINATION = new LinkedHashMap<>();
    static {
        INTELLIGENCE_ELIMINATION.put("R", "Bodily-Kinesthetic");
        INTELLIGENCE_ELIMINATION.put("S", "Interpersonal");
        INTELLIGENCE_ELIMINATION.put("A", "Spatial-Visual");
    }

    // -------------------------------------------------------------------------
    // Ability priority order for tie-breaking (index 0 = highest priority)
    // -------------------------------------------------------------------------
    public static final List<String> ABILITY_PRIORITY = Arrays.asList(
        "Communication",
        "Decision Making",
        "Speed & Accuracy",
        "Creativity",
        "Computational",
        "Logical Reasoning",
        "Form Perception",
        "Technical",
        "Motor Movement",
        "Finger Dexterity"
    );

    // -------------------------------------------------------------------------
    // Career personality match priority sequence (Section 5)
    // Positions: 1=P1, 2=P2, 3=P3, _=any
    // -------------------------------------------------------------------------
    public static final List<String> MATCH_PRIORITY_SEQUENCE = Arrays.asList(
        "123", "132", "213", "231", "312", "321",
        "12_", "1_2", "13_", "1_3",
        "21_", "2_1", "23_", "2_3",
        "31_", "3_1", "32_", "3_2",
        "1__", "2__", "3__",
        "__1", "__2", "__3"
    );

    // -------------------------------------------------------------------------
    // Career ability importance ranks per career (Section 5)
    // Key = career title (must match exactly the title stored in DB)
    // Value = int[10] where index matches ABILITY_PRIORITY order
    //   rank values: 1=most important, 5=least important, 0=not applicable
    // -------------------------------------------------------------------------
    public static final Map<String, int[]> CAREER_ABILITY_RANKS = new LinkedHashMap<>();
    static {
        // Format: {Communication, Decision Making, Speed&Accuracy, Creativity,
        //          Computational, Logical Reasoning, Form Perception, Technical, Motor Movement, Finger Dexterity}
        CAREER_ABILITY_RANKS.put("Architecture & Engineering",   new int[]{2, 3, 4, 3, 3, 2, 2, 1, 0, 0});
        CAREER_ABILITY_RANKS.put("Arts & Design",                new int[]{3, 2, 4, 1, 0, 3, 2, 2, 3, 2});
        CAREER_ABILITY_RANKS.put("Business & Management",        new int[]{1, 1, 3, 2, 2, 2, 0, 0, 0, 0});
        CAREER_ABILITY_RANKS.put("Community & Social Services",  new int[]{1, 2, 3, 3, 0, 2, 0, 0, 0, 0});
        CAREER_ABILITY_RANKS.put("Computers & Information Technology", new int[]{2, 3, 2, 2, 1, 1, 2, 1, 0, 0});
        CAREER_ABILITY_RANKS.put("Construction & Extraction",    new int[]{3, 3, 3, 2, 2, 3, 2, 1, 1, 2});
        CAREER_ABILITY_RANKS.put("Education & Training",         new int[]{1, 2, 3, 2, 2, 2, 0, 0, 0, 0});
        CAREER_ABILITY_RANKS.put("Entertainment & Media",        new int[]{2, 2, 4, 1, 0, 3, 2, 2, 2, 0});
        CAREER_ABILITY_RANKS.put("Farming, Fishing & Forestry",  new int[]{3, 3, 3, 3, 2, 3, 2, 2, 1, 2});
        CAREER_ABILITY_RANKS.put("Finance",                      new int[]{2, 1, 2, 0, 1, 1, 0, 0, 0, 0});
        CAREER_ABILITY_RANKS.put("Food Preparation & Service",   new int[]{2, 2, 2, 2, 2, 3, 2, 2, 1, 1});
        CAREER_ABILITY_RANKS.put("Government & Public Administration", new int[]{1, 1, 3, 2, 2, 2, 0, 0, 0, 0});
        CAREER_ABILITY_RANKS.put("Healthcare",                   new int[]{2, 1, 2, 2, 2, 1, 2, 2, 2, 2});
        CAREER_ABILITY_RANKS.put("Installation, Maintenance & Repair", new int[]{3, 3, 3, 2, 2, 2, 2, 1, 1, 2});
        CAREER_ABILITY_RANKS.put("Law & Policy",                 new int[]{1, 1, 3, 2, 0, 1, 0, 0, 0, 0});
        CAREER_ABILITY_RANKS.put("Management",                   new int[]{1, 1, 3, 2, 2, 2, 0, 0, 0, 0});
        CAREER_ABILITY_RANKS.put("Manufacturing & Production",   new int[]{3, 3, 2, 2, 2, 3, 2, 1, 1, 1});
        CAREER_ABILITY_RANKS.put("Military & Protective Services", new int[]{2, 2, 2, 2, 2, 2, 2, 2, 1, 1});
        CAREER_ABILITY_RANKS.put("Personal Care & Services",     new int[]{1, 2, 3, 2, 0, 3, 2, 2, 2, 2});
        CAREER_ABILITY_RANKS.put("Sales",                        new int[]{1, 1, 3, 2, 2, 3, 0, 0, 0, 0});
        CAREER_ABILITY_RANKS.put("Science",                      new int[]{2, 2, 3, 2, 1, 1, 2, 2, 0, 0});
        CAREER_ABILITY_RANKS.put("Sports & Physical Activity",   new int[]{2, 2, 2, 2, 0, 3, 0, 0, 1, 2});
        CAREER_ABILITY_RANKS.put("Transportation & Logistics",   new int[]{2, 2, 2, 0, 2, 2, 2, 2, 1, 2});
        CAREER_ABILITY_RANKS.put("Trades & Skilled Work",        new int[]{3, 3, 2, 2, 2, 3, 2, 1, 1, 1});
    }
}
