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
import com.kccitm.api.repository.PermissionRepository;
import com.kccitm.api.repository.RoleRepository;
import com.kccitm.api.security.audit.SensitiveOp;

@RestController
public class RoleController {

	@Autowired
	private RoleRepository roleRepository;

	@Autowired
	private PermissionRepository permissionRepository;

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
	@DeleteMapping("/role/delete/{id}")
    public ResponseEntity<String> deleteRole(@PathVariable Integer id) {
        roleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", id));
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
}
