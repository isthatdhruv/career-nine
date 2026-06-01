package com.kccitm.api.service.b2c.pager;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.kccitm.api.service.b2c.pager.Navigator360Models.CareerMatch;
import com.kccitm.api.service.b2c.pager.Navigator360Models.Navigator360Result;
import com.kccitm.api.service.b2c.pager.Navigator360Models.ScoredDimension;
import com.kccitm.api.service.b2c.pager.Navigator360Models.StudentMeta;

/**
 * Builds the placeholder map consumed by the three pager template variants
 * (insight / subject / career). Ports
 * {@code react-social/.../FourPagerEngine.ts} 1:1 so the on-page content
 * (creative persona names, growth-area narrative, alignment labels) matches
 * what the admin app already renders.
 */
@Service
public class FourPagerEngineService {

    public enum PagerVariant {
        INSIGHT("insight"), SUBJECT("subject"), CAREER("career");

        public final String key;
        PagerVariant(String key) { this.key = key; }
    }

    /** Templates from {@code src/main/resources/four-pager-template/}. */
    public PagerVariant resolveVariant(String gradeGroup) {
        if ("6-8".equals(gradeGroup)) return PagerVariant.INSIGHT;
        if ("9-10".equals(gradeGroup)) return PagerVariant.SUBJECT;
        return PagerVariant.CAREER;  // "11-12" or unknown
    }

    /** Classpath path under {@code resources/} for the variant template. */
    public String templateResourcePath(PagerVariant variant) {
        return "four-pager-template/" + variant.key + "-navigator.html";
    }

    // ═════════════ Creative display names + narrative descriptions ═════════════

    private static final Map<RiasecType, String[]> RIASEC_CREATIVE = new LinkedHashMap<>();
    private static final Map<String, String[]> MI_CREATIVE = new LinkedHashMap<>();
    private static final Map<String, String[]> ABILITY_CREATIVE = new LinkedHashMap<>();
    private static final Map<String, String> VALUE_CREATIVE = new LinkedHashMap<>();
    private static final String[] CP_RANK = {"PRIMARY", "SECONDARY", "TERTIARY"};

