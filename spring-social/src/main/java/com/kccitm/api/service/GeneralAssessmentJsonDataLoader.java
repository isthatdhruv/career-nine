package com.kccitm.api.service;

import java.io.InputStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import javax.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Loads and caches general assessment JSON data files from classpath at startup.
 * Provides lookup methods for personality, intelligence, ability, career pathway data.
 */
@Service
public class GeneralAssessmentJsonDataLoader {

    private static final Logger logger = LoggerFactory.getLogger(GeneralAssessmentJsonDataLoader.class);
    private static final String DATA_PATH = "general-assessment-data/";

    private final ObjectMapper objectMapper = new ObjectMapper();

    private JsonNode personalityData;
    private JsonNode intelligenceData;
    private JsonNode abilityData;
    private JsonNode careerPathwaysData;
    private JsonNode valuesData;
    private JsonNode subjectsOfInterestData;
    private JsonNode learningStyleData;

    // Pathway name → JSON key mapping (same as Python's pathway_mapping)
    private static final Map<String, String> PATHWAY_KEY_MAP;
    static {
        Map<String, String> map = new HashMap<>();
        map.put("Paramedical", "paramedical");
        map.put("Environmental Service", "environmental_service");
        map.put("Life Sciences /Medicine and Healthcare", "life_sciences_medicine_and_healthcare");
        map.put("Agriculture, Food Industry and Forestry", "agriculture_food_industry_and_forestry");
        map.put("Education and Training", "education_and_training");
        map.put("Community and Social Service", "community_and_social_service");
        map.put("Hospitality and Tourism", "hospitality_and_tourism");
        map.put("Personal Care and Services", "personal_care_and_services");
        map.put("Social Sciences and Humanities", "social_sciences_and_humanities");
        map.put("Computer Science, IT and Allied Fields", "computer_science_it_and_allied_fields");
        map.put("Science and Mathematics", "science_and_mathematics");
        map.put("Engineering and Technology", "engineering_and_technology");
        map.put("Government and Public Administration", "government_and_public_administration");
        map.put("Defence/ Protective Service", "defence_protective_service");
        map.put("Sports", "sports");
        map.put("Banking and Finance", "banking_and_finance");
        map.put("Law Studies", "law_studies");
        map.put("Marketing", "marketing");
        map.put("Entrepreneurship", "entrepreneurship");
        map.put("Sales", "sales");
        map.put("Architecture", "architecture");
        map.put("Art Design", "art_design");
        map.put("Art, Design", "art_design");
        map.put("Entertainment and Mass Media", "entertainment_and_mass_media");
        map.put("Management and Administration", "management_and_administration");
        PATHWAY_KEY_MAP = Collections.unmodifiableMap(map);
    }

    @PostConstruct
    public void init() {
        try {
            personalityData = loadJsonFile("personality_data.json", "personality");
            intelligenceData = loadJsonFile("intelligence_data.json", "intelligence");
            abilityData = loadJsonFile("ability_data.json", "ability");
            careerPathwaysData = loadJsonFile("career_pathways.json", "career_pathways");
            valuesData = loadJsonFile("values_data.json", "values");
            subjectsOfInterestData = loadJsonFile("subjects_of_interest_data.json", "subjects_of_interest");
            learningStyleData = loadJsonFileRaw("learning_style.json");
            logger.info("General assessment JSON data loaded successfully");
        } catch (Exception e) {
            logger.error("Failed to load general assessment JSON data", e);
        }
    }

    private JsonNode loadJsonFile(String filename, String rootKey) {
        try {
            ClassPathResource resource = new ClassPathResource(DATA_PATH + filename);
            InputStream is = resource.getInputStream();
            JsonNode root = objectMapper.readTree(is);
            JsonNode data = root.has(rootKey) ? root.get(rootKey) : root;
            logger.info("Loaded {} with {} entries", filename, data.size());
            return data;
        } catch (Exception e) {
            logger.warn("Could not load {}: {}", filename, e.getMessage());
            return objectMapper.createObjectNode();
        }
    }

    private JsonNode loadJsonFileRaw(String filename) {
        try {
            ClassPathResource resource = new ClassPathResource(DATA_PATH + filename);
            InputStream is = resource.getInputStream();
            JsonNode data = objectMapper.readTree(is);
            logger.info("Loaded {} (raw)", filename);
            return data;
        } catch (Exception e) {
            logger.warn("Could not load {}: {}", filename, e.getMessage());
            return objectMapper.createObjectNode();
        }
    }

