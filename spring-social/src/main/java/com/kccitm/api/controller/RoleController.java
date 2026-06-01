package com.kccitm.api.controller;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.exception.ResourceNotFoundException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.Role;
import com.kccitm.api.model.RoleUrl;
import com.kccitm.api.repository.PermissionRepository;
import com.kccitm.api.repository.RoleRepository;
import com.kccitm.api.repository.RoleRoleGroupMappingRepository;
import com.kccitm.api.repository.RoleUrlRepository;
import com.kccitm.api.security.audit.SensitiveOp;

@RestController
public class RoleController {

	@Autowired
	private RoleRepository roleRepository;

	@Autowired
	private PermissionRepository permissionRepository;

	@Autowired
	private RoleUrlRepository roleUrlRepository;

	@Autowired
	private RoleRoleGroupMappingRepository roleRoleGroupMappingRepository;

	@PreAuthorize("@auth.allows('role.read.all')")
	@GetMapping(value = "/role/get", headers = "Accept=application/json")
	public List<Role> getAllRoles() {
		List<Role> roles = roleRepository.findByRole();
		return roles;
	}

	@PreAuthorize("@auth.allows('role.read')")
	@GetMapping(value = "role/getbyid/{id}", headers = "Accept=application/json")
	public Optional<Role> getRoleById(@PathVariable("id") int roleId) {
		Optional<Role> role = roleRepository.findById(roleId);
		return role;
	}

	@PreAuthorize("@auth.allows('role.update')")
	@PutMapping(value = "role/update")
	public List<Role> updateUser(@RequestBody Map<String, Role> inputData) {
		Role r = inputData.get("values");
		;
		roleRepository.save(r);
		return roleRepository.findByName(r.getName());

	}

	// @GetMapping(value = "role/delete/{id}", headers = "Accept=application/json")
	// public Role deleteUser(@PathVariable("id") int roleId) {
	// 	Role role = roleRepository.getOne(roleId);
	// 	role.setDisplay(false);
	// 	Role r = roleRepository.save(role);
	// 	return r;
	// }

	@PreAuthorize("@auth.allows('role.delete')")
	@Transactional
	@DeleteMapping("/role/delete/{id}")
    public ResponseEntity<String> deleteRole(@PathVariable Integer id) {
        roleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", id));

        // Clear dependents before deleting the parent. Order matters: the FKs in
        // role_role_group_mapping and role_url do NOT carry ON DELETE CASCADE, so a
        // direct delete on `role` raises a ConstraintViolationException. role_permission
        // is exempt because its FK was declared with ON DELETE CASCADE in the original
        // V20260511001 migration — MySQL cleans it up for us.
        roleRoleGroupMappingRepository.deleteAllByRoleId(id);
        roleUrlRepository.deleteAllByRoleId(id);
        roleRepository.deleteById(id);

        return ResponseEntity.ok("Role deleted successfully");
    }

    /**
     * Returns the permission codes currently granted to this role. Codes are the
     * canonical strings from {@link com.kccitm.api.security.PermissionCode} — the
     * same values used by {@code @auth.allows(...)} annotations and the frontend
     * {@code can(...)} predicate.
     */
    @PreAuthorize("@auth.allows('role.read')")
    @GetMapping(value = "/role/{id}/permissions", headers = "Accept=application/json")
    public ResponseEntity<List<String>> getRolePermissions(@PathVariable("id") int roleId) {
        roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));
        return ResponseEntity.ok(permissionRepository.findCodesByRoleId(roleId));
    }

    /**
     * Replaces the role's permission grants with the supplied set of codes
     * (idempotent set semantics — duplicates and unknown codes are silently
     * dropped at the DB layer via {@code INSERT IGNORE}). Annotated
     * {@link SensitiveOp} so every change writes an {@code auth_audit} row.
     *
     * <p>Body: {@code { "codes": ["student.read", "student.update", ...] }}.
     */
    @SensitiveOp("permission.grant")
    @PreAuthorize("@auth.allows('permission.grant')")
    @Transactional
    @PutMapping(value = "/role/{id}/permissions", headers = "Accept=application/json")
    public ResponseEntity<List<String>> setRolePermissions(
            @PathVariable("id") int roleId,
            @RequestBody Map<String, List<String>> body) {
        roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));

        List<String> codes = body == null ? null : body.get("codes");
        permissionRepository.deleteAllByRoleId(roleId);
        if (codes != null) {
            // LinkedHashSet preserves admin-provided ordering when echoing back, and
            // dedupes before we hit the DB.
            for (String code : new LinkedHashSet<String>(codes)) {
                if (code == null || code.trim().isEmpty()) continue;
                permissionRepository.insertRolePermissionByCode(roleId, code.trim());
            }
        }
        return ResponseEntity.ok(permissionRepository.findCodesByRoleId(roleId));
    }

    /**
     * Returns the React URL paths whitelisted for this role. A user with this
     * role can navigate to a route iff its path matches one of these entries
     * AND the route's existing permission gate passes (intersection
     * semantics). Paths may be literal, parametric ({@code /x/:id}), or
     * wildcard-suffix ({@code /x/*}). Matching happens client-side.
     */
    @PreAuthorize("@auth.allows('role.read')")
    @GetMapping(value = "/role/{id}/urls", headers = "Accept=application/json")
    public ResponseEntity<List<String>> getRoleUrls(@PathVariable("id") int roleId) {
        roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));
        return ResponseEntity.ok(roleUrlRepository.findPathsByRoleId(roleId));
    }

    /**
     * Replaces the role's URL whitelist with the supplied set of paths
     * (idempotent set semantics — duplicates and blank strings are dropped).
     * Annotated {@link SensitiveOp} so every change writes an
     * {@code auth_audit} row, same as the permission grant flow.
     *
     * <p>Body: {@code { "paths": ["/students/list", "/students/:id", ...] }}.
     */
    @SensitiveOp("role.url.update")
    @PreAuthorize("@auth.allows('role.url.update')")
    @Transactional
    @PutMapping(value = "/role/{id}/urls", headers = "Accept=application/json")
    public ResponseEntity<List<String>> setRoleUrls(
            @PathVariable("id") int roleId,
            @RequestBody Map<String, List<String>> body) {
        roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));

        List<String> paths = body == null ? null : body.get("paths");
        roleUrlRepository.deleteAllByRoleId(roleId);
        if (paths != null) {
            for (String p : new LinkedHashSet<String>(paths)) {
                if (p == null || p.trim().isEmpty()) continue;
                roleUrlRepository.save(new RoleUrl(roleId, p.trim()));
            }
        }
        return ResponseEntity.ok(roleUrlRepository.findPathsByRoleId(roleId));
    }
}