    static {
        RIASEC_CREATIVE.put(RiasecType.R, new String[]{"The Hands-On Thinker", "Enjoys practical work and learning by doing."});
        RIASEC_CREATIVE.put(RiasecType.I, new String[]{"The Analyst", "A natural problem-solver and deep thinker."});
        RIASEC_CREATIVE.put(RiasecType.A, new String[]{"The Creator", "Expresses ideas through design and imagination."});
        RIASEC_CREATIVE.put(RiasecType.S, new String[]{"The Helper", "Thrives on supporting, teaching and uplifting others."});
        RIASEC_CREATIVE.put(RiasecType.E, new String[]{"The Persuader", "Leads conversations, opportunities and people."});
        RIASEC_CREATIVE.put(RiasecType.C, new String[]{"The Organiser", "Brings structure, reliability and precision to work."});

        MI_CREATIVE.put("Logical-Mathematical", new String[]{"Number Wizard", "Patterns, logic and systems are your natural language."});
        MI_CREATIVE.put("Linguistic", new String[]{"Word Smith", "Reading, writing and speaking come alive for you."});
        MI_CREATIVE.put("Visual-Spatial", new String[]{"Visual Thinker", "Thinks in pictures, patterns and spaces."});
        MI_CREATIVE.put("Spatial-Visual", new String[]{"Visual Thinker", "Thinks in pictures, patterns and spaces."});
        MI_CREATIVE.put("Interpersonal", new String[]{"People Connector", "Reads people, builds bridges, leads teams."});
        MI_CREATIVE.put("Intrapersonal", new String[]{"Reflective Thinker", "Grows through self-reflection and self-awareness."});
        MI_CREATIVE.put("Bodily-Kinesthetic", new String[]{"Body Mover", "Learns fastest through movement and hands-on practice."});
        MI_CREATIVE.put("Musical", new String[]{"Rhythm Master", "Hears pattern, pitch and tempo before words."});
        MI_CREATIVE.put("Naturalistic", new String[]{"Nature Reader", "Senses how living systems and the outdoors connect."});

        ABILITY_CREATIVE.put("Logical reasoning", new String[]{"Sharp Logical Mind", "Identifies patterns and solves complex problems step-by-step."});
        ABILITY_CREATIVE.put("Computational", new String[]{"Number Cruncher", "Maths and calculations feel natural and enjoyable."});
        ABILITY_CREATIVE.put("Technical", new String[]{"Tech Wizard", "Understands how tools and systems actually work."});
        ABILITY_CREATIVE.put("Language/Communication", new String[]{"Word Smith", "Explains ideas clearly in speech and writing."});
        ABILITY_CREATIVE.put("Creativity/Artistic", new String[]{"Creative Soul", "Generates original ideas others wouldn’t."});
        ABILITY_CREATIVE.put("Form perception", new String[]{"Pattern Spotter", "Notices shape, layout and visual detail at a glance."});
        ABILITY_CREATIVE.put("Speed and accuracy", new String[]{"Precision Master", "Processes information quickly with few mistakes."});
        ABILITY_CREATIVE.put("Decision making & problem solving", new String[]{"Quick Decider", "Weighs trade-offs and acts well under uncertainty."});
        ABILITY_CREATIVE.put("Finger dexterity", new String[]{"Skilled Hands", "Precise, steady fine-motor control."});
        ABILITY_CREATIVE.put("Motor movement", new String[]{"Power Mover", "Strong, coordinated large-muscle performance."});

        VALUE_CREATIVE.put("Mental Activity", "The Deep Thinker");
        VALUE_CREATIVE.put("High Achievement", "The Achiever");
        VALUE_CREATIVE.put("Autonomy", "The Free Thinker");
        VALUE_CREATIVE.put("Good Salary", "The Earner");
        VALUE_CREATIVE.put("Creativity", "Idea Generator");
        VALUE_CREATIVE.put("Helping Others", "The Helper");
        VALUE_CREATIVE.put("Job Security", "The Stable One");
        VALUE_CREATIVE.put("Prestige", "The Distinguished");
        VALUE_CREATIVE.put("Prestige / Status", "The Distinguished");
        VALUE_CREATIVE.put("Physical Activity", "The Active One");
        VALUE_CREATIVE.put("Working with Hands", "The Craftsperson");
        VALUE_CREATIVE.put("Leadership", "The Leader");
        VALUE_CREATIVE.put("Work-Life Balance", "The Balancer");
        VALUE_CREATIVE.put("Social Impact", "The Impact Maker");
        VALUE_CREATIVE.put("Routine Activity", "The Steady One");
        VALUE_CREATIVE.put("Variety", "The Explorer");
        VALUE_CREATIVE.put("Variety / Adventure", "The Explorer");
    }

    // ═════════════ "Things to do" action recommendations (home / school) ═════════════
    // Keyed by top RIASEC type, one map per pager variant. Value = {schoolActions, homeActions}.

    private static final Map<RiasecType, String[][]> ACTION_INSIGHT = new LinkedHashMap<>();
    private static final Map<RiasecType, String[][]> ACTION_SUBJECT = new LinkedHashMap<>();
    private static final Map<RiasecType, String[][]> ACTION_CAREER  = new LinkedHashMap<>();