    // --- PERSONALITY LOOKUPS ---

    public String getPersonalityTitle(String traitName) {
        String key = traitName.toLowerCase().replace(' ', '_');
        JsonNode trait = personalityData.get(key);
        if (trait != null && trait.has("title")) {
            return getEnglish(trait.get("title"));
        }
        return traitName;
    }

    public String getPersonalityDescription(String traitName, String classGroup) {
        String key = traitName.toLowerCase().replace(' ', '_');
        JsonNode trait = personalityData.get(key);
        if (trait != null && trait.has("descriptions") && trait.get("descriptions").has(classGroup)) {
            return getEnglish(trait.get("descriptions").get(classGroup));
        }
        return "";
    }

    public String getPersonalityImage(String traitName) {
        String key = traitName.toLowerCase().replace(' ', '_');
        JsonNode trait = personalityData.get(key);
        if (trait != null && trait.has("titleImage")) {
            return getEnglish(trait.get("titleImage"));
        }
        return "";
    }

    public String getFutureSuggestionsAtSchool(String traitName, String classGroup) {
        String key = traitName.toLowerCase().replace(' ', '_');
        JsonNode trait = personalityData.get(key);
        if (trait != null && trait.has("futureSuggestions") && trait.get("futureSuggestions").has(classGroup)) {
            JsonNode suggestions = trait.get("futureSuggestions").get(classGroup);
            if (suggestions.has("atSchool")) {
                return getEnglish(suggestions.get("atSchool"));
            }
        }
        return "";
    }

    public String getFutureSuggestionsAtHome(String traitName, String classGroup) {
        String key = traitName.toLowerCase().replace(' ', '_');
        JsonNode trait = personalityData.get(key);
        if (trait != null && trait.has("futureSuggestions") && trait.get("futureSuggestions").has(classGroup)) {
            JsonNode suggestions = trait.get("futureSuggestions").get(classGroup);
            if (suggestions.has("atHome")) {
                return getEnglish(suggestions.get("atHome"));
            }
        }
        return "";
    }

    // --- INTELLIGENCE LOOKUPS ---

    public String getIntelligenceTitle(String typeName) {
        String key = normalizeIntelligenceKey(typeName);
        JsonNode intel = intelligenceData.get(key);
        if (intel != null && intel.has("title")) {
            return getEnglish(intel.get("title"));
        }
        return typeName;
    }

    public String getIntelligenceDescription(String typeName, String classGroup) {
        String key = normalizeIntelligenceKey(typeName);
        JsonNode intel = intelligenceData.get(key);
        if (intel != null && intel.has("descriptions") && intel.get("descriptions").has(classGroup)) {
            return getEnglish(intel.get("descriptions").get(classGroup));
        }
        return "";
    }

    public String getIntelligenceImage(String typeName) {
        String key = normalizeIntelligenceKey(typeName);
        JsonNode intel = intelligenceData.get(key);
        if (intel != null && intel.has("titleImage")) {
            return getEnglish(intel.get("titleImage"));
        }
        return "";
    }

    public String getIntelligenceLearningStyleName(String typeName) {
        String key = normalizeIntelligenceKey(typeName);
        JsonNode intel = intelligenceData.get(key);
        if (intel != null && intel.has("learningStyle") && intel.get("learningStyle").has("name")) {
            return getEnglish(intel.get("learningStyle").get("name"));
        }
        // Fallback to hardcoded mapping (same as Python)
        return INTELLIGENCE_TO_LEARNING_STYLE.getOrDefault(typeName, typeName);
    }

    public String getIntelligenceEnjoyStudiesWith(String typeName) {
        String key = normalizeIntelligenceKey(typeName);
        JsonNode intel = intelligenceData.get(key);
        if (intel != null && intel.has("learningStyle") && intel.get("learningStyle").has("enjoyStudiesWith")) {
            return getEnglish(intel.get("learningStyle").get("enjoyStudiesWith"));
        }
        return ENJOYS_MAPPING.getOrDefault(getIntelligenceLearningStyleName(typeName), "");
    }

    public String getIntelligenceStruggleWith(String typeName) {
        String key = normalizeIntelligenceKey(typeName);
        JsonNode intel = intelligenceData.get(key);
        if (intel != null && intel.has("learningStyle") && intel.get("learningStyle").has("struggleWith")) {
            return getEnglish(intel.get("learningStyle").get("struggleWith"));
        }
        return STRUGGLES_MAPPING.getOrDefault(getIntelligenceLearningStyleName(typeName), "");
    }

