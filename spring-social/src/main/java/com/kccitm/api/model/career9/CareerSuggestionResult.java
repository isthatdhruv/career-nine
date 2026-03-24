package com.kccitm.api.model.career9;

import java.util.List;

public class CareerSuggestionResult {

    private List<Career> greenPathways;   // Top 3 most suited
    private List<Career> orangePathways;  // Moderate 3
    private List<Career> redPathways;     // Least suited 3

    private List<MQTScore> topPersonalityTraits;  // Top 3 with stanine
    private List<MQTScore> topIntelligenceTypes;  // Top 3 with raw score
    private List<MQTScore> topAbilities;          // Top 5 with raw score

    public static class MQTScore {
        private String name;
        private Integer rawScore;
        private Integer stanine; // null for intelligence/ability

        public MQTScore(String name, Integer rawScore, Integer stanine) {
            this.name = name;
            this.rawScore = rawScore;
            this.stanine = stanine;
        }

        public String getName() { return name; }
        public Integer getRawScore() { return rawScore; }
        public Integer getStanine() { return stanine; }
    }

    public List<Career> getGreenPathways() { return greenPathways; }
    public void setGreenPathways(List<Career> greenPathways) { this.greenPathways = greenPathways; }

    public List<Career> getOrangePathways() { return orangePathways; }
    public void setOrangePathways(List<Career> orangePathways) { this.orangePathways = orangePathways; }

    public List<Career> getRedPathways() { return redPathways; }
    public void setRedPathways(List<Career> redPathways) { this.redPathways = redPathways; }

    public List<MQTScore> getTopPersonalityTraits() { return topPersonalityTraits; }
    public void setTopPersonalityTraits(List<MQTScore> topPersonalityTraits) { this.topPersonalityTraits = topPersonalityTraits; }

    public List<MQTScore> getTopIntelligenceTypes() { return topIntelligenceTypes; }
    public void setTopIntelligenceTypes(List<MQTScore> topIntelligenceTypes) { this.topIntelligenceTypes = topIntelligenceTypes; }

    public List<MQTScore> getTopAbilities() { return topAbilities; }
    public void setTopAbilities(List<MQTScore> topAbilities) { this.topAbilities = topAbilities; }
}
