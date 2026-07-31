package com.kccitm.api.service.b2c.pager;

import java.util.LinkedHashMap;
import java.util.Map;

import com.kccitm.api.service.b2c.pager.FourPagerEngineService.PagerVariant;

/**
 * Score- and stage-aware interpretation copy for the pager trait cards,
 * transcribed from {@code interpretation.xlsx} (project root). One row per
 * (dimension, score band, grade stage):
 *
 * <ul>
 *   <li>RIASEC bands: stanine 7–9 = HIGH, 3–6 = MODERATE, 1–2 = LOW</li>
 *   <li>MI / Ability bands: raw 10–12 = HIGH, 7–9 = MODERATE, 3–6 = LOW</li>
 *   <li>Stages: Insight (Gr 6–8) / Subject (Gr 9–10) / Career (Gr 11–12)</li>
 * </ul>
 *
 * Both axes line up exactly with {@link AbsoluteLevel} and
 * {@link FourPagerEngineService.PagerVariant}, so the lookup is
 * (dimension key, level, variant). Also carries the sheet's "Simple Domain
 * Name (NEW)" display names, which supersede the old creative names.
 * ("Pictuer Power" in the sheet is transcribed as "Picture Power".)
 */
public final class PagerInterpretations {

    private PagerInterpretations() {}

    /** Backend dimension key → new display name. */
    private static final Map<String, String> RIASEC_NAME = new LinkedHashMap<>();
    private static final Map<String, String> MI_NAME = new LinkedHashMap<>();
    private static final Map<String, String> ABILITY_NAME = new LinkedHashMap<>();

    /**
     * Backend dimension key → 9 summaries, indexed
     * {@code levelIdx * 3 + variantIdx} where level HIGH=0/MODERATE=1/LOW=2
     * and variant INSIGHT=0/SUBJECT=1/CAREER=2.
     */
    private static final Map<String, String[]> RIASEC_SUMMARY = new LinkedHashMap<>();
    private static final Map<String, String[]> MI_SUMMARY = new LinkedHashMap<>();
    private static final Map<String, String[]> ABILITY_SUMMARY = new LinkedHashMap<>();

