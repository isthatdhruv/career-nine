package com.kccitm.api.security;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * Centralized scanner that walks every {@code @RestController} bean, extracts
 * each method's {@code @PreAuthorize("@auth.allows('...')")} literal codes, and
 * builds two views of the result:
 *
 * <ol>
 *   <li>{@link #scanCodesInUse()} — flat set of codes referenced anywhere.</li>
 *   <li>{@link #scanCodeToEndpoints()} — {@code code → ["GET /foo", ...]} so
 *       the admin UI can show which endpoints a permission unlocks.</li>
 * </ol>
 *
 * <p>The existing {@link PermissionCodeValidator} uses a private copy of this
 * pattern at boot time; both now share the same regex and bean-walking logic
 * via this service.
 */
@Service
public class PermissionIntrospectionService {

    /**
     * Quoted literal in {@code @auth.allows('code', ...)} — same shape the
     * validator already enforces. Dynamic expressions ({@code @auth.allows(#x)})
     * are intentionally skipped: we can't see through a variable at scan time.
     */
    private static final Pattern ALLOWS_LITERAL = Pattern.compile("@auth\\.allows\\(\\s*'([^']+)'");

    @Autowired
    private ApplicationContext ctx;

    /** Canonical set of codes defined in {@link PermissionCode}. */
    public Set<String> enumCodes() {
        Set<String> codes = new TreeSet<>();
        for (PermissionCode pc : PermissionCode.values()) {
            codes.add(pc.code());
        }
        return codes;
    }

    /** {@code code → human description} from the enum. */
    public Map<String, String> enumDescriptions() {
        Map<String, String> out = new LinkedHashMap<>();
        for (PermissionCode pc : PermissionCode.values()) {
            out.put(pc.code(), pc.description());
        }
        return out;
    }

    /** All distinct permission codes referenced by live controller annotations. */
    public Set<String> scanCodesInUse() {
        Set<String> codes = new TreeSet<>();
        for (Object bean : ctx.getBeansWithAnnotation(RestController.class).values()) {
            Class<?> cls = AopUtils.getTargetClass(bean);
            for (Method m : cls.getDeclaredMethods()) {
                PreAuthorize pa = m.getAnnotation(PreAuthorize.class);
                if (pa == null) continue;
                Matcher mat = ALLOWS_LITERAL.matcher(pa.value());
                while (mat.find()) codes.add(mat.group(1));
            }
        }
        return codes;
    }

    /**
     * {@code code → ["METHOD /path", ...]} for every endpoint that gates on
     * that code. The path is the concatenation of any class-level
     * {@code @RequestMapping} prefix with the method-level mapping value.
     */
    public Map<String, List<String>> scanCodeToEndpoints() {
        Map<String, Set<String>> bucket = new TreeMap<>();
        for (Object bean : ctx.getBeansWithAnnotation(RestController.class).values()) {
            Class<?> cls = AopUtils.getTargetClass(bean);
            String classPrefix = classRequestMappingPrefix(cls);
            for (Method m : cls.getDeclaredMethods()) {
                PreAuthorize pa = m.getAnnotation(PreAuthorize.class);
                if (pa == null) continue;
                Set<String> codes = new HashSet<>();
                Matcher mat = ALLOWS_LITERAL.matcher(pa.value());
                while (mat.find()) codes.add(mat.group(1));
                if (codes.isEmpty()) continue;

                List<String> labels = methodEndpointLabels(m, classPrefix);
                for (String code : codes) {
                    bucket.computeIfAbsent(code, k -> new TreeSet<>()).addAll(labels);
                }
            }
        }
        // Materialize Sets into List for stable JSON output.
        Map<String, List<String>> out = new LinkedHashMap<>();
        for (Map.Entry<String, Set<String>> e : bucket.entrySet()) {
            out.put(e.getKey(), new ArrayList<>(e.getValue()));
        }
        return out;
    }

    /**
     * Codes that appear in {@link #scanCodesInUse()} but are NOT in
     * {@link #enumCodes()} — these are "orphans": the controller code
     * references them but the enum catalog doesn't recognize them. Used by the
     * Refresh action to refuse a DB write until the developer adds them to
     * {@link PermissionCode}.
     */
    public Set<String> findOrphanCodes() {
        Set<String> inUse = scanCodesInUse();
        Set<String> known = enumCodes();
        Set<String> orphans = new TreeSet<>(inUse);
        orphans.removeAll(known);
        return orphans;
    }

    /**
     * Codes that exist in {@link PermissionCode} but no controller references
     * them. Informational only — these are typically FE-only codes used by
     * {@code <RequirePermission perm="x">} without a matching backend endpoint.
     */
    public Set<String> findUnusedCodes() {
        Set<String> inUse = scanCodesInUse();
        Set<String> known = enumCodes();
        Set<String> unused = new TreeSet<>(known);
        unused.removeAll(inUse);
        return unused;
    }

    // ─── helpers ────────────────────────────────────────────────────────

    private String classRequestMappingPrefix(Class<?> cls) {
        RequestMapping rm = AnnotationUtils.findAnnotation(cls, RequestMapping.class);
        if (rm == null) return "";
        String[] values = rm.value();
        if (values == null || values.length == 0) return "";
        return normalizePath(values[0]);
    }

    /**
     * Build the {@code "METHOD /path"} labels for a controller method. A method
     * can carry multiple mappings (e.g. {@code @GetMapping({"/a","/b"})}) and
     * multiple HTTP verbs (e.g. {@code @RequestMapping(method=GET|POST)}), so
     * we emit one label per (method, path) cross-product.
     */
    private List<String> methodEndpointLabels(Method m, String classPrefix) {
        List<String> labels = new ArrayList<>();
        for (Annotation a : m.getAnnotations()) {
            String[] paths = paths(a);
            String[] methods = methods(a);
            if (paths == null || methods == null) continue;
            String[] effectivePaths = paths.length == 0 ? new String[]{""} : paths;
            String[] effectiveMethods = methods.length == 0 ? new String[]{"ANY"} : methods;
            for (String p : effectivePaths) {
                String full = joinPath(classPrefix, normalizePath(p));
                for (String mt : effectiveMethods) {
                    labels.add(mt + " " + full);
                }
            }
        }
        return labels;
    }

    private String[] paths(Annotation a) {
        if (a instanceof GetMapping) return ((GetMapping) a).value();
        if (a instanceof PostMapping) return ((PostMapping) a).value();
        if (a instanceof PutMapping) return ((PutMapping) a).value();
        if (a instanceof DeleteMapping) return ((DeleteMapping) a).value();
        if (a instanceof PatchMapping) return ((PatchMapping) a).value();
        if (a instanceof RequestMapping) return ((RequestMapping) a).value();
        return null;
    }

    private String[] methods(Annotation a) {
        if (a instanceof GetMapping) return new String[]{"GET"};
        if (a instanceof PostMapping) return new String[]{"POST"};
        if (a instanceof PutMapping) return new String[]{"PUT"};
        if (a instanceof DeleteMapping) return new String[]{"DELETE"};
        if (a instanceof PatchMapping) return new String[]{"PATCH"};
        if (a instanceof RequestMapping) {
            RequestMethod[] rms = ((RequestMapping) a).method();
            if (rms.length == 0) return new String[]{"ANY"};
            String[] out = new String[rms.length];
            for (int i = 0; i < rms.length; i++) out[i] = rms[i].name();
            return out;
        }
        return null;
    }

    private String normalizePath(String p) {
        if (p == null || p.isEmpty()) return "";
        return p.startsWith("/") ? p : "/" + p;
    }

    private String joinPath(String prefix, String suffix) {
        if (prefix.isEmpty()) return suffix.isEmpty() ? "/" : suffix;
        if (suffix.isEmpty()) return prefix;
        return prefix + suffix;
    }

}
