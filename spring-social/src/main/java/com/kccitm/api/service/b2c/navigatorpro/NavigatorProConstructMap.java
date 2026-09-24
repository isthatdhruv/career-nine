package com.kccitm.api.service.b2c.navigatorpro;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

/**
 * Which measured-quality-type (MQT) names feed each Navigator Pro construct.
 * Loaded once from {@code navigator-pro/mqt-map.yml} (v3 instrument). A question belongs to a
 * construct because its options carry scores under that construct's MQT; nothing
 * is identified by item code or excel header.
 */
@Component
public class NavigatorProConstructMap {

    public static final List<String> FACTOR_KEYS = List.of("f_id", "f_st", "f_ae");
    public static final List<String> FAMILY_KEYS = List.of("fam_r", "fam_i", "fam_a", "fam_s", "fam_e", "fam_c");
    public static final List<String> SUB_KEYS    = List.of("fs_nd", "fs_di", "fs_tp", "fs_ci", "fs_gd");
    public static final List<String> CHECK_KEYS  = List.of("chk_num", "chk_dat", "chk_cau", "chk_src", "chk_spr");
    public static final List<String> DOMAIN_KEYS = List.of("d_sd", "d_da", "d_si", "d_cy", "d_ux", "d_ee",
                                                           "d_pe", "d_md", "d_cs", "d_pc", "d_qt", "d_tb");
    public static final String VALIDITY  = "validity";
    public static final String ATTENTION = "attention";

    public static final class Construct {
        public final String key;
        public final String label;
        public final List<String> mqts;
        public final int questions;
        public final int min;
        public final int max;

        Construct(String key, String label, List<String> mqts, int questions, int min, int max) {
            this.key = key; this.label = label; this.mqts = List.copyOf(mqts);
            this.questions = questions; this.min = min; this.max = max;
        }
    }

    private final Map<String, Construct> byKey = new LinkedHashMap<>();
    private final Map<String, String> keyByMqt = new HashMap<>();
    /** MQT of the unscored aspiration multi-select (v3: "Aspiration"). */
    private String aspirationMqt = "Aspiration";

    public NavigatorProConstructMap() {
        this(NavigatorProConstructMap.class.getResourceAsStream("/navigator-pro/mqt-map.yml"));
    }

    @SuppressWarnings("unchecked")
    NavigatorProConstructMap(InputStream in) {
        if (in == null) {
            throw new IllegalStateException("navigator-pro/mqt-map.yml missing from classpath");
        }
        Object root = new Yaml().load(in);
        Object constructs = root instanceof Map ? ((Map<String, Object>) root).get("constructs") : null;
        if (!(constructs instanceof Map)) {
            throw new IllegalStateException("mqt-map.yml: top-level 'constructs' map missing");
        }
        for (Map.Entry<String, Object> e : ((Map<String, Object>) constructs).entrySet()) {
            Map<String, Object> c = (Map<String, Object>) e.getValue();
            List<String> mqts = (List<String>) c.get("mqts");
            if (mqts == null || mqts.isEmpty()) {
                throw new IllegalStateException("mqt-map.yml: construct " + e.getKey() + " has no mqts");
            }
            Construct cons = new Construct(e.getKey(), String.valueOf(c.get("label")), mqts,
                    ((Number) c.get("questions")).intValue(),
                    ((Number) c.get("min")).intValue(),
                    ((Number) c.get("max")).intValue());
            byKey.put(cons.key, cons);
            for (String m : mqts) {
                String prev = keyByMqt.put(normalize(m), cons.key);
                if (prev != null) {
                    throw new IllegalStateException("mqt-map.yml: MQT '" + m + "' feeds both "
                            + prev + " and " + cons.key);
                }
            }
        }
        Object asp = ((Map<String, Object>) root).get("aspiration");
        if (asp instanceof Map && ((Map<String, Object>) asp).get("mqt") != null) {
            aspirationMqt = String.valueOf(((Map<String, Object>) asp).get("mqt"));
            if (keyByMqt.containsKey(normalize(aspirationMqt))) {
                throw new IllegalStateException("mqt-map.yml: aspiration MQT '" + aspirationMqt + "' is also a scored construct");
            }
        }
        List<String> required = new ArrayList<>(FACTOR_KEYS);
        required.add(VALIDITY);
        required.add(ATTENTION);
        required.addAll(FAMILY_KEYS);
        required.addAll(SUB_KEYS);
        required.addAll(CHECK_KEYS);
        required.addAll(DOMAIN_KEYS);
        for (String k : required) {
            if (!byKey.containsKey(k)) {
                throw new IllegalStateException("mqt-map.yml: construct '" + k + "' missing");
            }
        }
    }

    /** Trim, collapse inner whitespace, lower-case — the only normalisation applied to MQT names. */
    public static String normalize(String name) {
        return name == null ? "" : name.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    /** True when {@code mqtName} is the aspiration multi-select's MQT. */
    public boolean isAspiration(String mqtName) {
        return normalize(aspirationMqt).equals(normalize(mqtName));
    }

    /** Domain key whose label equals {@code text} (case/space-insensitive), e.g. an aspiration option. */
    public Optional<String> domainForLabel(String text) {
        String n = normalize(text);
        for (String k : DOMAIN_KEYS) if (normalize(get(k).label).equals(n)) return Optional.of(k);
        return Optional.empty();
    }

    public Optional<String> constructFor(String mqtName) {
        return Optional.ofNullable(keyByMqt.get(normalize(mqtName)));
    }

    public Construct get(String key) {
        Construct c = byKey.get(key);
        if (c == null) throw new IllegalArgumentException("unknown construct " + key);
        return c;
    }

    public Collection<Construct> all() {
        return Collections.unmodifiableCollection(byKey.values());
    }

    public String label(String key) {
        return get(key).label;
    }
}