    static {
        // ═══════════ RIASEC Career Personality ═══════════
        RIASEC_NAME.put("R", "Builder");
        RIASEC_NAME.put("I", "Thinker");
        RIASEC_NAME.put("A", "Creator");
        RIASEC_NAME.put("S", "Helper");
        RIASEC_NAME.put("E", "Leader");
        RIASEC_NAME.put("C", "Organizer");

        RIASEC_SUMMARY.put("R", new String[]{
            "Hands-on, practical, energetic; learns best by doing and building.",
            "Practical, action-driven; thrives on real-world output over pure theory.",
            "Practical, hands-on, energetic; learns and thrives through doing.",
            "Hands-on but also thoughtful, social, and project-minded.",
            "Versatile; needs variety mixing analysis, people, and application.",
            "Some hands-on energy; balanced with thinking and social leanings.",
            "Reflective and verbal; prefers thinking and conversing over physical tasks.",
            "Reflective and verbal; energised by thinking and people, not workshops.",
            "Reflective and social; prefers thinking and people over physical tasks."});
        RIASEC_SUMMARY.put("I", new String[]{
            "Curious, analytical, loves asking why and finding answers.",
            "Analytical, curious, logical; deeply enjoys science and problem-solving.",
            "Curious, analytical, loves complex problems and deep investigation.",
            "Curious but social; balances thinking with people and variety.",
            "Balanced thinker; mixes analysis with people and action well.",
            "Analytical but balanced; enjoys variety alongside thinking work.",
            "Action-oriented; finds long theory and research draining.",
            "Action and people-focused; finds pure theory draining and dull.",
            "Action and people-oriented; long analysis feels draining."});
        RIASEC_SUMMARY.put("A", new String[]{
            "Imaginative, expressive, sees the world creatively and visually.",
            "Creative, expressive, imaginative; thinks in visuals and stories.",
            "Creative, expressive, imaginative; drawn to self-expression and design.",
            "Creative but grounded; comfortable making things within clear structure.",
            "Creative but structured; channels imagination within clear frameworks.",
            "Creative within structure; balances imagination with order.",
            "Structured and practical; prefers defined rules over open creativity.",
            "Structured and methodical; prefers clarity over open-ended creativity.",
            "Structured and methodical; prefers clarity over open-ended creativity."});
        RIASEC_SUMMARY.put("S", new String[]{
            "Warm, empathetic, naturally caring; makes others feel supported.",
            "Caring, empathetic, people-focused; energised by supporting others.",
            "Empathetic, caring, people-focused; energised by helping others.",
            "Sociable but reflective; values both company and quiet time.",
            "Balanced; combines people skills with another strong interest area.",
            "Sociable but independent; values both connection and solo work.",
            "Independent and focused; energised by solo or small-group work.",
            "Independent and idea-focused; prefers ideas and systems over people.",
            "Independent and self-contained; prefers ideas over constant social interaction."});
        RIASEC_SUMMARY.put("E", new String[]{
            "Confident, persuasive, takes charge and organises others naturally.",
            "Ambitious, persuasive, organised; naturally leads and influences others.",
            "Ambitious, persuasive, driven to lead and influence others.",
            "Balanced leader; steps up when needed without always seeking it.",
            "Balanced leader; influences others while valuing other strengths too.",
            "Balanced influencer; leads sometimes without always needing to.",
            "Specialist mindset; prefers excellence over leading or persuading others.",
            "Specialist; deep mastery matters more than leading or persuading.",
            "Contributor mindset; prefers supporting goals over driving them."});
        RIASEC_SUMMARY.put("C", new String[]{
            "Organised, reliable, detail-loving; values accuracy and structure.",
            "Detail-oriented, organised, accurate; thrives in structured environments.",
            "Organised, precise, structured; values order and accuracy.",
            "Structured but adaptable; comfortable with rules and some openness.",
            "Structured but flexible; balances detail with applied problem-solving.",
            "Structured but adaptable; handles order and ambiguity comfortably.",
            "Energetic and variety-loving; restless with routine and repetition.",
            "Variety-loving and creative; restless in routine or clerical work.",
            "Variety-loving and spontaneous; restless in rigid environments."});

        // ═══════════ Gardner Multiple Intelligences (keyed by backend MI name) ═══════════
        MI_NAME.put("Logical-Mathematical", "Pattern Finder");
        MI_NAME.put("Linguistic", "Word-Smart");
        MI_NAME.put("Visual-Spatial", "Visualizer");
        MI_NAME.put("Interpersonal", "People Person");
        MI_NAME.put("Intrapersonal", "Self-Explorer");
        MI_NAME.put("Bodily-Kinesthetic", "Active Learner");
        MI_NAME.put("Musical", "Rhythm Master");
        MI_NAME.put("Naturalistic", "Nature Lover");

        MI_SUMMARY.put("Logical-Mathematical", new String[]{
            "Logical, systematic, pattern-spotting; thinks in numbers and structure.",
            "Logical, systematic, pattern-spotting; thinks naturally in numbers and structure.",
            "Logical, systematic, pattern-spotting; thinks in numbers and structure.",
            "Decent logic; develops analytical thinking with effort and practice.",
            "Decent logic with effort; analytical thinking grows with practice.",
            "Logical with effort; develops analytical strength through practice.",
            "Non-numerical mind; intelligence shines through other strengths.",
            "Non-numerical mind; intelligence shines through different strengths.",
            "Non-numerical intelligence; shines through other strengths and ways."});
        MI_SUMMARY.put("Linguistic", new String[]{
            "Verbal and expressive; thinks and learns through words.",
            "Verbal and expressive; thinks, learns, and persuades through words.",
            "Verbal, expressive, persuasive; thinks and communicates through words.",
            "Good communicator; comfortable reading, writing, and speaking.",
            "Good communicator; comfortable reading, writing, and speaking well.",
            "Good communicator; comfortable with words alongside other strengths.",
            "Expresses better through action or numbers than words.",
            "Expresses better through actions or numbers than words.",
            "Expresses better through actions or numbers than words."});
        MI_SUMMARY.put("Visual-Spatial", new String[]{
            "Visual thinker; sees patterns, shapes, and spaces clearly.",
            "Visual thinker; sees patterns, shapes, and spatial relationships clearly.",
            "Visual thinker; sees patterns, shapes, and spatial relationships clearly.",
            "Visually aware; comfortable with maps, shapes, and design.",
            "Visually aware; comfortable with shapes, maps, and visual design.",
            "Visually aware; comfortable with shapes, maps, and design.",
            "Less visual-spatial; thinks better in words or ideas.",
            "Less visual-spatial; thinks better through words and ideas.",
            "Less visual-spatial; thinks better in words or ideas."});
        MI_SUMMARY.put("Interpersonal", new String[]{
            "Socially perceptive; reads people and moods naturally.",
            "Socially perceptive; reads moods, motivations, and people naturally.",
            "Socially perceptive; reads moods and motivations naturally.",
            "Sociable but values quiet time; balanced interpersonal style.",
            "Sociable but values personal space; balanced interpersonal style.",
            "Sociable but values personal space; balanced interpersonal style.",
            "Independent; prefers solo or small-group settings to crowds.",
            "Independent and self-directed; prefers solo or small-group work.",
            "Independent and self-directed; prefers solo or small-group settings."});
        MI_SUMMARY.put("Intrapersonal", new String[]{
            "Deeply self-aware; reflects on feelings, values, and choices.",
            "Deeply self-aware; reflective about values, strengths, and emotions.",
            "Deeply self-aware; reflective about values, strengths, and emotions.",
            "Reasonably self-aware; reflects on actions effectively.",
            "Reasonably self-aware; reflects effectively on actions and choices.",
            "Reasonably self-aware; reflects effectively on actions and choices.",
            "Self-awareness still growing; common and developing at this age.",
            "Self-awareness still developing; common and growing at this stage.",
            "Self-awareness still developing; common and growing at this stage."});
        MI_SUMMARY.put("Bodily-Kinesthetic", new String[]{
            "Physically intelligent; body and hands are tools of thought.",
            "Physically intelligent; body and hands are tools of thinking.",
            "Physically intelligent; body and hands are tools of thought.",
            "Well-coordinated; enjoys mix of physical and mental activity.",
            "Well-coordinated; enjoys mix of physical and mental work.",
            "Well-coordinated; enjoys mix of physical and mental work.",
            "Less physically inclined; thinks and creates more than moves.",
            "Less physically inclined; thinks and creates more than moves.",
            "Less physically inclined; thinks and creates more than moves."});
        MI_SUMMARY.put("Musical", new String[]{
            "Musical ear; sensitive to rhythm, pitch, and sound.",
            "Musical ear; sensitive to rhythm, pitch, and sound.",
            "Musical ear; sensitive to rhythm, pitch, and sound.",
            "Enjoys music; appreciates rhythm and melody personally.",
            "Enjoys music; appreciates rhythm and sound personally.",
            "Enjoys music; appreciates rhythm and sound personally.",
            "Music not a primary strength; doesn't define you.",
            "Music not a primary strength; doesn't define you.",
            "Music not a primary strength; doesn't define you."});
        MI_SUMMARY.put("Naturalistic", new String[]{
            "Nature-loving; connects deeply with plants, animals, and ecosystems.",
            "Nature-loving; connects deeply with plants, animals, ecosystems.",
            "Nature-loving; connects deeply with plants, animals, and ecosystems.",
            "Nature-aware; notices environment and natural patterns.",
            "Nature-aware; notices patterns and cares about environment.",
            "Nature-aware; notices patterns and cares about the environment.",
            "Less drawn to nature; energised by other settings.",
            "Less drawn to nature; energised by other environments.",
            "Less drawn to nature; energised by other environments."});

        // ═══════════ Career-9 Abilities (keyed by backend ability name) ═══════════
        ABILITY_NAME.put("Speed and accuracy", "Detail Spotter");
        ABILITY_NAME.put("Computational", "Number Cruncher");
        ABILITY_NAME.put("Language/Communication", "Speaker");
        ABILITY_NAME.put("Creativity/Artistic", "Idea Generator");
        ABILITY_NAME.put("Decision making & problem solving", "Fixer");
        ABILITY_NAME.put("Form perception", "Picture Power");
        ABILITY_NAME.put("Finger dexterity", "Fine Crafter");
        ABILITY_NAME.put("Technical", "Tech Expert");
        ABILITY_NAME.put("Motor movement", "Coordination Pro");
        ABILITY_NAME.put("Logical reasoning", "Reasoner");

        ABILITY_SUMMARY.put("Speed and accuracy", new String[]{
            "Quick and accurate; processes information rapidly and precisely.",
            "Quick and accurate; processes information rapidly and precisely.",
            "Quick and accurate; processes information rapidly and precisely.",
            "Fairly fast and accurate; sharpens with regular practice.",
            "Fairly fast and accurate; can sharpen with practice.",
            "Fairly fast and accurate; can sharpen with practice.",
            "Careful and deliberate; values quality over speed.",
            "Careful and deliberate; values quality over speed.",
            "Careful and deliberate; values quality over speed."});
        ABILITY_SUMMARY.put("Computational", new String[]{
            "Strong with numbers; thinks quantitatively and logically with ease.",
            "Strong with numbers; thinks quantitatively and logically with ease.",
            "Strong with numbers; comfortable thinking quantitatively and logically.",
            "Reasonably numerate; handles everyday number tasks comfortably.",
            "Reasonably numerate; handles everyday number tasks comfortably.",
            "Reasonably numerate; handles everyday numbers comfortably.",
            "Numbers feel effortful; strengths lie outside computation.",
            "Numbers feel effortful; strengths lie outside heavy computation.",
            "Numbers feel effortful; strengths lie outside computation."});
        ABILITY_SUMMARY.put("Language/Communication", new String[]{
            "Expressive and persuasive; communicates clearly in speech and writing.",
            "Expressive and persuasive; communicates clearly in speech and writing.",
            "Expressive and persuasive; communicates clearly in speech and writing.",
            "Communicates well; comfortable in most social and written contexts.",
            "Communicates well; comfortable in most social and written contexts.",
            "Communicates well; comfortable in most social and written contexts.",
            "Formal communication still developing; very learnable over time.",
            "Formal communication still developing; learnable skill over time.",
            "Formal communication still developing; learnable skill over time."});
        ABILITY_SUMMARY.put("Creativity/Artistic", new String[]{
            "Original thinker; sees possibilities and generates fresh ideas.",
            "Original thinker; sees possibilities and generates fresh ideas.",
            "Original thinker; sees possibilities and generates fresh ideas.",
            "Creative and flexible; thinks adaptively alongside other strengths.",
            "Creative and flexible; thinks adaptively alongside other strengths.",
            "Creative and flexible; thinks adaptively alongside other strengths.",
            "Prefers structure; uncomfortable with open-ended creative ambiguity.",
            "Prefers structure; uncomfortable with open-ended creative ambiguity.",
            "Prefers structure; uncomfortable with open-ended creative ambiguity."});
        ABILITY_SUMMARY.put("Decision making & problem solving", new String[]{
            "Decisive and quick-thinking; makes sound judgments under pressure.",
            "Decisive and quick-thinking; makes sound judgments under pressure.",
            "Decisive and quick-thinking; makes sound judgments under pressure.",
            "Sound decision-maker; takes more time for complex calls.",
            "Sound decision-maker; needs more time for complex calls.",
            "Sound decision-maker; needs more time for complex calls.",
            "Pressure decisions stressful; prefers clear, structured processes.",
            "Pressure-decisions stressful; prefers clear, structured processes.",
            "Pressure-decisions stressful; prefers clear, structured processes."});
        ABILITY_SUMMARY.put("Form perception", new String[]{
            "Sharp eye; spots visual detail and patterns quickly.",
            "Sharp eye; spots visual detail and pattern quickly.",
            "Sharp eye; spots visual detail and pattern quickly.",
            "Visually attentive; works well with patterns and details.",
            "Visually attentive; works comfortably with patterns and details.",
            "Visually attentive; works comfortably with patterns and details.",
            "Detail-heavy visuals tough; thinks better in words.",
            "Detail-heavy visuals tough; thinks better in words or ideas.",
            "Detail-heavy visuals tough; thinks better in words or ideas."});
        ABILITY_SUMMARY.put("Finger dexterity", new String[]{
            "Precise and dexterous; hands are skilled and controlled.",
            "Precise and dexterous; hands are skilled and controlled.",
            "Precise and dexterous; hands are skilled and controlled.",
            "Developing dexterity; comfortable with everyday hand tasks.",
            "Developing dexterity; comfortable for most everyday hand tasks.",
            "Developing dexterity; comfortable for most everyday hand tasks.",
            "Hand-precision tough; strengths lie in thinking and people.",
            "Hand-precision tough; strengths lie in thinking and people.",
            "Hand-precision tough; strengths lie in thinking and people."});
        ABILITY_SUMMARY.put("Technical", new String[]{
            "Mechanically minded; understands how machines and systems work.",
            "Mechanically minded; understands how machines and systems work.",
            "Mechanically minded; understands how machines and systems work.",
            "Reasonably technical; comfortable with most machines and gadgets.",
            "Reasonably technical; comfortable with most machines and technology.",
            "Reasonably technical; comfortable with most machines and technology.",
            "Less mechanically inclined; strengths lie in people or words.",
            "Less mechanically inclined; strengths lie in people or words.",
            "Less mechanically inclined; strengths lie in people or words."});
        ABILITY_SUMMARY.put("Motor movement", new String[]{
            "Athletic and energetic; high stamina and physical coordination.",
            "Athletic and energetic; high stamina and physical coordination.",
            "Athletic and energetic; high stamina and physical coordination.",
            "Coordinated; enjoys moderately active and balanced settings.",
            "Coordinated; enjoys moderately active and balanced settings.",
            "Coordinated; enjoys moderately active and balanced settings.",
            "Less physically energised; prefers calmer, indoor activity.",
            "Less physically energised; prefers calmer, indoor activity.",
            "Less physically energised; prefers calmer, indoor activity."});
        ABILITY_SUMMARY.put("Logical reasoning", new String[]{
            "Exceptional logical reasoner; solves complex problems step-by-step.",
            "Exceptional logical reasoner; solves complex problems step-by-step.",
            "Exceptional logical reasoner; solves complex problems step-by-step.",
            "Logical reasoner; works through most problems with effort.",
            "Logical reasoner; works through most problems with effort.",
            "Logical reasoner; works through most problems with effort.",
            "Complex logic tough; different kind of intelligence at work.",
            "Complex logic tough; different kind of intelligence at work.",
            "Complex logic tough; different kind of intelligence at work."});
    }

