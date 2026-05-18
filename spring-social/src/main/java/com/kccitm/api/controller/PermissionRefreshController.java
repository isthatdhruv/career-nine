package com.kccitm.api.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.Permission;
import com.kccitm.api.repository.PermissionRepository;
import com.kccitm.api.security.PermissionIntrospectionService;

/**
 * Admin-driven "Refresh Permissions" endpoint. Two modes:
 *
 * <ul>
 *   <li>{@code GET /permission/introspect} — read-only view. Returns the
 *       enum/DB/code-references diff plus the {@code code → endpoints} map so
 *       the picker UI can show "5 endpoints" badges. Does not write.</li>
 *   <li>{@code POST /permission/refresh} — performs the write side. Upserts
 *       enum entries into the {@code permission} table, but ONLY if there are
 *       no orphan codes (controllers referencing codes the enum doesn't
 *       know). Orphans block the write so the developer is forced to add the
 *       enum entry first — keeps the catalog and the code in lockstep.</li>
 * </ul>
 */
@RestController
public class PermissionRefreshController {

    @Autowired
    private PermissionIntrospectionService introspect;

    @Autowired
    private PermissionRepository permissionRepository;

    /**
     * Read-only introspection. Used by the FE on RolesAndPermissionsPage load
     * to populate the per-permission endpoint-list badges in the picker.
     */
    @PreAuthorize("@auth.allows('role.read')")
    @GetMapping("/permission/introspect")
    public ResponseEntity<Map<String, Object>> introspect() {
        return ResponseEntity.ok(buildReport(false));
    }

    /**
     * Refresh the {@code permission} DB table from the {@link com.kccitm.api.security.PermissionCode}
     * enum. The refresh refuses to commit any writes if orphan codes are
     * present — the admin sees the orphan list in the response and must add
     * the enum entries before retrying.
     */
    @PreAuthorize("@auth.allows('permission.refresh')")
    @PostMapping("/permission/refresh")
    @Transactional
    public ResponseEntity<Map<String, Object>> refresh() {
        return ResponseEntity.ok(buildReport(true));
    }

    /**
     * Shared body. When {@code commitWrites} is true and there are no orphans,
     * upserts enum entries into the {@code permission} table. The returned
     * map carries the full diff and the endpoint map so the FE can update its
     * cached view in one round-trip.
     */
    private Map<String, Object> buildReport(boolean commitWrites) {
        Map<String, String> enumDescriptions = introspect.enumDescriptions();
        Set<String> enumCodes = introspect.enumCodes();
        Set<String> inUseCodes = introspect.scanCodesInUse();
        Set<String> orphans = introspect.findOrphanCodes();
        Set<String> unused = introspect.findUnusedCodes();
        Map<String, List<String>> codeToEndpoints = introspect.scanCodeToEndpoints();

        Map<String, String> existingByCode = new HashMap<>();
        for (Permission p : permissionRepository.findAll()) {
            existingByCode.put(p.getCode(), p.getDescription());
        }

        List<String> seeded = new ArrayList<>();    // new DB rows inserted
        List<String> updated = new ArrayList<>();   // description-drift updates
        List<String> committed = new ArrayList<>(); // codes the DB already matched (no-op)

        List<Permission> toSave = new ArrayList<>();
        for (Map.Entry<String, String> e : enumDescriptions.entrySet()) {
            String code = e.getKey();
            String desc = e.getValue();
            if (!existingByCode.containsKey(code)) {
                Permission p = new Permission();
                p.setCode(code);
                p.setDescription(desc);
                toSave.add(p);
                seeded.add(code);
            } else if (desc != null && !desc.equals(existingByCode.get(code))) {
                // Description drifted (enum was updated post-seed). Refresh
                // the row in place so the picker shows the latest label.
                permissionRepository.findByCode(code).ifPresent(p -> {
                    p.setDescription(desc);
                    toSave.add(p);
                    updated.add(code);
                });
            } else {
                committed.add(code);
            }
        }

        boolean wroteToDb = false;
        if (commitWrites && orphans.isEmpty() && !toSave.isEmpty()) {
            permissionRepository.saveAll(toSave);
            wroteToDb = true;
        }

        // ─── Response shape ──────────────────────────────────────────
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totals", totals(enumCodes, inUseCodes, orphans, unused));
        out.put("orphanCodes", new ArrayList<>(orphans));
        out.put("unusedCodes", new ArrayList<>(unused));
        out.put("seeded", seeded);
        out.put("updated", updated);
        out.put("unchanged", committed.size());
        out.put("committed", wroteToDb);
        out.put("refusedDueToOrphans", commitWrites && !orphans.isEmpty());
        out.put("codeToEndpoints", new TreeMap<>(codeToEndpoints));
        return out;
    }

    private Map<String, Object> totals(Set<String> enumCodes, Set<String> inUse,
                                       Set<String> orphans, Set<String> unused) {
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("enumCodes", enumCodes.size());
        t.put("inUseCodes", inUse.size());
        t.put("orphanCodes", orphans.size());
        t.put("unusedCodes", unused.size());
        return t;
    }
}
