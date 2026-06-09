package com.kccitm.api.service.dashboard.insight;

import java.util.ArrayList;
import java.util.List;

/**
 * Stable, versioned, presentation-agnostic contract for a single student's
 * assessment Insight Dashboard.
 *
 * <p>This is the decoupling layer between the scoring engines and the dashboard
 * UI. The engines (Navigator 360 / BET / legacy Navigator) churn frequently; the
 * UI must not. So engines map their rich result into this fixed shape and the
 * frontend renders <em>only</em> this. Bump {@link #SCHEMA_VERSION} on a
 * breaking change so cached snapshots can be invalidated.
 *
 * <p><b>Design:</b> the dashboard is a list of <em>typed widget sections</em>.
 * Every engine reuses the same small widget vocabulary ({@code stat}, {@code radar},
 * {@code bars}, {@code careers}, {@code chips}, {@code flags}); only the
 * <em>section list</em> differs per engine. That yields "same look &amp; feel,
 * different structure per engine" without bespoke UI per assessment, and lets a
 * new engine ship as a backend builder over an unchanged frontend.
 */
public class InsightDashboard {

    /** Bump when the contract changes in a backward-incompatible way. */
    public static final String SCHEMA_VERSION = "insight-v1";

    public String schemaVersion = SCHEMA_VERSION;
    /** Engine code: "pager" | "bet" | "navigator". */
    public String engine;
    /** ISO-8601 build timestamp. */
    public String generatedAt;

    public Student student = new Student();
    public Access access = new Access();
    public List<Section> sections = new ArrayList<>();

    public InsightDashboard() {}

    public InsightDashboard(String engine) {
        this.engine = engine;
    }

    public Section addSection(Section s) {
        if (s != null) {
            sections.add(s);
        }
        return s;
    }

    /**
     * Entitlement/visibility gate for the Insight View. {@code unlocked} is true
     * when the report was admin-released or the student has an active paid
     * entitlement. {@code preview} is true when the payload has been trimmed to a
     * teaser (student audience + locked) — the UI then shows the paywall CTA.
     */
    public static class Access {
        public boolean unlocked = true;
        /** "released" | "purchased" | "locked". */
        public String reason = "released";
        public boolean preview = false;
        /** Call-to-action shown when locked (null when unlocked). */
        public Cta cta;
    }

    /** Minimal paywall call-to-action. Pricing/checkout is resolved by the UI. */
    public static class Cta {
        public String headline;
        public String message;

        public Cta() {}

        public Cta(String headline, String message) {
            this.headline = headline;
            this.message = message;
        }
    }

    /** Student header shown in the dashboard hero. */
    public static class Student {
        public String name;
        public String studentClass;
        public String gradeGroup;    // "6-8" | "9-10" | "11-12" (pager) or null
        public String schoolName;
        public String schoolCity;
    }

    /**
     * One renderable widget. {@code type} drives which frontend component is used;
     * {@code data} is the matching payload (a list of the matching item POJO below).
     */
    public static class Section {
        /** "stat" | "radar" | "bars" | "careers" | "chips" | "flags". */
        public String type;
        public String title;
        public String subtitle;   // optional one-line caption
        public Object data;

        public Section() {}

        public Section(String type, String title, Object data) {
            this.type = type;
            this.title = title;
            this.data = data;
        }

        public Section subtitle(String s) {
            this.subtitle = s;
            return this;
        }
    }

    // ───────────────────── widget item shapes ─────────────────────

    /** A headline metric card (type = "stat"). value is free text so it can hold
     *  a Holland code, a percentage, a level label, etc. */
    public static class Stat {
        public String label;
        public String value;
        public String hint;      // optional sub-caption
        public String accent;    // optional semantic color hint: "primary" | "good" | "warn"

        public Stat() {}

        public Stat(String label, String value, String hint, String accent) {
            this.label = label;
            this.value = value;
            this.hint = hint;
            this.accent = accent;
        }
    }

    /** One axis of a radar/bars chart. value is normalised 0–100 so widgets are
     *  comparable; rawScore/stanine/level carry the underlying detail for tooltips. */
    public static class Axis {
        public String label;
        public double value;     // 0–100 (normPct)
        public Integer rawScore;
        public Integer stanine;  // 1–9
        public String level;     // AbsoluteLevel name, e.g. "HIGH"

        public Axis() {}

        public Axis(String label, double value, Integer rawScore, Integer stanine, String level) {
            this.label = label;
            this.value = value;
            this.rawScore = rawScore;
            this.stanine = stanine;
            this.level = level;
        }
    }

    /** One ranked career match (type = "careers"). */
    public static class Career {
        public String name;
        public int suitability;      // 0–100 (primary sort)
        public int potentialMatch;   // 0–100
        public int valuesMatch;      // 0–100
        public boolean aspiration;   // student listed this as an aspiration
        public List<String> matchedValues = new ArrayList<>();

        public Career() {}
    }

    /** A titled prose block (type = "notes"). title is optional; body is the text.
     *  Used by the narrative engines (BET / legacy Navigator) for interpretive text. */
    public static class Note {
        public String title;
        public String body;

        public Note() {}

        public Note(String title, String body) {
            this.title = title;
            this.body = body;
        }
    }

    /** One ranked list item (type = "list"). label is required; detail optional. */
    public static class ListItem {
        public String label;
        public String detail;

        public ListItem() {}

        public ListItem(String label, String detail) {
            this.label = label;
            this.detail = detail;
        }
    }

    /** A psychometric note/flag (type = "flags"). */
    public static class Flag {
        public String name;
        public String message;
        public String severity;      // "info" | "warning" | "critical"

        public Flag() {}

        public Flag(String name, String message, String severity) {
            this.name = name;
            this.message = message;
            this.severity = severity;
        }
    }
}
