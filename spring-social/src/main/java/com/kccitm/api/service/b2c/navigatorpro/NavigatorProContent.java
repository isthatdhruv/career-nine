package com.kccitm.api.service.b2c.navigatorpro;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Verbatim student-facing copy for the Navigator Pro report. Pure lookups, no I/O. */
public final class NavigatorProContent {

    private NavigatorProContent() {}

    public static final class ValueRow {
        public final String icon;
        public final String title;
        public final String why;

        ValueRow(String icon, String title, String why) {
            this.icon = icon; this.title = title; this.why = why;
        }
    }

    // ── Static blocks (content sheet 2) ───────────────────────────────────────
    public static final String COVER_CAPTION =
            "Your three drive factors, drawn as your own constellation — no two students share this shape.";
    /** Use with String.format(COVER_FOOTER_TEMPLATE, firstName). */
    public static final String COVER_FOOTER_TEMPLATE =
            "A mirror and a map, not a verdict — re-measured every semester. Confidential: for %s and authorised mentors. Career-9 · career-9.com";
    public static final String RING_DRIVE      = "11 behaviours, 3 factors";
    public static final String RING_FOUNDATION = "22 everyday habits";
    public static final String RING_SKILL      = "self-rated, 12 domains";
    public static final String RING_REASONING  = "5 objective checks";
    public static final String ABOUT_CAREER9 =
            "Career-9 builds career intelligence for Indian institutions. Navigator Pro treats career development as a measured, semester-by-semester journey — validated psychometrics plus India-specific career mapping, so you act on evidence instead of guesswork.";
    public static final String ABOUT_REPORT =
            "A guidance report reflecting your current psychometric profile — drive, interests, foundation skills and work values. A strategic compass for specialisation and early-career choices; final decisions should also weigh market trends, finances and personal circumstances.";
    public static final String SECTOR_CAVEAT =
            "Computed from your domain fits — bioengineering, for example, blends process, electronics, data and quality. Indicative; explore in the Career Library and with your counsellor.";

    public static String howToRead(String firstName) {
        return "How to read this report, " + firstName + ": scores describe behaviour, and behaviour moves — the next reading measures what changed. "
                + "* Specialisation and emerging-sector mappings are being validated with industry practitioners; treat direction outputs as doors to explore with your counsellor. "
                + "Counselling is part of this programme, not an add-on.";
    }

    public static String precisionLine(int prec, int n) {
        return "Percentiles carry about ±" + prec + " in a batch of " + n + " — read levels, not points.";
    }

    // ── Factor definitions (content sheet 2, page 3) ──────────────────────────
    private static final Map<String, String> FACTOR_DEFINITIONS = Map.of(
            "f_id", "how strongly you start from within, without being pushed.",
            "f_st", "your staying power when work gets long or boring.",
            "f_ae", "how you adjust and still finish when things change.");

    public static String factorDefinition(String factorKey) {
        return FACTOR_DEFINITIONS.getOrDefault(factorKey, "");
    }

    /** Content sheet 3, "Factor callout". */
    public static String factorCallout(String topLabel, int topP, String bottomLabel, int bottomP, int prec) {
        return "Reading your drive: build plans around " + topLabel + " (P" + topP + ") — it works without willpower. "
                + "Your lowest, " + bottomLabel + " (P" + bottomP + "), moves fastest with one small scheduled rep a week. "
                + "Percentiles carry ±" + prec + " — read levels, not points.";
    }

    // ── Band paragraphs (content sheet 6) ─────────────────────────────────────
    private static final Map<String, String> BANDS = new LinkedHashMap<>();
    static {
        BANDS.put("drive|Strong", "Your drive sits in the top quarter of your batch — starting, persisting and adapting are already habits. Aim it: pick one goal per semester big enough to deserve this engine.");
        BANDS.put("drive|Developing", "Your drive is in the batch mainstream — it shows up, and it grows fastest with structure: fixed weekly slots for self-chosen work beat waiting for motivation.");
        BANDS.put("drive|Early", "Your drive behaviours are still warming up compared with your batch — normal at first year, and the most movable number in this report. One tiny self-started task a week is how it moves.");
        BANDS.put("f_id|Strong", "You start from within — you rarely need a push. Protect this by choosing work you can begin without permission.");
        BANDS.put("f_id|Developing", "You start when the path is clear. Reduce friction: decide the night before what tomorrow's first task is.");
        BANDS.put("f_id|Early", "Starting is currently the hard part. Shrink the start: two-minute versions of tasks, begun daily, rebuild this fastest.");
        BANDS.put("f_st|Strong", "Your staying power is a top-quarter asset — long or boring stretches don't shake you off. Choose at least one long project; you're built for compound payoffs.");
        BANDS.put("f_st|Developing", "You persist when progress is visible. Make it visible on purpose — a simple done-list per week keeps you in the game.");
        BANDS.put("f_st|Early", "Energy fades before the finish right now. Shorter scopes, public checkpoints, one thing finished before the next begins.");
        BANDS.put("f_ae|Strong", "When plans change you adjust and still deliver — the rarest of the three factors. Volunteer where requirements shift; you shine there.");
        BANDS.put("f_ae|Developing", "You handle change with some cost. Practise the reset: when plans break, write the new plan in five lines before feelings vote.");
        BANDS.put("f_ae|Early", "Changes currently knock work off course. Build the habit of Plan B thinking: for each task, note one thing that could change and what you'd do.");
        BANDS.put("foundation|Strong", "Your everyday work habits lead the batch — things get logged, calculated, finished. This is the multiplier on everything else you build.");
        BANDS.put("foundation|Developing", "Your habits are batch-typical. Pick ONE of the five areas and make it weekly — habits move one at a time, not five at once.");
        BANDS.put("foundation|Early", "The habit layer is thin so far — which is why it's the first thing your plan targets. Eight honest weeks on one area moves a band.");
        BANDS.put("skill|Strong", "You've already touched more career skills than three-quarters of your batch. Convert exposure into receipts: builds, certificates, repos.");
        BANDS.put("skill|Developing", "Typical first-year exposure. Your top-rated domain is the cheapest place to go deep first.");
        BANDS.put("skill|Early", "Low exposure so far — expected at entry, and the easiest gap to close: one workshop or small build changes this number fast.");
        BANDS.put("reasoning|Strong", "Your objective checks lead the batch — you compute, read data and judge sources better than most. Trust it, and lend it: explaining to others locks it in.");
        BANDS.put("reasoning|Developing", "Most checks landed. Review the one(s) that didn't — each ✘ names an exact, learnable skill.");
        BANDS.put("reasoning|Early", "Several checks missed — each one is a specific, teachable skill, not a talent verdict. The ladder in your plan starts precisely there.");
    }

