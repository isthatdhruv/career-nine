package com.kccitm.api.model.userDefinedModel;

import java.util.List;

/**
 * Pre-computed dashboard data for the student portal.
 * Returned by GET /student-portal/computed/{userStudentId}.
 */
public class StudentPortalComputedData {
    private List<PillarScore> pillarScores;
    private List<CareerMatchResult> careerMatches;
    private String cciLevel; // HIGH, MEDIUM, LOW
    private String insightText;
    private List<String> traitTags;

    // Getters and Setters
    public List<PillarScore> getPillarScores() { return pillarScores; }
    public void setPillarScores(List<PillarScore> pillarScores) { this.pillarScores = pillarScores; }

    public List<CareerMatchResult> getCareerMatches() { return careerMatches; }
    public void setCareerMatches(List<CareerMatchResult> careerMatches) { this.careerMatches = careerMatches; }

    public String getCciLevel() { return cciLevel; }
    public void setCciLevel(String cciLevel) { this.cciLevel = cciLevel; }

    public String getInsightText() { return insightText; }
    public void setInsightText(String insightText) { this.insightText = insightText; }

    public List<String> getTraitTags() { return traitTags; }
    public void setTraitTags(List<String> traitTags) { this.traitTags = traitTags; }

    // Inner classes

    public static class PillarScore {
        private String name;
        private int value; // 0-100

        public PillarScore() {}
        public PillarScore(String name, int value) {
            this.name = name;
            this.value = value;
        }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public int getValue() { return value; }
        public void setValue(int value) { this.value = value; }
    }

    public static class CareerMatchResult {
        private String rank;  // best, strong, good
        private String score; // "9/9", "8/9", etc.
        private String name;
        private List<String> traits;
        private List<String> courses;

        public CareerMatchResult() {}

        public String getRank() { return rank; }
        public void setRank(String rank) { this.rank = rank; }
        public String getScore() { return score; }
        public void setScore(String score) { this.score = score; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public List<String> getTraits() { return traits; }
        public void setTraits(List<String> traits) { this.traits = traits; }
        public List<String> getCourses() { return courses; }
        public void setCourses(List<String> courses) { this.courses = courses; }
    }
}
