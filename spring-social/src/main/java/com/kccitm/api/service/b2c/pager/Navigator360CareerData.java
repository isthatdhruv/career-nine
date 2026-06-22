package com.kccitm.api.service.b2c.pager;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.kccitm.api.service.b2c.pager.Navigator360Models.CareerDefinition;

/**
 * The 24 canonical career clusters (Master Excel sheet "24 Career Clusters",
 * Tech Spec v5 §2.3 step 9) plus the value/aspiration/subject lookup tables.
 *
 * <p><b>Curation note (flagged per audit):</b> the Master Excel "24 Career
 * Clusters" sheet specifies, per cluster, the Sr-no, name, 5 ranked abilities
 * and (for a few clusters) work-values and a Holland code. It does <i>not</i>
 * list per-cluster MI (intelligence) requirements, and several ability/value
 * cells contain typos. The following data therefore CURATES:
 * <ul>
 *   <li>the 3-letter RIASEC Holland code per cluster (Excel codes were sparse
 *       and inconsistently placed);</li>
 *   <li>the 3 required MI domains per cluster (absent from the sheet);</li>
 *   <li>the aligned work-values for the 21 clusters the sheet left blank;</li>
 *   <li>spelling normalisation of the ability names to the canonical set.</li>
 * </ul>
 * These are best-effort psychometric mappings and should be reviewed by
 * Dr. Desai / content before production lock. Ability names are normalised to
 * the canonical labels in {@link Navigator360EngineService#ABILITY_SHORT}.
 */
public final class Navigator360CareerData {

    private Navigator360CareerData() {}

    public static final List<CareerDefinition> CAREER_DEFINITIONS;
    public static final Map<String, String> VALUE_LABEL_TO_SPEC;
    public static final Map<String, List<String>> VALUE_CONFLICTS;
    public static final Map<String, String> ASPIRATION_TO_CAREER;
    public static final Map<String, RiasecType> ASPIRATION_RIASEC;
    public static final Map<String, RiasecType> SUBJECT_RIASEC;

    private static List<RiasecType> r(RiasecType... t) { return Arrays.asList(t); }

