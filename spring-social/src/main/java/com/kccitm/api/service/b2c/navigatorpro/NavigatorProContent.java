package com.kccitm.api.service.b2c.navigatorpro;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Every student-facing sentence of the v3 report, loaded verbatim from
 * {@code navigator-pro/content-v3.json} (generated from NavigatorPro_Backend_Content_v3.xlsx).
 * Nothing student-facing lives in code: the engine only picks rows and fills slots.
 */
public final class NavigatorProContent {

    public static final class ValueRow {
        public final String tag;
        public final String icon;
        public final String option;
        public final String why;

        ValueRow(String tag, String icon, String option, String why) {
            this.tag = tag; this.icon = icon; this.option = option; this.why = why;
        }
    }

    public static final class Zone {
        public final String paragraph, means, first, todo;

        Zone(String paragraph, String means, String first, String todo) {
            this.paragraph = paragraph; this.means = means; this.first = first; this.todo = todo;
        }
    }

    public static final class Pathway {
        public final String pathway, type, firstStep;

        Pathway(String pathway, String type, String firstStep) {
            this.pathway = pathway; this.type = type; this.firstStep = firstStep;
        }
    }

    private static volatile NavigatorProContent defaults;

    /** The classpath copy, loaded once. */
    public static NavigatorProContent defaults() {
        NavigatorProContent c = defaults;
        if (c == null) {
            synchronized (NavigatorProContent.class) {
                if (defaults == null) {
                    defaults = new NavigatorProContent(
                            NavigatorProContent.class.getResourceAsStream("/navigator-pro/content-v3.json"));
                }
                c = defaults;
            }
        }
        return c;
    }

    private final JsonNode root;

    NavigatorProContent(InputStream in) {
        if (in == null) throw new IllegalStateException("navigator-pro/content-v3.json missing from classpath");
        try (InputStream is = in) {
            root = new ObjectMapper().readTree(is);
        } catch (IOException e) {
            throw new IllegalStateException("content-v3.json unreadable: " + e.getMessage(), e);
        }
        for (String section : List.of("static", "factorLines", "zones", "familyBullets", "values",
                "pathways", "projects", "internships", "widerDoors", "templates")) {
            if (!root.has(section)) throw new IllegalStateException("content-v3.json: section '" + section + "' missing");
        }
    }

    public String text(String staticKey) {
        return root.path("static").path(staticKey).asText("");
    }

    public String template(String key) {
        return root.path("templates").path(key).asText("");
    }

    /** Student-facing factor definition (f_id / f_st / f_ae). */
    public String factorLine(String factorKey) {
        return root.path("factorLines").path(factorKey).asText("");
    }

    public Optional<Zone> zone(String zoneName) {
        JsonNode z = root.path("zones").path(zoneName);
        if (z.isMissingNode()) return Optional.empty();
        return Optional.of(new Zone(z.path("paragraph").asText(""), z.path("means").asText(""),
                z.path("first").asText(""), z.path("do").asText("")));
    }

    /** Two bullets for a family display label and band High / Mid / Low. */
    public List<String> familyBullets(String familyLabel, String band) {
        List<String> out = new ArrayList<>();
        root.path("familyBullets").path(familyLabel).path(band).forEach(n -> out.add(n.asText()));
        return out;
    }

    /** Values lookup, joined on the value tag (Tech Spec v3 §7: never on free text). */
    public Optional<ValueRow> value(String tag) {
        if (tag == null) return Optional.empty();
        String want = NavigatorProConstructMap.normalize(tag);
        for (java.util.Iterator<Map.Entry<String, JsonNode>> it = root.path("values").fields(); it.hasNext(); ) {
            Map.Entry<String, JsonNode> e = it.next();
            if (NavigatorProConstructMap.normalize(e.getKey()).equals(want)) {
                JsonNode v = e.getValue();
                return Optional.of(new ValueRow(e.getKey(), v.path("icon").asText(""),
                        v.path("option").asText(""), v.path("why").asText("")));
            }
        }
        return Optional.empty();
    }

    public List<Pathway> pathways(String domainLabel) {
        List<Pathway> out = new ArrayList<>();
        root.path("pathways").path(domainLabel).forEach(n -> out.add(new Pathway(
                n.path("pathway").asText(""), n.path("type").asText(""), n.path("firstStep").asText(""))));
        return Collections.unmodifiableList(out);
    }

    /** Project problem statement by #1 direction and flavour (Build / Design/People / Business/Ops). */
    public String project(String domainLabel, String flavour) {
        return root.path("projects").path(domainLabel).path(flavour).asText("");
    }

    public List<String> internships(String domainLabel) {
        List<String> out = new ArrayList<>();
        root.path("internships").path(domainLabel).forEach(n -> out.add(n.asText()));
        return out;
    }

    /** Track A wider doors for the student's top family (Creative, People-focused, Enterprising, Organized). */
    public List<String> widerDoors(String familyLabel) {
        List<String> out = new ArrayList<>();
        root.path("widerDoors").path(familyLabel).path("doors").forEach(n -> out.add(n.asText()));
        return out;
    }

    public String widerDoorsNote(String familyLabel) {
        return root.path("widerDoors").path(familyLabel).path("note").asText("");
    }

    public boolean hasWiderDoors(String familyLabel) {
        return root.path("widerDoors").has(familyLabel);
    }

    /** Project flavour from the top family (content sheet 6): Build = R/I · Design/People = A/S · Business/Ops = E/C. */
    public static String flavourFor(String familyKey) {
        switch (familyKey) {
            case "fam_r": case "fam_i": return "Build";
            case "fam_a": case "fam_s": return "Design/People";
            default: return "Business/Ops";
        }
    }

    private static final Pattern SLOT = Pattern.compile("\\{([a-z0-9_]+)\\}");

    /**
     * Fills {slot} markers. Any slot left unresolved throws — the v3 resolver aborts the
     * student (R5) rather than printing a placeholder.
     */
    public static String fill(String template, Map<String, String> slots) {
        Matcher m = SLOT.matcher(template);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            String v = slots.get(m.group(1));
            if (v == null) {
                throw new IllegalStateException("unresolved slot {" + m.group(1) + "} in: " + template);
            }
            m.appendReplacement(sb, Matcher.quoteReplacement(v));
        }
        m.appendTail(sb);
        return sb.toString();
    }
}
