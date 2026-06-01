package com.kccitm.api.controller;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

import javax.transaction.Transactional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.Role;
import com.kccitm.api.model.RoleGroup;
import com.kccitm.api.model.RoleRoleGroupMapping;
import com.kccitm.api.model.UserRoleGroupMapping;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.PermissionRepository;
import com.kccitm.api.repository.RoleGroupRepository;
import com.kccitm.api.repository.RoleRoleGroupMappingRepository;
import com.kccitm.api.repository.UserRoleGroupMappingRepository;
import com.kccitm.api.security.AuthorizationService;
import com.kccitm.api.security.audit.SensitiveOp;

/**
 * Per-student role-group + permission management for the dashboard's
 * Data Download page (Role Group column + edit modal).
 *
 * <p>The existing {@code UserRoleGroupMappingController} operates by user id only
 * and exposes flat list / replace-all endpoints with no per-student scope
 * authorization. This controller adds a student-shaped surface:
 * {@code /student-info/{userStudentId}/role-groups} GET + PUT plus a small
 * catalog endpoint, all scoped against the student's institute so an admin
 * scoped to one institute cannot read or mutate another tenant's students.
 */
@RestController
@RequestMapping("/student-info")
public class StudentRoleGroupController {

    @Autowired
    private UserStudentRepository userStudentRepository;

    @Autowired
    private UserRoleGroupMappingRepository userRoleGroupMappingRepository;

    @Autowired
    private RoleGroupRepository roleGroupRepository;

    @Autowired
    private RoleRoleGroupMappingRepository roleRoleGroupMappingRepository;

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private AuthorizationService authorizationService;

    /**
     * Returns the role-group set assigned to a student plus the flattened
     * permission codes those role groups confer. Used by the dashboard's
     * Role Group column to populate both the cell label and the edit modal.
     *
     * <p>Authorization runs in two layers: the {@code @PreAuthorize} gate
     * confirms the caller holds {@code user_role_group_mapping.read}, and the
     * in-method {@code authorizationService.allows} check re-authorizes against
     * the PERSISTED institute on the student (preventing IDOR across tenants).
     */
    @PreAuthorize("@auth.allows('user_role_group_mapping.read')")
    @Transactional
    @GetMapping("/{userStudentId}/role-groups")
    public ResponseEntity<?> getRoleGroupsForStudent(@PathVariable("userStudentId") Long userStudentId) {
        Optional<UserStudent> usOpt = userStudentRepository.findById(userStudentId);
        if (!usOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        UserStudent us = usOpt.get();
        Integer instituteCode = us.getInstitute() == null ? null : us.getInstitute().getInstituteCode();
        if (!authorizationService.allows("user_role_group_mapping.read", instituteCode)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Not permitted to read role groups for a student in this institute");
        }
        if (us.getUserId() == null) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Student is not linked to a user account");
        }
        return ResponseEntity.ok(buildPayload(us));
    }

    /**
     * Replaces the student's full role-group set. Body: {@code {"roleGroupIds": [1,2,...]}}.
     * Persists by delete-all-then-re-insert (matches the existing
     * {@code UserRoleGroupMappingController.updateUserRoleGroup} write pattern).
     *
     * <p>Annotated {@code @SensitiveOp("role.assign")} — every invocation writes
     * one row to {@code auth_audit} (ALLOW on success, DENY on exception) so
     * privileged role mutations are auditable.
     */
    @SensitiveOp("role.assign")
    @PreAuthorize("@auth.allows('user_role_group_mapping.update')")
    @Transactional
    @PutMapping("/{userStudentId}/role-groups")
    public ResponseEntity<?> replaceRoleGroupsForStudent(
            @PathVariable("userStudentId") Long userStudentId,
            @RequestBody Map<String, List<Long>> body) {
        Optional<UserStudent> usOpt = userStudentRepository.findById(userStudentId);
        if (!usOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        UserStudent us = usOpt.get();
        Integer instituteCode = us.getInstitute() == null ? null : us.getInstitute().getInstituteCode();
        if (!authorizationService.allows("user_role_group_mapping.update", instituteCode)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Not permitted to update role groups for a student in this institute");
        }
        if (us.getUserId() == null) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Student is not linked to a user account");
        }

        List<Long> requestedIds = body == null ? null : body.get("roleGroupIds");
        if (requestedIds == null) {
            return ResponseEntity.badRequest().body("roleGroupIds is required");
        }

        // De-duplicate while preserving caller order; reject ids that don't resolve.
        Set<Long> uniqueIds = new LinkedHashSet<>(requestedIds);
        List<RoleGroup> resolved = new ArrayList<>(uniqueIds.size());
        for (Long id : uniqueIds) {
            if (id == null) continue;
            Optional<RoleGroup> rg = roleGroupRepository.findById(id);
            if (!rg.isPresent()) {
                return ResponseEntity.badRequest().body("Unknown role group id: " + id);
            }
            resolved.add(rg.get());
        }

        userRoleGroupMappingRepository.deleteAllByUser(us.getUserId());
        List<UserRoleGroupMapping> toSave = new ArrayList<>(resolved.size());
        for (RoleGroup rg : resolved) {
            // Constructor sets display=true regardless of the first arg.
            toSave.add(new UserRoleGroupMapping(true, us.getUserId(), rg));
        }
        userRoleGroupMappingRepository.saveAll(toSave);

        return ResponseEntity.ok(buildPayload(us));
    }