    // --- ABILITY LOOKUPS ---

    public String getAbilityRecommendation(String abilityName, String classGroup) {
        String key = abilityName.toLowerCase().replace(' ', '_').replace('&', 'a')
                .replace("& ", "and_").replace("&", "and");
        // Normalize: "Decision making & problem solving" → "decision_making_and_problem_solving"
        // Also try "decision_making_problem_solving"
        JsonNode ability = abilityData.get(key);
        if (ability == null) {
            // Try alternate normalization
            key = abilityName.toLowerCase()
                    .replaceAll("[&/]", "and")
                    .replaceAll("\\s+", "_")
                    .replace("__", "_");
            ability = abilityData.get(key);
        }
        if (ability == null) {
            // Try with ampersand replaced
            key = abilityName.toLowerCase().replace("&", "and").replaceAll("\\s+", "_");
            ability = abilityData.get(key);
        }
        if (ability != null && ability.has("recommendations")) {
            JsonNode recs = ability.get("recommendations");
            // Use "9-12" for both 9-10 and 11-12 (as Python does)
            String recGroup = classGroup.equals("6-8") ? "6-8" : "9-12";
            if (recs.has(recGroup)) {
                return getEnglish(recs.get(recGroup));
            }
        }
        return "";
    }

    // --- CAREER PATHWAY LOOKUPS ---

    public JsonNode getCareerPathwayData(String pathwayName) {
        String jsonKey = PATHWAY_KEY_MAP.getOrDefault(pathwayName,
                pathwayName.toLowerCase().replace(' ', '_').replace('/', '_').replace(',', '_').replace('-', '_'));
        return careerPathwaysData.has(jsonKey) ? careerPathwaysData.get(jsonKey) : null;
    }

    public String getPathwayDescription(String pathwayName, String classGroup) {
        JsonNode pathway = getCareerPathwayData(pathwayName);
        if (pathway != null && pathway.has(classGroup)) {
            JsonNode classData = pathway.get(classGroup);
            if (classData.has("description")) {
                return getEnglish(classData.get("description"));
            }
        }
        return "";
    }

    public String getPathwaySubjects(String pathwayName, String classGroup) {
        JsonNode pathway = getCareerPathwayData(pathwayName);
        if (pathway != null && pathway.has(classGroup)) {
            return getEnglish(pathway.get(classGroup).get("subjects"));
        }
        return "";
    }

    public String getPathwaySkills(String pathwayName, String classGroup) {
        JsonNode pathway = getCareerPathwayData(pathwayName);
        if (pathway != null && pathway.has(classGroup)) {
            return getEnglish(pathway.get(classGroup).get("skills"));
        }
        return "";
    }

    public String getPathwayCourses(String pathwayName) {
        JsonNode pathway = getCareerPathwayData(pathwayName);
        if (pathway != null && pathway.has("9-10")) {
            return getEnglish(pathway.get("9-10").get("courses"));
        }
        return "";
    }

    public String getPathwayExams(String pathwayName) {
        JsonNode pathway = getCareerPathwayData(pathwayName);
        if (pathway != null && pathway.has("9-10")) {
            return getEnglish(pathway.get("9-10").get("exams"));
        }
        return "";
    }

    /**
     * Get personality types required for a pathway.
     * Returns display names like "Doer", "Thinker", etc.
     */
    public java.util.List<String> getPathwayPersonalityTypes(String pathwayName) {
        java.util.List<String> result = new java.util.ArrayList<>();
        JsonNode pathway = getCareerPathwayData(pathwayName);
        if (pathway != null && pathway.has("personality_types")) {
            for (JsonNode pt : pathway.get("personality_types")) {
                result.add(getEnglish(pt));
            }
        }
        return result;
    }

    public java.util.List<String> getPathwayIntelligenceTypes(String pathwayName) {
        java.util.List<String> result = new java.util.ArrayList<>();
        JsonNode pathway = getCareerPathwayData(pathwayName);
        if (pathway != null && pathway.has("intelligence_types")) {
            for (JsonNode it : pathway.get("intelligence_types")) {
                String val = it.isTextual() ? it.asText() : getEnglish(it);
                // Split comma-separated values
                for (String part : val.split(",")) {
                    String trimmed = part.trim();
                    if (!trimmed.isEmpty()) {
                        result.add(trimmed);
                    }
                }
            }
        }
        return result;
    }