    static {
        // ── R (Realistic) ──
        ACTION_INSIGHT.put(RiasecType.R, new String[][]{
            {"Help maintain the school garden.",
             "Assist in setting up sports events.",
             "Organize classroom clean-up activities.",
             "Volunteer to help with equipment in the sports room."},
            {"Help fix small household items (e.g., bike repairs).",
             "Set up a bird feeder or plant a small garden at home.",
             "Help parents organize groceries.",
             "Help set up and maintain a pet's living space."}});
        ACTION_SUBJECT.put(RiasecType.R, new String[][]{
            {"Join the school's robotics or mechanical club.",
             "Organize inter-house sports competitions.",
             "Assist in setting up school labs for practical sessions.",
             "Volunteer for setting up audio/visual equipment during events."},
            {"Take charge of organizing the kitchen or storage spaces.",
             "Build a simple project using DIY kits (e.g., circuits).",
             "Maintain home tools and assist in fixing minor issues.",
             "Help manage and organize a small vegetable or herb garden."}});
        ACTION_CAREER.put(RiasecType.R, new String[][]{
            {"Lead the robotics or engineering club projects.",
             "Mentor juniors in the school workshop or lab.",
             "Take charge of technical setup for major school events.",
             "Represent the school at state-level technical or sports competitions."},
            {"Take on a real DIY project at home (electrical, carpentry, repair).",
             "Pursue a sport or fitness goal seriously alongside studies.",
             "Set up and maintain a home garden or aquarium.",
             "Learn to drive or service a two-wheeler / car basics."}});

        // ── I (Investigative) ──
        ACTION_INSIGHT.put(RiasecType.I, new String[][]{
            {"Join the science club and participate in lab experiments.",
             "Take part in quiz competitions.",
             "Participate in small coding or programming challenges.",
             "Help in collecting data for school research projects."},
            {"Watch educational documentaries and write down observations.",
             "Set up a small home science lab.",
             "Build simple machines or models from everyday materials.",
             "Learn to program using free coding tutorials."}});
        ACTION_SUBJECT.put(RiasecType.I, new String[][]{
            {"Join a school-level research competition.",
             "Lead a project in the science lab involving data analysis.",
             "Participate in mathematics Olympiads or science fairs.",
             "Write for the school's science magazine or blog."},
            {"Explore online courses (coding, astronomy, physics).",
             "Solve puzzles or brain teasers to improve problem-solving.",
             "Participate in online science competitions.",
             "Learn to use a telescope or microscope at home."}});
        ACTION_CAREER.put(RiasecType.I, new String[][]{
            {"Conduct an independent research project under a teacher's guidance.",
             "Compete in national-level Olympiads or science fairs.",
             "Present a paper at an inter-school science seminar.",
             "Tutor juniors in advanced science or maths topics."},
            {"Take advanced online courses (Coursera, NPTEL, edX).",
             "Read and review research papers in your area of interest.",
             "Build a personal project (app, experiment, data study).",
             "Prepare seriously for entrance exams (JEE, NEET, etc.)."}});

        // ── A (Artistic) ──
        ACTION_INSIGHT.put(RiasecType.A, new String[][]{
            {"Join the school's art and craft club.",
             "Participate in painting or drawing competitions.",
             "Help design posters for school events.",
             "Join the school choir or music group."},
            {"Create handmade greeting cards for family and friends.",
             "Write and illustrate your own short story.",
             "Try clay modelling or sculpture at home.",
             "Learn a new musical instrument or practice an existing one."}});
        ACTION_SUBJECT.put(RiasecType.A, new String[][]{
            {"Participate in the school's annual art exhibition.",
             "Help design stage sets or props for school dramas.",
             "Join a photography club and capture school events.",
             "Write scripts and direct short plays for school functions."},
            {"Create a portfolio of your artwork or photography.",
             "Try digital art using free design software.",
             "Start a blog or Instagram page to showcase your creativity.",
             "Take up video editing or filmmaking as a hobby."}});
        ACTION_CAREER.put(RiasecType.A, new String[][]{
            {"Curate the school's annual cultural festival.",
             "Direct a full-length play or short film for the school.",
             "Lead the editorial team of the school magazine.",
             "Showcase work at inter-school art or design exhibitions."},
            {"Build a strong portfolio for design / arts college applications.",
             "Take on freelance creative work (logos, photos, content).",
             "Learn a professional creative tool (Photoshop, Premiere, Canva Pro).",
             "Publish work online — blog, Instagram, YouTube."}});

        // ── S (Social) ──
        ACTION_INSIGHT.put(RiasecType.S, new String[][]{
            {"Join the school's peer mentoring program.",
             "Volunteer to help new students settle in.",
             "Join the student council to represent your class.",
             "Take part in school health awareness campaigns."},
            {"Help younger siblings with their homework.",
             "Organize a neighbourhood cleanliness drive.",
             "Volunteer at a local community centre.",
             "Teach basic skills to younger children in the neighbourhood."}});
        ACTION_SUBJECT.put(RiasecType.S, new String[][]{
            {"Lead or join a social service club.",
             "Organize blood donation or health camps with the school.",
             "Volunteer as a tutor for younger students.",
             "Lead an anti-bullying awareness campaign."},
            {"Plan and lead a community service project (e.g., tree planting).",
             "Volunteer to teach skills to underprivileged children.",
             "Organize a donation drive for a local charity.",
             "Mentor younger cousins or friends with their studies."}});
        ACTION_CAREER.put(RiasecType.S, new String[][]{
            {"Lead a large-scale community service project through school.",
             "Head the peer counselling or student wellness committee.",
             "Mentor junior students in academics and life skills.",
             "Organise inter-school discussions on social issues."},
            {"Volunteer regularly with an NGO or old-age home.",
             "Teach a weekly class for underprivileged children.",
             "Lead a community awareness campaign (health, safety, environment).",
             "Mentor a younger student or cousin through their studies."}});

        // ── E (Enterprising) ──
        ACTION_INSIGHT.put(RiasecType.E, new String[][]{
            {"Participate in student council elections.",
             "Lead a group project in class.",
             "Plan a class or house event for annual day.",
             "Lead a team in class debates or discussions."},
            {"Start a small business selling handmade crafts.",
             "Help parents with managing finances (tracking expenses).",
             "Start a small savings plan for personal purchases.",
             "Organize neighbourhood sales for unwanted items."}});
        ACTION_SUBJECT.put(RiasecType.E, new String[][]{
            {"Organize an entrepreneurship workshop for classmates.",
             "Start a student-led business club.",
             "Lead an inter-house competition.",
             "Manage marketing for school events (posters, social media)."},
            {"Set up a small online business (e.g., selling crafts).",
             "Help manage family expenses and plan a savings strategy.",
             "Start a blog or YouTube channel to share skills or hobbies.",
             "Help local businesses with simple marketing ideas."}});
        ACTION_CAREER.put(RiasecType.E, new String[][]{
            {"Run for school head / house captain.",
             "Pitch and lead a student startup or social enterprise.",
             "Represent the school at model UN, business, or debate competitions.",
             "Lead fundraising and sponsorship drives for school events."},
            {"Run a small online business or service (tutoring, reselling).",
             "Manage your own savings, expenses, and a basic investment plan.",
             "Build a personal brand on LinkedIn / Instagram / YouTube.",
             "Take an internship or shadow a professional in your field."}});

        // ── C (Conventional) ──
        ACTION_INSIGHT.put(RiasecType.C, new String[][]{
            {"Help organize class notes for your classmates.",
             "Join the library club and help organize books.",
             "Manage attendance and record-keeping for group projects.",
             "Help teachers with organizing files and documents."},
            {"Organize family documents and important papers.",
             "Create a daily schedule for household chores.",
             "Help with making grocery lists and budgeting.",
             "Track personal savings and expenses in a notebook."}});
        ACTION_SUBJECT.put(RiasecType.C, new String[][]{
            {"Take responsibility for maintaining school inventory.",
             "Assist in preparing the class timetable or duty roster.",
             "Help teachers with data entry and record-keeping.",
             "Assist in cataloguing school library resources."},
            {"Create a monthly family budget and track expenses.",
             "Help manage and file household bills and utilities.",
             "Set up a personal filing system for important documents.",
             "Create a household inventory of items and supplies."}});
        ACTION_CAREER.put(RiasecType.C, new String[][]{
            {"Manage the finance or logistics committee for the annual fest.",
             "Maintain digital records and reports for the student council.",
             "Help coordinate exam schedules and admin tasks.",
             "Build and maintain a digital archive of school activities."},
            {"Maintain a complete household budget and bill tracker.",
             "Plan and manage logistics for a family trip end-to-end.",
             "Build a personal academic and career planner.",
             "Organise and digitise family documents and records."}});
    }