    public static String bandParagraph(String indexKey, String band) {
        return BANDS.getOrDefault(indexKey + "|" + band, "");
    }

    // ── Zone copy: only "Ready to accelerate" is available (sample report); the
    // other three are go-live inputs and render empty until supplied. ────────
    private static final Map<String, String> ZONE_COPY = Map.of(
            NavigatorProNorms.ZONE_READY,
            "High drive meets real skill. Push now — competitions, internships, certifications; this zone converts effort into outcomes fastest.");

    public static String zoneCopy(String zone) {
        return ZONE_COPY.getOrDefault(zone, "");
    }

    // ── Lowest-bar first step: only "Getting things done" is available (sample). ─
    private static final Map<String, String> FIRST_STEP = Map.of(
            "fs_gd", "one small real task in it weekly — logged, not heroic. Eight weeks moves a band.");

    public static String firstStep(String subKey) {
        return FIRST_STEP.getOrDefault(subKey, "");
    }

    // ── Response-quality banner (content sheet 3) ─────────────────────────────
    public static String banner() {
        return "<div class=\"response-quality-banner\" style=\"background:#c0392b;color:#ffffff;font-weight:700;"
                + "padding:12px 16px;width:100%;box-sizing:border-box;\">"
                + "⚠ THIS REPORT MAY BE BIASED — READ WITH CARE. Your answers on the built-in check questions suggest "
                + "this reading may not fully reflect your typical behaviour. Every direction in this report is provisional, "
                + "and reviewing it with your counsellor is required before acting on any of it.</div>";
    }

    // ── Values lookup (content sheet 4), joined on exact option text ──────────
    public static final List<String> VALUE_TEXTS = List.of(
            "Work that keeps me curious and interested",
            "Work where I keep learning new things",
            "Freedom to decide how I do my work",
            "A steady job I can count on for years",
            "Clear expectations and a predictable routine",
            "Good pay and benefits",
            "Being recognised as good at what I do",
            "Work that my family and community respect",
            "Moving up to positions of greater responsibility",
            "Having influence over decisions that matter",
            "Work that serves something bigger than myself",
            "Work that makes life better for other people");

    private static final Map<String, ValueRow> VALUES = new LinkedHashMap<>();
    static {
        VALUES.put(VALUE_TEXTS.get(0),  new ValueRow("🔍", "Curious, interesting work", "People who choose interest over comfort learn faster and burn out less — interest is renewable fuel."));
        VALUES.put(VALUE_TEXTS.get(1),  new ValueRow("📚", "Keep learning new things", "Careers now reward learning speed over degrees — this value predicts thriving in changing fields."));
        VALUES.put(VALUE_TEXTS.get(2),  new ValueRow("🕊️", "Freedom in how you work", "Autonomy-driven people do their best work with room to choose methods — and chafe under micromanagement."));
        VALUES.put(VALUE_TEXTS.get(3),  new ValueRow("🛡️", "A steady, dependable job", "Stability lets you build long-term skills and plans without churn anxiety."));
        VALUES.put(VALUE_TEXTS.get(4),  new ValueRow("🧭", "Clear expectations, clear routine", "Structure-seekers excel where consistency is the product — operations, QA, compliance."));
        VALUES.put(VALUE_TEXTS.get(5),  new ValueRow("💰", "Good pay and benefits", "Honest and practical — pair it with a growth value so comfort never becomes golden handcuffs."));
        VALUES.put(VALUE_TEXTS.get(6),  new ValueRow("🏅", "Recognition for your skill", "Being seen drives mastery — choose environments that celebrate craft publicly."));
        VALUES.put(VALUE_TEXTS.get(7),  new ValueRow("🏠", "Family and community respect", "This value carries real weight in India — visible standing sustains motivation."));
        VALUES.put(VALUE_TEXTS.get(8),  new ValueRow("📈", "Moving up, taking charge", "Advancement-driven people need ladders — growing organisations feed them."));
        VALUES.put(VALUE_TEXTS.get(9),  new ValueRow("🎯", "Influence over decisions", "Agency-seekers should head toward ownership early — product, projects, entrepreneurship."));
        VALUES.put(VALUE_TEXTS.get(10), new ValueRow("🌉", "Serving something bigger", "Purpose beyond self is the most durable motivator on hard days."));
        VALUES.put(VALUE_TEXTS.get(11), new ValueRow("🤝", "Making life better for others", "Impact-driven engineers thrive where the user is visible."));
    }

    /** Exact (trimmed, whitespace-collapsed, case-sensitive) join on the option text. */
    public static Optional<ValueRow> value(String optionText) {
        if (optionText == null) return Optional.empty();
        return Optional.ofNullable(VALUES.get(optionText.trim().replaceAll("\\s+", " ")));
    }
}