    public java.util.List<String> getPathwayAbilities(String pathwayName) {
        java.util.List<String> result = new java.util.ArrayList<>();
        JsonNode pathway = getCareerPathwayData(pathwayName);
        if (pathway != null && pathway.has("abilities")) {
            for (JsonNode a : pathway.get("abilities")) {
                result.add(getEnglish(a));
            }
        }
        return result;
    }

    public java.util.List<String> getPathwaySubjectsOfInterest(String pathwayName) {
        java.util.List<String> result = new java.util.ArrayList<>();
        JsonNode pathway = getCareerPathwayData(pathwayName);
        if (pathway != null && pathway.has("subjects_of_interest")) {
            for (JsonNode s : pathway.get("subjects_of_interest")) {
                result.add(getEnglish(s));
            }
        }
        return result;
    }

    public java.util.List<String> getPathwayValues(String pathwayName) {
        java.util.List<String> result = new java.util.ArrayList<>();
        JsonNode pathway = getCareerPathwayData(pathwayName);
        if (pathway != null && pathway.has("values")) {
            for (JsonNode v : pathway.get("values")) {
                result.add(getEnglish(v));
            }
        }
        return result;
    }

    // --- HELPERS ---

    private String getEnglish(JsonNode node) {
        if (node == null) return "";
        if (node.isTextual()) return node.asText();
        if (node.has("english")) return node.get("english").asText();
        return node.asText("");
    }

    private String normalizeIntelligenceKey(String typeName) {
        String key = typeName.toLowerCase().replace('-', '_').replace(' ', '_');
        // Canonical mappings
        if (key.contains("logical")) return "logical";
        if (key.equals("spatial_visual")) return "visual_spatial";
        return key;
    }

    // Hardcoded fallback mappings (same as Python pipeline)
    private static final Map<String, String> INTELLIGENCE_TO_LEARNING_STYLE;
    static {
        Map<String, String> map = new HashMap<>();
        map.put("Bodily-Kinesthetic", "Body smart");
        map.put("Musical", "Rhythmic");
        map.put("Intrapersonal", "Self-aware");
        map.put("Interpersonal", "Interactive");
        map.put("Naturalistic", "Nature smart");
        map.put("Linguistic", "Word smart");
        map.put("Logical-Mathematical", "Logic smart");
        map.put("Visual-Spatial", "Picture smart");
        map.put("Spatial-Visual", "Picture smart");
        map.put("Logical", "Logic smart");
        INTELLIGENCE_TO_LEARNING_STYLE = Collections.unmodifiableMap(map);
    }

    private static final Map<String, String> ENJOYS_MAPPING;
    static {
        Map<String, String> map = new HashMap<>();
        map.put("Body smart", "Physical activities and hands-on learning");
        map.put("Rhythmic", "Music, rhythm, and patterns in learning");
        map.put("Self-aware", "Independent study and self-reflection");
        map.put("Interactive", "Group discussions and collaborative learning");
        map.put("Nature smart", "Outdoor learning and nature-based activities");
        map.put("Word smart", "Reading, writing, and verbal expression");
        map.put("Logic smart", "Problem-solving and analytical thinking");
        map.put("Picture smart", "Visual learning and spatial reasoning");
        ENJOYS_MAPPING = Collections.unmodifiableMap(map);
    }

    private static final Map<String, String> STRUGGLES_MAPPING;
    static {
        Map<String, String> map = new HashMap<>();
        map.put("Body smart", "Sitting still for long periods");
        map.put("Rhythmic", "Learning without patterns or structure");
        map.put("Self-aware", "Large group activities without personal space");
        map.put("Interactive", "Solo work without social interaction");
        map.put("Nature smart", "Indoor, abstract learning environments");
        map.put("Word smart", "Non-verbal or visual-only tasks");
        map.put("Logic smart", "Unstructured or ambiguous tasks");
        map.put("Picture smart", "Purely auditory learning");
        STRUGGLES_MAPPING = Collections.unmodifiableMap(map);
    }

    // Personality display mapping (RIASEC → display name)
    public static final Map<String, String> PERSONALITY_DISPLAY_MAP;
    static {
        Map<String, String> map = new HashMap<>();
        map.put("realistic", "doer");
        map.put("investigative", "thinker");
        map.put("artistic", "creator");
        map.put("social", "helper");
        map.put("enterprising", "persuader");
        map.put("conventional", "organizer");
        PERSONALITY_DISPLAY_MAP = Collections.unmodifiableMap(map);
    }
}