    /** {school, home} action arrays for a top RIASEC type in the given variant; null if unknown. */
    private static String[][] actionsFor(PagerVariant variant, RiasecType top) {
        if (top == null) return null;
        Map<RiasecType, String[][]> map =
            variant == PagerVariant.INSIGHT ? ACTION_INSIGHT
          : variant == PagerVariant.SUBJECT ? ACTION_SUBJECT
          : ACTION_CAREER;
        return map.get(top);
    }

    /** Render an action list as the numbered, &lt;br&gt;-joined text the template's &lt;p&gt; expects. */
    private static String joinActions(String[] actions) {
        if (actions == null || actions.length == 0) return "";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < actions.length; i++) {
            if (i > 0) sb.append("<br>");
            sb.append(i + 1).append(". ").append(actions[i]);
        }
        return sb.toString();
    }

    // ═════════════════════════════ Helpers ═════════════════════════════════════

    private static String levelLabel(AbsoluteLevel level) {
        if (level == AbsoluteLevel.HIGH) return "HIGH";
        if (level == AbsoluteLevel.MODERATE) return "MODERATE";
        return "DEVELOPING";
    }

    private static List<ScoredDimension> sortDesc(List<ScoredDimension> dims) {
        List<ScoredDimension> sorted = new ArrayList<>(dims);
        sorted.sort(Comparator.comparingDouble((ScoredDimension d) -> d.normPct).reversed());
        return sorted;
    }

    private static String todayLabel() {
        return new SimpleDateFormat("d MMMM yyyy", Locale.forLanguageTag("en-IN")).format(new Date());
    }

    private static String cciDescription(CciLevel cci) {
        if (cci == CciLevel.High)
            return "2 or more of your career choices match your top suitability careers.";
        if (cci == CciLevel.Moderate)
            return "Some of your career choices align with your top suitability range.";
        return "Your career choices differ from your strength-based suggestions — a great discussion for your counsellor.";
    }

    private static String coherenceLabel(int p2Aspirations) {
        if (p2Aspirations >= 15) return "High";
        if (p2Aspirations >= 8) return "Moderate";
        return "Developing";
    }

    private static String subjectAlignment(List<String> subjects, List<RiasecType> top3Riasec) {
        if (subjects == null || subjects.isEmpty()) return "Exploring";
        Set<RiasecType> top = new HashSet<>(top3Riasec);
        long aligned = subjects.stream()
                .map(Navigator360CareerData.SUBJECT_RIASEC::get)
                .filter(r -> r != null && top.contains(r))
                .count();
        double ratio = (double) aligned / subjects.size();
        String label = ratio >= 0.67 ? "High" : ratio >= 0.34 ? "Moderate" : "Developing";
        return label + " — " + aligned + "/" + subjects.size() + " match your top types";
    }

    private static String careerTags(CareerMatch match) {
        List<String> tags = new ArrayList<>();
        if (match.career.riasec != null) {
            match.career.riasec.stream().limit(2).forEach(r -> tags.add(r.label()));
        }
        if (match.matchedValues != null && !match.matchedValues.isEmpty()) {
            tags.add(match.matchedValues.get(0));
        }
        return tags.stream()
                .map(t -> "<span class=\"p4n-career-tag\">" + t + "</span>")
                .collect(Collectors.joining());
    }

    private static String careerShortDesc(CareerMatch match) {
        if (match.career.degreePaths == null || match.career.degreePaths.isEmpty()) return "";
        String first = match.career.degreePaths.get(0);
        int rest = match.career.degreePaths.size() - 1;
        return rest > 0 ? first + " · +" + rest + " more paths" : first;
    }

    /** 5 growth areas pulled from the lowest-scoring entries across all three pillars. */
    private static List<String[]> pickGrowthAreas(List<ScoredDimension> riasec,
                                                   List<ScoredDimension> mi,
                                                   List<ScoredDimension> abilities) {
        List<double[]> ignored = new ArrayList<>(); // placeholder if needed
        ignored.clear();

        List<Object[]> all = new ArrayList<>();
        for (ScoredDimension d : riasec) {
            RiasecType r = safeRiasec(d.name);
            String label = r != null && RIASEC_CREATIVE.containsKey(r)
                    ? RIASEC_CREATIVE.get(r)[0]
                    : (r != null ? r.label() : d.name);
            all.add(new Object[]{label, d.level, d.normPct});
        }
        for (ScoredDimension d : mi) {
            String displayName = Navigator360EngineService.miDisplayName(d.name);
            String[] creative = MI_CREATIVE.get(displayName);
            if (creative == null) creative = MI_CREATIVE.get(d.name);
            String label = creative != null ? creative[0] : displayName;
            all.add(new Object[]{label, d.level, d.normPct});
        }
        for (ScoredDimension d : abilities) {
            String[] creative = ABILITY_CREATIVE.get(d.name);
            String label = creative != null ? creative[0] : Navigator360EngineService.abilityDisplayName(d.name);
            all.add(new Object[]{label, d.level, d.normPct});
        }
        all.sort(Comparator.comparingDouble(o -> (double) o[2]));
        return all.stream().limit(5)
                .map(o -> new String[]{(String) o[0], levelLabel((AbsoluteLevel) o[1])})
                .collect(Collectors.toList());
    }

    private static RiasecType safeRiasec(String name) {
        try { return RiasecType.valueOf(name); } catch (Exception ex) { return null; }
    }

    // ═══════════════════════════ Main mapping ═══════════════════════════════════

    /** Keys mirrored from {@code FOUR_PAGER_PLACEHOLDER_KEYS} in FourPagerTypes.ts. */
    public static final List<String> PLACEHOLDER_KEYS = Arrays.asList(
        "student_name", "grade", "age", "school_name", "school_city",
        "report_date", "qr_code", "qr_image_url",
        "holland_code", "ability_aggregate",
        "cp_1", "cp_1_level", "cp_1_desc",
        "cp_2", "cp_2_level", "cp_2_desc",
        "cp_3", "cp_3_level", "cp_3_desc",
        "mi_1", "mi_1_level", "mi_1_desc",
        "mi_2", "mi_2_level", "mi_2_desc",
        "mi_3", "mi_3_level", "mi_3_desc",
        "ab_1", "ab_1_level", "ab_1_desc",
        "ab_2", "ab_2_level", "ab_2_desc",
        "ab_3", "ab_3_level", "ab_3_desc",
        "ab_4", "ab_4_level", "ab_4_desc",
        "value_1", "value_2", "value_3", "value_4", "value_5", "values_basis",
        "subject_1", "subject_2", "subject_3", "subject_alignment",
        "aspiration_1", "aspiration_2", "aspiration_3", "aspiration_4", "aspiration_coherence",
        "strength_profile_1", "strength_profile_2", "strength_profile_3", "strength_profile_4",
        "clarity_index", "clarity_description", "alignment_score",
        "career_1_name", "career_1_score", "career_1_pct", "career_1_desc", "career_1_tags",
        "career_2_name", "career_2_score", "career_2_pct", "career_2_desc", "career_2_tags",
        "career_3_name", "career_3_score", "career_3_pct", "career_3_desc", "career_3_tags",
        "career_4_name", "career_4_score", "career_4_pct", "career_4_desc", "career_4_tags",
        "career_5_name", "career_5_score", "career_5_pct", "career_5_desc", "career_5_tags",
        "career_6_name", "career_6_score", "career_6_pct", "career_6_desc", "career_6_tags",
        "career_7_name", "career_7_score", "career_7_pct", "career_7_desc", "career_7_tags",
        "career_8_name", "career_8_score", "career_8_pct", "career_8_desc", "career_8_tags",
        "career_9_name", "career_9_score", "career_9_pct", "career_9_desc", "career_9_tags",
        "career_cluster_count",
        "growth_1_name", "growth_1_level",
        "growth_2_name", "growth_2_level",
        "growth_3_name", "growth_3_level",
        "growth_4_name", "growth_4_level",
        "growth_5_name", "growth_5_level",
        "growth_note",
        // ── Keys added for the redesigned pager templates (2026-05) ──
        "cci", "most_suited_1", "most_suited_2",
        "home_action", "school_action",
        "achievements", "hobbies_interests",
        "p1%", "p2%", "p3%", "p4%", "p5%", "p6%", "p7%", "p8%", "p9%"
    );

    public Map<String, String> buildPlaceholders(Navigator360Result r, StudentMeta s) {
        Map<String, String> out = new LinkedHashMap<>();
        for (String k : PLACEHOLDER_KEYS) out.put(k, "");

        // Student / meta
        out.put("student_name", nz(s.studentName, r.studentName));
        out.put("grade", nz(s.studentClass, r.studentClass));
        out.put("age", s.age != null ? s.age : "");
        out.put("school_name", nz(s.schoolName, ""));
        out.put("school_city", nz(s.schoolCity, ""));
        out.put("report_date", todayLabel());
        out.put("qr_code", nz(s.reportUrl, ""));

        // Aggregate headers
        out.put("holland_code", nz(r.hollandCode, ""));
        long abHigh = r.abilities.stream().filter(a -> a.level == AbsoluteLevel.HIGH).count();
        long abMod = r.abilities.stream().filter(a -> a.level == AbsoluteLevel.MODERATE).count();
        out.put("ability_aggregate", r.abilities.size() + "-Domain Aptitude · " + abHigh + " High · " + abMod + " Moderate");

        // RIASEC — top 3
        List<ScoredDimension> riasecTop = sortDesc(r.riasec);
        if (riasecTop.size() > 3) riasecTop = riasecTop.subList(0, 3);
        for (int i = 0; i < riasecTop.size(); i++) {
            ScoredDimension d = riasecTop.get(i);
            RiasecType key = safeRiasec(d.name);
            String[] creative = key != null ? RIASEC_CREATIVE.get(key) : null;
            out.put("cp_" + (i + 1), creative != null ? creative[0] : (key != null ? key.label() : d.name));
            out.put("cp_" + (i + 1) + "_level",
                "Type " + (i + 1) + " · " + CP_RANK[i] + " · Score: " + levelLabel(d.level));
            out.put("cp_" + (i + 1) + "_desc", creative != null ? creative[1] : "");
        }

        // MI — top 3
        List<ScoredDimension> miTop = sortDesc(r.mi);
        if (miTop.size() > 3) miTop = miTop.subList(0, 3);
        for (int i = 0; i < miTop.size(); i++) {
            ScoredDimension d = miTop.get(i);
            String label = Navigator360EngineService.miDisplayName(d.name);
            String[] creative = MI_CREATIVE.get(label);
            if (creative == null) creative = MI_CREATIVE.get(d.name);
            out.put("mi_" + (i + 1), creative != null ? creative[0] : label);
            out.put("mi_" + (i + 1) + "_level",
                "MI " + (i + 1) + " · " + CP_RANK[i] + " · Score: " + levelLabel(d.level));
            out.put("mi_" + (i + 1) + "_desc", creative != null ? creative[1] : "");
        }

        // Abilities — top 4
        List<ScoredDimension> abTop = sortDesc(r.abilities);
        if (abTop.size() > 4) abTop = abTop.subList(0, 4);
        for (int i = 0; i < abTop.size(); i++) {
            ScoredDimension d = abTop.get(i);
            String[] creative = ABILITY_CREATIVE.get(d.name);
            out.put("ab_" + (i + 1), creative != null ? creative[0] : Navigator360EngineService.abilityDisplayName(d.name));
            out.put("ab_" + (i + 1) + "_level", "Ability " + (i + 1) + " · Score: " + levelLabel(d.level));
            out.put("ab_" + (i + 1) + "_desc", creative != null ? creative[1] : "");
        }

        // Values (up to 5)
        List<String> values = r.values != null ? new ArrayList<>(r.values) : new ArrayList<>();
        if (values.size() > 5) values = values.subList(0, 5);
        for (int i = 0; i < values.size(); i++) {
            String v = values.get(i);
            String spec = Navigator360CareerData.VALUE_LABEL_TO_SPEC.getOrDefault(v, v);
            String creative = VALUE_CREATIVE.get(spec);
            if (creative == null) creative = VALUE_CREATIVE.get(v);
            out.put("value_" + (i + 1), creative != null ? creative : v);
        }
        out.put("values_basis", values.stream()
                .map(v -> Navigator360CareerData.VALUE_LABEL_TO_SPEC.getOrDefault(v, v))
                .collect(Collectors.joining(" · ")));

        // Subjects (up to 3)
        List<String> subjects = r.subjectsOfInterest != null ? new ArrayList<>(r.subjectsOfInterest) : new ArrayList<>();
        if (subjects.size() > 3) subjects = subjects.subList(0, 3);
        for (int i = 0; i < subjects.size(); i++) {
            out.put("subject_" + (i + 1), subjects.get(i));
        }
        List<RiasecType> top3Riasec = riasecTop.stream()
                .map(d -> safeRiasec(d.name))
                .filter(t -> t != null)
                .collect(Collectors.toList());
        out.put("subject_alignment", subjectAlignment(subjects, top3Riasec));

        // Aspirations (up to 4)
        if (r.careerAspirations != null) {
            int max = Math.min(r.careerAspirations.size(), 4);
            for (int i = 0; i < max; i++) {
                out.put("aspiration_" + (i + 1), r.careerAspirations.get(i));
            }
        }
        out.put("aspiration_coherence", coherenceLabel(r.preferenceScore.p2Aspirations));

        // Demographic free-text profile fields (fallback strings already applied upstream).
        out.put("achievements", nz(s.achievements, ""));
        out.put("hobbies_interests", nz(s.hobbiesInterests, ""));

        // "Things to do" actions — keyed by the student's primary RIASEC type and the variant.
        RiasecType topType = riasecTop.isEmpty() ? null : safeRiasec(riasecTop.get(0).name);
        String[][] actions = actionsFor(resolveVariant(r.gradeGroup), topType);
        if (actions != null) {
            out.put("school_action", joinActions(actions[0]));
            out.put("home_action", joinActions(actions[1]));
        }

        // Strength profile — top item per pillar + top value
        if (!riasecTop.isEmpty()) {
            RiasecType key = safeRiasec(riasecTop.get(0).name);
            String[] c = key != null ? RIASEC_CREATIVE.get(key) : null;
            out.put("strength_profile_1", c != null ? c[0] : (key != null ? key.label() : riasecTop.get(0).name));
        }
        if (!miTop.isEmpty()) {
            String label = Navigator360EngineService.miDisplayName(miTop.get(0).name);
            String[] c = MI_CREATIVE.get(label);
            out.put("strength_profile_2", c != null ? c[0] : label);
        }
        if (!abTop.isEmpty()) {
            String[] c = ABILITY_CREATIVE.get(abTop.get(0).name);
            out.put("strength_profile_3", c != null ? c[0]
                    : Navigator360EngineService.abilityDisplayName(abTop.get(0).name));
        }
        if (!values.isEmpty()) {
            String v = values.get(0);
            String spec = Navigator360CareerData.VALUE_LABEL_TO_SPEC.getOrDefault(v, v);
            String creative = VALUE_CREATIVE.get(spec);
            out.put("strength_profile_4", creative != null ? creative : v);
        }

        // Clarity + alignment
        out.put("clarity_index", r.cci != null ? r.cci.name() : "");
        out.put("clarity_description", cciDescription(r.cci));
        out.put("alignment_score", String.valueOf(r.alignmentScore));

        // Static Career Library QR
        out.put("qr_image_url",
            "https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data="
            + "https%3A%2F%2Flibrary.career-9.com"
            + "&color=0B3D2E&bgcolor=ffffff");

        // Top 9 career matches
        List<CareerMatch> topCareers = r.careerMatches != null
                ? r.careerMatches.stream().limit(9).collect(Collectors.toList())
                : new ArrayList<>();
        for (int i = 0; i < topCareers.size(); i++) {
            CareerMatch m = topCareers.get(i);
            int n = i + 1;
            out.put("career_" + n + "_name", m.career.name != null ? m.career.name : "");
            out.put("career_" + n + "_score", m.suitability + "%");
            out.put("career_" + n + "_pct", String.valueOf(m.suitability));
            // Redesigned template renders the per-career percentage via {{p1%}}..{{p9%}}.
            // The % is inside the braces (consumed by substitution), so the value carries it.
            out.put("p" + n + "%", m.suitability + "%");
            out.put("career_" + n + "_desc", careerShortDesc(m));
            out.put("career_" + n + "_tags", careerTags(m));
        }
        out.put("career_cluster_count", String.valueOf(r.careerMatches != null ? r.careerMatches.size() : 0));

        // Top two career matches, echoed into the AI-intro line.
        out.put("most_suited_1", out.get("career_1_name"));
        out.put("most_suited_2", out.get("career_2_name"));

        // CCI% = (aspirations whose career is among the top-9 shown) / (aspirations selected) × 100.
        Set<String> top9Ids = topCareers.stream()
                .map(m -> m.career.id)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        List<String> asps = r.careerAspirations != null ? r.careerAspirations : new ArrayList<>();
        long matched = asps.stream()
                .map(Navigator360CareerData.ASPIRATION_TO_CAREER::get)
                .filter(id -> id != null && top9Ids.contains(id))
                .count();
        int cciPct = asps.isEmpty() ? 0 : (int) Math.round((double) matched / asps.size() * 100.0);
        out.put("cci", String.valueOf(cciPct));

        // Growth areas (5 lowest)
        List<String[]> growth = pickGrowthAreas(r.riasec, r.mi, r.abilities);
        for (int i = 0; i < growth.size(); i++) {
            out.put("growth_" + (i + 1) + "_name", growth.get(i)[0]);
            out.put("growth_" + (i + 1) + "_level", growth.get(i)[1]);
        }
        out.put("growth_note",
            "These are areas with room to grow. Your counsellor can suggest activities to help develop them over the coming months.");

        return out;
    }

    /** Replace every {@code {{key}}} occurrence in the template with the map value, "" if missing. */
    public String fillTemplate(String template, Map<String, String> data) {
        if (template == null) return "";
        StringBuilder out = new StringBuilder(template.length());
        int i = 0;
        while (i < template.length()) {
            int open = template.indexOf("{{", i);
            if (open < 0) {
                out.append(template, i, template.length());
                break;
            }
            out.append(template, i, open);
            int close = template.indexOf("}}", open + 2);
            if (close < 0) {
                out.append(template, open, template.length());
                break;
            }
            String key = template.substring(open + 2, close).trim();
            // Match the [a-zA-Z0-9_%]+ form ('%' covers career-percentage keys like p1%); anything else passes through verbatim.
            if (key.matches("[a-zA-Z0-9_%]+") && data.containsKey(key)) {
                String v = data.get(key);
                out.append(v != null ? v : "");
            } else {
                out.append(template, open, close + 2);
            }
            i = close + 2;
        }
        return out.toString();
    }

    private static String nz(String preferred, String fallback) {
        if (preferred != null && !preferred.isEmpty()) return preferred;
        return fallback != null ? fallback : "";
    }
}