    static {
        CAREER_DEFINITIONS = Collections.unmodifiableList(Arrays.asList(
            cluster(1, "architecture", "Architecture",
                r(RiasecType.A, RiasecType.R, RiasecType.I),
                Arrays.asList("Visual-Spatial", "Logical-Mathematical", "Bodily-Kinesthetic"),
                Arrays.asList("Creativity/Artistic", "Decision making & problem solving", "Computational", "Technical", "Speed and accuracy"),
                Arrays.asList("Working with Hands", "Creativity", "Good Salary", "Variety", "Prestige")),

            cluster(2, "art-design", "Art, Design",
                r(RiasecType.A, RiasecType.S, RiasecType.E),
                Arrays.asList("Visual-Spatial", "Musical", "Linguistic"),
                Arrays.asList("Creativity/Artistic", "Language/Communication", "Speed and accuracy", "Finger dexterity", "Decision making & problem solving"),
                Arrays.asList("Creativity", "Autonomy", "Variety", "Prestige", "Social Impact")),

            cluster(3, "entertainment-media", "Entertainment and Mass Media Communication",
                r(RiasecType.A, RiasecType.E, RiasecType.S),
                Arrays.asList("Linguistic", "Musical", "Interpersonal"),
                Arrays.asList("Creativity/Artistic", "Language/Communication", "Speed and accuracy", "Technical", "Logical reasoning"),
                Arrays.asList("Creativity", "Variety", "Social Impact", "Prestige")),

            cluster(4, "management-admin", "Management and Administration",
                r(RiasecType.E, RiasecType.C, RiasecType.S),
                Arrays.asList("Interpersonal", "Logical-Mathematical", "Linguistic"),
                Arrays.asList("Computational", "Speed and accuracy", "Decision making & problem solving", "Language/Communication", "Logical reasoning"),
                Arrays.asList("Leadership", "High Achievement", "Good Salary", "Autonomy")),

            cluster(5, "banking-finance", "Banking and Finance",
                r(RiasecType.C, RiasecType.E, RiasecType.I),
                Arrays.asList("Logical-Mathematical", "Intrapersonal", "Interpersonal"),
                Arrays.asList("Computational", "Speed and accuracy", "Decision making & problem solving", "Logical reasoning", "Finger dexterity"),
                Arrays.asList("Good Salary", "Job Security", "High Achievement", "Routine Activity")),

            cluster(6, "law", "LAW Studies",
                r(RiasecType.E, RiasecType.I, RiasecType.S),
                Arrays.asList("Linguistic", "Intrapersonal", "Interpersonal"),
                Arrays.asList("Language/Communication", "Decision making & problem solving", "Logical reasoning", "Speed and accuracy", "Creativity/Artistic"),
                Arrays.asList("Prestige", "Mental Activity", "Good Salary", "High Achievement")),

            cluster(7, "government-public", "Government and Public Administration",
                r(RiasecType.E, RiasecType.C, RiasecType.S),
                Arrays.asList("Interpersonal", "Linguistic", "Intrapersonal"),
                Arrays.asList("Decision making & problem solving", "Language/Communication", "Logical reasoning", "Speed and accuracy", "Computational"),
                Arrays.asList("Social Impact", "Job Security", "Prestige", "Leadership")),

            cluster(8, "marketing", "Marketing",
                r(RiasecType.E, RiasecType.A, RiasecType.C),
                Arrays.asList("Linguistic", "Interpersonal", "Logical-Mathematical"),
                Arrays.asList("Language/Communication", "Decision making & problem solving", "Creativity/Artistic", "Speed and accuracy", "Logical reasoning"),
                Arrays.asList("Good Salary", "Variety", "High Achievement", "Leadership")),

            cluster(9, "entrepreneurship", "Entrepreneurship",
                r(RiasecType.E, RiasecType.I, RiasecType.C),
                Arrays.asList("Interpersonal", "Intrapersonal", "Linguistic"),
                Arrays.asList("Decision making & problem solving", "Language/Communication", "Computational", "Creativity/Artistic", "Logical reasoning"),
                Arrays.asList("Leadership", "Autonomy", "High Achievement", "Good Salary")),

            cluster(10, "sales", "Sales",
                r(RiasecType.E, RiasecType.S, RiasecType.C),
                Arrays.asList("Interpersonal", "Linguistic", "Intrapersonal"),
                Arrays.asList("Language/Communication", "Decision making & problem solving", "Computational", "Logical reasoning", "Speed and accuracy"),
                Arrays.asList("Good Salary", "High Achievement", "Variety", "Leadership")),

            cluster(11, "science-maths", "Science and Mathematics",
                r(RiasecType.I, RiasecType.R, RiasecType.C),
                Arrays.asList("Logical-Mathematical", "Intrapersonal", "Naturalistic"),
                Arrays.asList("Computational", "Form perception", "Decision making & problem solving", "Technical", "Finger dexterity"),
                Arrays.asList("Mental Activity", "Autonomy", "High Achievement")),

            cluster(12, "it-cs", "Information Technology and Computer Science",
                r(RiasecType.I, RiasecType.R, RiasecType.C),
                Arrays.asList("Logical-Mathematical", "Intrapersonal", "Visual-Spatial"),
                Arrays.asList("Technical", "Language/Communication", "Logical reasoning", "Decision making & problem solving", "Speed and accuracy"),
                Arrays.asList("Working with Hands", "Good Salary", "Autonomy", "High Achievement", "Variety")),

            cluster(13, "life-sciences-medicine", "Life Sciences, Medicine and Healthcare",
                r(RiasecType.I, RiasecType.S, RiasecType.R),
                Arrays.asList("Bodily-Kinesthetic", "Intrapersonal", "Interpersonal"),
                Arrays.asList("Form perception", "Decision making & problem solving", "Logical reasoning", "Language/Communication", "Speed and accuracy"),
                Arrays.asList("Helping Others", "Prestige", "Good Salary", "Mental Activity")),

            cluster(14, "environmental-service", "Environmental Service",
                r(RiasecType.R, RiasecType.I, RiasecType.S),
                Arrays.asList("Naturalistic", "Bodily-Kinesthetic", "Visual-Spatial"),
                Arrays.asList("Decision making & problem solving", "Form perception", "Motor movement", "Finger dexterity", "Speed and accuracy"),
                Arrays.asList("Social Impact", "Physical Activity", "Variety", "Working with Hands")),

            cluster(15, "social-science-humanities", "Social Science and Humanities",
                r(RiasecType.S, RiasecType.A, RiasecType.I),
                Arrays.asList("Linguistic", "Interpersonal", "Intrapersonal"),
                Arrays.asList("Language/Communication", "Decision making & problem solving", "Creativity/Artistic", "Logical reasoning", "Speed and accuracy"),
                Arrays.asList("Social Impact", "Helping Others", "Mental Activity", "Work-Life Balance")),

            cluster(16, "defence-protective", "Defence and Protective Service",
                r(RiasecType.R, RiasecType.E, RiasecType.S),
                Arrays.asList("Bodily-Kinesthetic", "Interpersonal", "Naturalistic"),
                Arrays.asList("Decision making & problem solving", "Motor movement", "Speed and accuracy", "Language/Communication", "Logical reasoning"),
                Arrays.asList("Physical Activity", "Job Security", "Leadership", "Social Impact")),

            cluster(17, "sports", "Sports",
                r(RiasecType.R, RiasecType.S, RiasecType.E),
                Arrays.asList("Bodily-Kinesthetic", "Interpersonal", "Naturalistic"),
                Arrays.asList("Motor movement", "Decision making & problem solving", "Finger dexterity", "Speed and accuracy", "Language/Communication"),
                Arrays.asList("Physical Activity", "High Achievement", "Leadership", "Variety")),

            cluster(18, "engineering-technology", "Engineering and Technology",
                r(RiasecType.R, RiasecType.I, RiasecType.C),
                Arrays.asList("Logical-Mathematical", "Visual-Spatial", "Bodily-Kinesthetic"),
                Arrays.asList("Technical", "Computational", "Logical reasoning", "Decision making & problem solving", "Speed and accuracy"),
                Arrays.asList("Working with Hands", "Good Salary", "Autonomy", "High Achievement", "Variety")),

            cluster(19, "agriculture-food", "Agriculture, Food and Forestry",
                r(RiasecType.R, RiasecType.I, RiasecType.S),
                Arrays.asList("Naturalistic", "Bodily-Kinesthetic", "Logical-Mathematical"),
                Arrays.asList("Form perception", "Speed and accuracy", "Technical", "Decision making & problem solving", "Logical reasoning"),
                Arrays.asList("Physical Activity", "Social Impact", "Variety", "Working with Hands")),

            cluster(20, "education-training", "Education and Training",
                r(RiasecType.S, RiasecType.A, RiasecType.I),
                Arrays.asList("Interpersonal", "Linguistic", "Intrapersonal"),
                Arrays.asList("Language/Communication", "Creativity/Artistic", "Logical reasoning", "Technical", "Speed and accuracy"),
                Arrays.asList("Helping Others", "Social Impact", "Job Security", "Work-Life Balance")),

            cluster(21, "paramedical", "Paramedical",
                r(RiasecType.I, RiasecType.S, RiasecType.R),
                Arrays.asList("Bodily-Kinesthetic", "Interpersonal", "Intrapersonal"),
                Arrays.asList("Form perception", "Decision making & problem solving", "Language/Communication", "Logical reasoning", "Speed and accuracy"),
                Arrays.asList("Helping Others", "Job Security", "Variety", "Physical Activity")),

            cluster(22, "hospitality-tourism", "Hospitality and Tourism",
                r(RiasecType.S, RiasecType.E, RiasecType.A),
                Arrays.asList("Interpersonal", "Linguistic", "Bodily-Kinesthetic"),
                Arrays.asList("Language/Communication", "Creativity/Artistic", "Speed and accuracy", "Decision making & problem solving", "Motor movement"),
                Arrays.asList("Helping Others", "Variety", "Social Impact", "Work-Life Balance")),

            cluster(23, "community-social-service", "Community and Social Service",
                r(RiasecType.S, RiasecType.A, RiasecType.E),
                Arrays.asList("Interpersonal", "Linguistic", "Intrapersonal"),
                Arrays.asList("Language/Communication", "Creativity/Artistic", "Decision making & problem solving", "Speed and accuracy", "Motor movement"),
                Arrays.asList("Helping Others", "Social Impact", "Work-Life Balance", "Variety")),

            cluster(24, "personal-care", "Personal Care and Services",
                r(RiasecType.S, RiasecType.A, RiasecType.R),
                Arrays.asList("Interpersonal", "Bodily-Kinesthetic", "Visual-Spatial"),
                Arrays.asList("Language/Communication", "Finger dexterity", "Technical", "Creativity/Artistic", "Speed and accuracy"),
                Arrays.asList("Helping Others", "Variety", "Physical Activity", "Working with Hands"))
        ));

        // Backend value label → spec value name
        Map<String, String> valueMap = new LinkedHashMap<>();
        valueMap.put("Lucrative Salary", "Good Salary");
        valueMap.put("Job Security", "Job Security");
        valueMap.put("Variety and Diversity", "Variety");
        valueMap.put("Building Relations", "Helping Others");
        valueMap.put("High achievement", "High Achievement");
        valueMap.put("Autonomy", "Autonomy");
        valueMap.put("Hands on activities", "Working with Hands");
        valueMap.put("Prestige/Recognition", "Prestige");
        valueMap.put("Creativity", "Creativity");
        valueMap.put("Mental Activity", "Mental Activity");
        valueMap.put("Physical Activity", "Physical Activity");
        valueMap.put("Leadership", "Leadership");
        valueMap.put("Routine Activity", "Routine Activity");
        valueMap.put("Supervised Work", "Work-Life Balance");
        valueMap.put("Working Conditions", "Social Impact");
        // Master Excel "rewritten" work-value labels
        valueMap.put("Practical Maker", "Working with Hands");
        valueMap.put("Innovation", "Creativity");
        valueMap.put("Earn Money", "Good Salary");
        valueMap.put("Recognition Seeker", "Prestige");
        valueMap.put("Deep Thinking", "Mental Activity");
        valueMap.put("Helping Others", "Helping Others");
        VALUE_LABEL_TO_SPEC = Collections.unmodifiableMap(valueMap);

        // Spec §8.2 conflict_values — value → cluster names it conflicts with.
        Map<String, List<String>> conflicts = new LinkedHashMap<>();
        conflicts.put("Job Security", Arrays.asList("Entrepreneurship", "Art", "Entertainment"));
        conflicts.put("Routine Activity", Arrays.asList("Art", "Entertainment", "Entrepreneurship", "Science and Mathematics"));
        conflicts.put("Physical Activity", Arrays.asList("Banking and Finance", "Information Technology"));
        VALUE_CONFLICTS = Collections.unmodifiableMap(conflicts);

        // Aspiration label → cluster id. Per EC-21/EC-22 the aspiration labels are the
        // cluster names; this table also tolerates the legacy label spellings.
        Map<String, String> asp = new LinkedHashMap<>();
        asp.put("Architecture", "architecture");
        asp.put("Art Design", "art-design");
        asp.put("Art, Design", "art-design");
        asp.put("Entertainment and Mass Media", "entertainment-media");
        asp.put("Entertainment and Mass Media Communication", "entertainment-media");
        asp.put("Management and Administration", "management-admin");
        asp.put("Banking and Finance", "banking-finance");
        asp.put("Law Studies", "law");
        asp.put("LAW Studies", "law");
        asp.put("Government and Public Administration", "government-public");
        asp.put("Marketing", "marketing");
        asp.put("Entrepreneurship", "entrepreneurship");
        asp.put("Sales", "sales");
        asp.put("Science and Mathematics", "science-maths");
        asp.put("Computer Science IT and Allied Fields", "it-cs");
        asp.put("Information Technology and Computer Science", "it-cs");
        asp.put("Life Sciences/Medicine and Healthcare", "life-sciences-medicine");
        asp.put("Life Sciences, Medicine and Healthcare", "life-sciences-medicine");
        asp.put("Environmental Service", "environmental-service");
        asp.put("Social Sciences and Humanities", "social-science-humanities");
        asp.put("Social Science and Humanities", "social-science-humanities");
        asp.put("Defence/Protective Service", "defence-protective");
        asp.put("Defence and Protective Service", "defence-protective");
        asp.put("Sports", "sports");
        asp.put("Engineering and Technology", "engineering-technology");
        asp.put("Agriculture Food Industry and Forestry", "agriculture-food");
        asp.put("Agriculture, Food and Forestry", "agriculture-food");
        asp.put("Education and Training", "education-training");
        asp.put("Paramedical", "paramedical");
        asp.put("Hospitality and Tourism", "hospitality-tourism");
        asp.put("Community and Social Service", "community-social-service");
        asp.put("Personal Care and Services", "personal-care");
        ASPIRATION_TO_CAREER = Collections.unmodifiableMap(asp);

        // Aspiration label → primary RIASEC (for coherence + P-10).
        Map<String, RiasecType> aspR = new LinkedHashMap<>();
        aspR.put("Architecture", RiasecType.A);
        aspR.put("Art Design", RiasecType.A);
        aspR.put("Art, Design", RiasecType.A);
        aspR.put("Entertainment and Mass Media", RiasecType.A);
        aspR.put("Entertainment and Mass Media Communication", RiasecType.A);
        aspR.put("Management and Administration", RiasecType.E);
        aspR.put("Banking and Finance", RiasecType.C);
        aspR.put("Law Studies", RiasecType.E);
        aspR.put("LAW Studies", RiasecType.E);
        aspR.put("Government and Public Administration", RiasecType.E);
        aspR.put("Marketing", RiasecType.E);
        aspR.put("Entrepreneurship", RiasecType.E);
        aspR.put("Sales", RiasecType.E);
        aspR.put("Science and Mathematics", RiasecType.I);
        aspR.put("Computer Science IT and Allied Fields", RiasecType.I);
        aspR.put("Information Technology and Computer Science", RiasecType.I);
        aspR.put("Life Sciences/Medicine and Healthcare", RiasecType.I);
        aspR.put("Life Sciences, Medicine and Healthcare", RiasecType.I);
        aspR.put("Environmental Service", RiasecType.R);
        aspR.put("Social Sciences and Humanities", RiasecType.S);
        aspR.put("Social Science and Humanities", RiasecType.S);
        aspR.put("Defence/Protective Service", RiasecType.R);
        aspR.put("Defence and Protective Service", RiasecType.R);
        aspR.put("Sports", RiasecType.R);
        aspR.put("Engineering and Technology", RiasecType.R);
        aspR.put("Agriculture Food Industry and Forestry", RiasecType.R);
        aspR.put("Agriculture, Food and Forestry", RiasecType.R);
        aspR.put("Education and Training", RiasecType.S);
        aspR.put("Paramedical", RiasecType.I);
        aspR.put("Hospitality and Tourism", RiasecType.S);
        aspR.put("Community and Social Service", RiasecType.S);
        aspR.put("Personal Care and Services", RiasecType.S);
        ASPIRATION_RIASEC = Collections.unmodifiableMap(aspR);

        // Subject → RIASEC (for P4 calculation / subject alignment)
        Map<String, RiasecType> subj = new LinkedHashMap<>();
        subj.put("Agriculture", RiasecType.R);
        subj.put("Art", RiasecType.A);
        subj.put("Cultural Studies", RiasecType.S);
        subj.put("English", RiasecType.A);
        subj.put("Home and Consumer Science", RiasecType.R);
        subj.put("Finance", RiasecType.C);
        subj.put("Health", RiasecType.S);
        subj.put("Languages", RiasecType.A);
        subj.put("Management", RiasecType.E);
        subj.put("Mathematics", RiasecType.I);
        subj.put("Music", RiasecType.A);
        subj.put("Science", RiasecType.I);
        subj.put("Vocational studies", RiasecType.R);
        subj.put("Social Sciences", RiasecType.S);
        subj.put("Technology", RiasecType.R);
        SUBJECT_RIASEC = Collections.unmodifiableMap(subj);
    }

    private static CareerDefinition cluster(int srNo, String id, String name,
                                            List<RiasecType> riasec,
                                            List<String> mi,
                                            List<String> abilities,
                                            List<String> values) {
        CareerDefinition c = new CareerDefinition();
        c.srNo = srNo;
        c.id = id;
        c.name = name;
        c.riasec = riasec;
        c.mi = mi;
        c.abilities = abilities;
        c.values = values;
        c.degreePaths = Collections.emptyList();
        return c;
    }
}