    // ═══════════════════════ Lookups ═══════════════════════

    public static String riasecName(RiasecType type) {
        String n = type != null ? RIASEC_NAME.get(type.name()) : null;
        return n != null ? n : (type != null ? type.label() : "");
    }

    public static String miName(String backendName) {
        String n = MI_NAME.get(backendName);
        return n != null ? n : Navigator360EngineService.miDisplayName(backendName);
    }

    public static String abilityName(String backendName) {
        String n = ABILITY_NAME.get(backendName);
        return n != null ? n : Navigator360EngineService.abilityDisplayName(backendName);
    }

    public static String riasecSummary(RiasecType type, AbsoluteLevel level, PagerVariant variant) {
        return summary(RIASEC_SUMMARY, type != null ? type.name() : null, level, variant);
    }

    public static String miSummary(String backendName, AbsoluteLevel level, PagerVariant variant) {
        return summary(MI_SUMMARY, backendName, level, variant);
    }

    public static String abilitySummary(String backendName, AbsoluteLevel level, PagerVariant variant) {
        return summary(ABILITY_SUMMARY, backendName, level, variant);
    }

    private static String summary(Map<String, String[]> table, String key,
                                  AbsoluteLevel level, PagerVariant variant) {
        String[] rows = key != null ? table.get(key) : null;
        if (rows == null) return "";
        int levelIdx = level == AbsoluteLevel.HIGH ? 0 : level == AbsoluteLevel.MODERATE ? 1 : 2;
        int variantIdx = variant == PagerVariant.INSIGHT ? 0 : variant == PagerVariant.SUBJECT ? 1 : 2;
        return rows[levelIdx * 3 + variantIdx];
    }
}
