package com.kccitm.api.service.b2c.pager;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.kccitm.api.service.b2c.pager.Navigator360Models.CareerDefinition;

/**
 * Static career-table and value/aspiration/subject lookup data ported from
 * {@code react-social/.../Navigator360CareerData.ts}. Section 7.5 of the
 * Navigator 360 Technical Spec v1.0.
 *
 * <p>Keep this file the canonical place to edit the career taxonomy on the
 * backend; the admin React copy intentionally lives separately so the admin
 * tooling can iterate independently (per the product-owner decision to
 * "duplicate it to backend service as well").
 */
public final class Navigator360CareerData {

    private Navigator360CareerData() {}

    public static final List<CareerDefinition> CAREER_DEFINITIONS;
    public static final Map<String, String> VALUE_LABEL_TO_SPEC;
    public static final Map<String, List<String>> VALUE_CONFLICTS;
    public static final Map<String, String> ASPIRATION_TO_CAREER;
    public static final Map<String, RiasecType> ASPIRATION_RIASEC;
    public static final Map<String, RiasecType> SUBJECT_RIASEC;

    static {
        CAREER_DEFINITIONS = Collections.unmodifiableList(Arrays.asList(
            career("cs-ai", "CS & AI",
                Arrays.asList(RiasecType.I, RiasecType.R, RiasecType.C),
                Arrays.asList("Logical-Mathematical", "Intrapersonal", "Visual-Spatial"),
                Arrays.asList("Logical reasoning", "Computational", "Technical"),
                Arrays.asList("Mental Activity", "Autonomy", "Good Salary", "High Achievement"),
                Arrays.asList("B.Tech CS/IT", "B.Sc Computer Science", "BCA", "M.Tech AI/ML")),

            career("engineering", "Engineering & Tech",
                Arrays.asList(RiasecType.R, RiasecType.I, RiasecType.C),
                Arrays.asList("Logical-Mathematical", "Visual-Spatial", "Bodily-Kinesthetic"),
                Arrays.asList("Technical", "Computational", "Form perception"),
                Arrays.asList("Good Salary", "High Achievement", "Autonomy", "Working with Hands"),
                Arrays.asList("B.Tech/B.E.", "Diploma Engineering", "M.Tech")),

            career("science-maths", "Science & Maths",
                Arrays.asList(RiasecType.I, RiasecType.R),
                Arrays.asList("Logical-Mathematical", "Intrapersonal", "Naturalistic"),
                Arrays.asList("Logical reasoning", "Computational", "Speed and accuracy"),
                Arrays.asList("Mental Activity", "Autonomy", "High Achievement"),
                Arrays.asList("B.Sc", "Integrated M.Sc", "Ph.D")),

            career("life-sciences-medicine", "Life Sciences / Medicine",
                Arrays.asList(RiasecType.I, RiasecType.S),
                Arrays.asList("Bodily-Kinesthetic", "Intrapersonal", "Interpersonal"),
                Arrays.asList("Decision making & problem solving", "Finger dexterity", "Logical reasoning"),
                Arrays.asList("Helping Others", "Prestige", "Good Salary", "Mental Activity"),
                Arrays.asList("MBBS", "B.Sc Nursing", "BDS", "B.Pharm", "BAMS/BHMS")),

            career("architecture-design", "Architecture & Design",
                Arrays.asList(RiasecType.A, RiasecType.R, RiasecType.I),
                Arrays.asList("Visual-Spatial", "Logical-Mathematical", "Bodily-Kinesthetic"),
                Arrays.asList("Form perception", "Technical", "Creativity/Artistic"),
                Arrays.asList("Creativity", "Autonomy", "Prestige", "Working with Hands"),
                Arrays.asList("B.Arch", "B.Des", "BFA", "M.Des")),

            career("media-communication", "Media & Communication",
                Arrays.asList(RiasecType.A, RiasecType.E, RiasecType.S),
                Arrays.asList("Linguistic", "Interpersonal", "Musical"),
                Arrays.asList("Language/Communication", "Creativity/Artistic", "Speed and accuracy"),
                Arrays.asList("Creativity", "Variety", "Social Impact", "High Achievement"),
                Arrays.asList("BA Journalism", "BMM", "B.Sc Film/TV", "MA Communication")),

            career("education-teaching", "Education & Teaching",
                Arrays.asList(RiasecType.S, RiasecType.A, RiasecType.I),
                Arrays.asList("Interpersonal", "Linguistic", "Intrapersonal"),
                Arrays.asList("Language/Communication", "Logical reasoning", "Decision making & problem solving"),
                Arrays.asList("Helping Others", "Social Impact", "Job Security", "Work-Life Balance"),
                Arrays.asList("B.Ed", "BA Education", "M.Ed", "D.El.Ed")),

            career("law", "Law",
                Arrays.asList(RiasecType.E, RiasecType.I, RiasecType.S),
                Arrays.asList("Linguistic", "Intrapersonal", "Interpersonal"),
                Arrays.asList("Logical reasoning", "Language/Communication", "Decision making & problem solving"),
                Arrays.asList("Prestige", "Mental Activity", "Good Salary", "High Achievement"),
                Arrays.asList("BA LLB", "BBA LLB", "LLB", "LLM")),

            career("finance-banking", "Finance & Banking",
                Arrays.asList(RiasecType.C, RiasecType.E, RiasecType.I),
                Arrays.asList("Logical-Mathematical", "Intrapersonal"),
                Arrays.asList("Computational", "Speed and accuracy", "Decision making & problem solving"),
                Arrays.asList("Good Salary", "Job Security", "High Achievement", "Routine Activity"),
                Arrays.asList("B.Com", "BBA Finance", "CA", "CFA", "MBA Finance")),

            career("management-entrepreneurship", "Management & Entrepreneurship",
                Arrays.asList(RiasecType.E, RiasecType.I, RiasecType.S),
                Arrays.asList("Interpersonal", "Intrapersonal", "Linguistic"),
                Arrays.asList("Decision making & problem solving", "Language/Communication", "Logical reasoning"),
                Arrays.asList("Leadership", "High Achievement", "Autonomy", "Good Salary"),
                Arrays.asList("BBA", "MBA", "PGDM", "Entrepreneurship Programs")),

            career("healthcare-allied", "Healthcare (Allied)",
                Arrays.asList(RiasecType.S, RiasecType.R),
                Arrays.asList("Bodily-Kinesthetic", "Interpersonal", "Naturalistic"),
                Arrays.asList("Finger dexterity", "Decision making & problem solving", "Speed and accuracy"),
                Arrays.asList("Helping Others", "Job Security", "Variety", "Physical Activity"),
                Arrays.asList("B.Sc Physiotherapy", "B.Sc MLT", "B.Sc Radiology", "BOT")),

            career("agriculture-environment", "Agriculture & Environment",
                Arrays.asList(RiasecType.R, RiasecType.I, RiasecType.S),
                Arrays.asList("Naturalistic", "Bodily-Kinesthetic", "Visual-Spatial"),
                Arrays.asList("Technical", "Decision making & problem solving", "Form perception"),
                Arrays.asList("Physical Activity", "Social Impact", "Variety", "Working with Hands"),
                Arrays.asList("B.Sc Agriculture", "B.Tech Agri Engg", "B.Sc Forestry", "M.Sc Environmental Science")),

            career("creative-arts", "Creative Arts & Performing",
                Arrays.asList(RiasecType.A, RiasecType.S),
                Arrays.asList("Musical", "Bodily-Kinesthetic", "Visual-Spatial"),
                Arrays.asList("Creativity/Artistic", "Language/Communication", "Form perception"),
                Arrays.asList("Creativity", "Variety", "Autonomy", "Social Impact"),
                Arrays.asList("BFA", "BA Performing Arts", "B.Sc Animation", "BA Music")),

            career("government-public", "Government & Public Service",
                Arrays.asList(RiasecType.C, RiasecType.E, RiasecType.S),
                Arrays.asList("Interpersonal", "Linguistic"),
                Arrays.asList("Language/Communication", "Decision making & problem solving", "Speed and accuracy"),
                Arrays.asList("Social Impact", "Job Security", "Prestige", "Leadership"),
                Arrays.asList("BA Political Science", "BA Public Administration", "UPSC Preparation", "LLB")),

            career("sports-physical", "Sports & Physical Ed",
                Arrays.asList(RiasecType.R, RiasecType.S),
                Arrays.asList("Bodily-Kinesthetic", "Interpersonal", "Naturalistic"),
                Arrays.asList("Motor movement", "Speed and accuracy", "Decision making & problem solving"),
                Arrays.asList("Physical Activity", "High Achievement", "Leadership", "Variety"),
                Arrays.asList("B.P.Ed", "B.Sc Sports Science", "Sports Management", "Coaching Certifications"))
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
        VALUE_LABEL_TO_SPEC = Collections.unmodifiableMap(valueMap);

        // Spec §7.3
        Map<String, List<String>> conflicts = new LinkedHashMap<>();
        conflicts.put("Job Security", Arrays.asList("Entrepreneurship", "Creative Arts & Performing"));
        conflicts.put("Routine Activity", Arrays.asList("Creative Arts & Performing", "Media & Communication", "Science & Maths"));
        conflicts.put("Physical Activity", Arrays.asList("Finance & Banking", "CS & AI"));
        VALUE_CONFLICTS = Collections.unmodifiableMap(conflicts);

        // Aspiration label → career id
        Map<String, String> asp = new LinkedHashMap<>();
        asp.put("Architecture", "architecture-design");
        asp.put("Art Design", "creative-arts");
        asp.put("Entertainment and Mass Media", "media-communication");
        asp.put("Management and Administration", "management-entrepreneurship");
        asp.put("Banking and Finance", "finance-banking");
        asp.put("Law Studies", "law");
        asp.put("Government and Public Administration", "government-public");
        asp.put("Marketing", "management-entrepreneurship");
        asp.put("Entrepreneurship", "management-entrepreneurship");
        asp.put("Sales", "management-entrepreneurship");
        asp.put("Science and Mathematics", "science-maths");
        asp.put("Computer Science IT and Allied Fields", "cs-ai");
        asp.put("Life Sciences/Medicine and Healthcare", "life-sciences-medicine");
        asp.put("Environmental Service", "agriculture-environment");
        asp.put("Social Sciences and Humanities", "education-teaching");
        asp.put("Defence/Protective Service", "government-public");
        asp.put("Sports", "sports-physical");
        asp.put("Engineering and Technology", "engineering");
        asp.put("Agriculture Food Industry and Forestry", "agriculture-environment");
        asp.put("Education and Training", "education-teaching");
        asp.put("Paramedical", "healthcare-allied");
        asp.put("Hospitality and Tourism", "management-entrepreneurship");
        asp.put("Community and Social Service", "education-teaching");
        asp.put("Personal Care and Services", "healthcare-allied");
        ASPIRATION_TO_CAREER = Collections.unmodifiableMap(asp);

        // Aspiration label → RIASEC (for coherence calculation)
        Map<String, RiasecType> aspR = new LinkedHashMap<>();
        aspR.put("Architecture", RiasecType.A);
        aspR.put("Art Design", RiasecType.A);
        aspR.put("Entertainment and Mass Media", RiasecType.A);
        aspR.put("Management and Administration", RiasecType.E);
        aspR.put("Banking and Finance", RiasecType.C);
        aspR.put("Law Studies", RiasecType.E);
        aspR.put("Government and Public Administration", RiasecType.C);
        aspR.put("Marketing", RiasecType.E);
        aspR.put("Entrepreneurship", RiasecType.E);
        aspR.put("Sales", RiasecType.E);
        aspR.put("Science and Mathematics", RiasecType.I);
        aspR.put("Computer Science IT and Allied Fields", RiasecType.I);
        aspR.put("Life Sciences/Medicine and Healthcare", RiasecType.I);
        aspR.put("Environmental Service", RiasecType.R);
        aspR.put("Social Sciences and Humanities", RiasecType.S);
        aspR.put("Defence/Protective Service", RiasecType.R);
        aspR.put("Sports", RiasecType.R);
        aspR.put("Engineering and Technology", RiasecType.R);
        aspR.put("Agriculture Food Industry and Forestry", RiasecType.R);
        aspR.put("Education and Training", RiasecType.S);
        aspR.put("Paramedical", RiasecType.S);
        aspR.put("Hospitality and Tourism", RiasecType.E);
        aspR.put("Community and Social Service", RiasecType.S);
        aspR.put("Personal Care and Services", RiasecType.S);
        ASPIRATION_RIASEC = Collections.unmodifiableMap(aspR);

        // Subject → RIASEC (for P4 calculation)
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

    private static CareerDefinition career(String id, String name,
                                            List<RiasecType> riasec,
                                            List<String> mi,
                                            List<String> abilities,
                                            List<String> values,
                                            List<String> degreePaths) {
        CareerDefinition c = new CareerDefinition();
        c.id = id;
        c.name = name;
        c.riasec = riasec;
        c.mi = mi;
        c.abilities = abilities;
        c.values = values;
        c.degreePaths = degreePaths;
        return c;
    }
}