    /**
     * Catalog of all role groups available to assign. Scoped to
     * {@code user_role_group_mapping.update} (same gate as the edit endpoint)
     * because the only realistic consumer is the edit modal — anyone allowed
     * to read this is allowed to assign.
     */
    @PreAuthorize("@auth.allows('user_role_group_mapping.update')")
    @GetMapping("/role-groups/catalog")
    public List<Map<String, Object>> getRoleGroupCatalog() {
        List<RoleGroup> groups = roleGroupRepository.findByDisplay(true);
        if (groups == null) {
            return Collections.emptyList();
        }
        List<Map<String, Object>> out = new ArrayList<>(groups.size());
        for (RoleGroup g : groups) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", g.getId());
            row.put("name", g.getName());
            out.add(row);
        }
        return out;
    }

    /**
     * Build the response payload shared by GET and PUT — the student's
     * current role groups, the distinct permission codes each role group
     * confers, and the union of all effective permission codes.
     */
    private Map<String, Object> buildPayload(UserStudent us) {
        Long userId = us.getUserId();
        List<UserRoleGroupMapping> mappings = userRoleGroupMappingRepository.findByUser(userId);
        if (mappings == null) {
            mappings = Collections.emptyList();
        }

        List<Map<String, Object>> roleGroupsOut = new ArrayList<>();
        Set<String> effectiveCodes = new TreeSet<>();

        for (UserRoleGroupMapping m : mappings) {
            if (Boolean.FALSE.equals(m.getDisplay())) continue;
            RoleGroup rg = m.getRoleGroup();
            if (rg == null) continue;

            Set<String> codesForGroup = new TreeSet<>(permissionCodesForRoleGroup(rg.getId()));
            effectiveCodes.addAll(codesForGroup);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("mappingId", m.getId());
            row.put("id", rg.getId());
            row.put("name", rg.getName());
            row.put("permissionCodes", new ArrayList<>(codesForGroup));
            roleGroupsOut.add(row);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("userStudentId", us.getUserStudentId());
        payload.put("userId", userId);
        payload.put("roleGroups", roleGroupsOut);
        payload.put("effectivePermissions", new ArrayList<>(effectiveCodes));
        return payload;
    }

    /**
     * Walks role_group → role_role_group_mapping → role → role_permission to
     * return the distinct permission codes a role group confers. Skips
     * role-mappings flagged {@code display=false} to match the read-time
     * filter used by {@link PermissionRepository#findCodesForUser(Long)}.
     */
    private Set<String> permissionCodesForRoleGroup(Long roleGroupId) {
        if (roleGroupId == null) return Collections.emptySet();
        List<RoleRoleGroupMapping> roleLinks = roleRoleGroupMappingRepository.findByRoleGroup(roleGroupId);
        if (roleLinks == null || roleLinks.isEmpty()) {
            return Collections.emptySet();
        }
        Set<String> codes = new HashSet<>();
        for (RoleRoleGroupMapping link : roleLinks) {
            if (Boolean.FALSE.equals(link.getDisplay())) continue;
            Role role = link.getRole();
            if (role == null) continue;
            List<String> roleCodes = permissionRepository.findCodesByRoleId(role.getId());
            if (roleCodes != null) {
                codes.addAll(roleCodes);
            }
        }
        return codes;
    }
}
