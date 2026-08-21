package com.kccitm.api.controller;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.AuthProvider;
import com.kccitm.api.model.RoleGroup;
import com.kccitm.api.model.User;
import com.kccitm.api.model.UserRoleGroupMapping;
import com.kccitm.api.repository.RoleGroupRepository;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.UserRoleGroupMappingRepository;
import com.kccitm.api.security.CurrentUser;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.security.audit.SensitiveOp;
import com.kccitm.api.service.GoogleAPIAdmin;

@RestController
public class UserRoleGroupMappingController {

	@Autowired
	private UserRoleGroupMappingRepository userRoleGroupMappingRepository;

	@Autowired
	GoogleAPIAdmin googleAPIAdmin;

	@Autowired
	UserRepository userRepository;

	@Autowired
	private RoleGroupRepository roleGroupRepository;

	@PreAuthorize("@auth.allows('user_role_group_mapping.read.all')")
	@GetMapping(value = "userrolegroupmapping/get", headers = "Accept=application/json")
	public List<UserRoleGroupMapping> getAllRoles() {
		List<UserRoleGroupMapping> allUserroleGroupMapping = userRoleGroupMappingRepository.findByDisplay(true);
		return allUserroleGroupMapping;
	}

	/**
	 * Replaces a user's role-group mappings with a new set. Annotated
	 * {@code @SensitiveOp("role.assign")} per Plan 20-02 Task 2 Step C — every
	 * invocation writes one {@code auth_audit} row via
	 * {@link com.kccitm.api.security.audit.SensitiveOpAspect} (ALLOW on success,
	 * DENY on exception).
	 *
	 * <p>Annotation lives on the controller because no
	 * {@code UserRoleGroupMappingService} exists yet — Plan 15-06 (or a
	 * follow-up plan that introduces the service layer) MUST relocate this
	 * annotation to the service method and document the move.
	 */
	@SensitiveOp("role.assign")
	@PreAuthorize("@auth.allows('user_role_group_mapping.update')")
	@PostMapping(value = "userrolegroupmapping/update", headers = "Accept=application/json")
	public List<UserRoleGroupMapping> updateUserRoleGroup(@RequestBody Map<String, UserRoleGroupMapping> inputData) {
		UserRoleGroupMapping r = inputData.get("values");
		// Delta-merge instead of delete-all + recreate: mappings that stay selected
		// keep their row (and therefore their id). user_role_scope rows FK onto the
		// mapping id with ON DELETE CASCADE, so the old wipe-and-recreate silently
		// destroyed every ABAC scope grant each time an admin touched the user's
		// role groups.
		List<UserRoleGroupMapping> existing = userRoleGroupMappingRepository.findByUser(r.getUser());
		java.util.Set<Long> wanted = new java.util.HashSet<>();
		for (int i = 0; i < r.getRoleGroupTemp().size(); i++) {
			wanted.add(((Integer) r.getRoleGroupTemp().get(i)).longValue());
		}
		List<UserRoleGroupMapping> toDelete = new ArrayList<>();
		java.util.Set<Long> present = new java.util.HashSet<>();
		List<UserRoleGroupMapping> toSave = new ArrayList<>();
		for (UserRoleGroupMapping m : existing) {
			Long rgId = m.getRoleGroup() == null ? null : m.getRoleGroup().getId();
			if (rgId != null && wanted.contains(rgId)) {
				present.add(rgId);
				if (!Boolean.TRUE.equals(m.getDisplay())) {
					m.setDisplay(true);
					toSave.add(m);
				}
			} else {
				toDelete.add(m);
			}
		}
		for (Long rgId : wanted) {
			if (present.contains(rgId)) {
				continue;
			}
			Optional<RoleGroup> t1 = roleGroupRepository.findById(rgId);
			if (t1.isPresent()) {
				toSave.add(new UserRoleGroupMapping(true, r.getUser(), t1.get()));
			}
		}
		userRoleGroupMappingRepository.deleteAll(toDelete);
		userRoleGroupMappingRepository.saveAll(toSave);
		return userRoleGroupMappingRepository.findByUser(r.getUser());
	}

	/**
	 * Soft-deletes a single role-group mapping (sets {@code display=false}).
	 * Annotated {@code @SensitiveOp("role.assign")} per Plan 20-02 — the audit
	 * row captures the privileged revocation regardless of success/failure.
	 */
	@SensitiveOp("role.assign")
	@PreAuthorize("@auth.allows('user_role_group_mapping.delete')")
	@GetMapping(value = "userrolegroupmapping/delete/{id}", headers = "Accept=application/json")
	public UserRoleGroupMapping deleteUserRoleGroup(@PathVariable("id") int roleGroupId) {
		UserRoleGroupMapping roleGroup = userRoleGroupMappingRepository.getOne(roleGroupId);
		roleGroup.setDisplay(false);
		UserRoleGroupMapping r = userRoleGroupMappingRepository.save(roleGroup);
		return r;
	}

	@PreAuthorize("@auth.allows('user_role_group_mapping.read')")
	@GetMapping(value = "/userrole/get/{email}", headers = "Accept=application/json")
	public List<User> getUser(@PathVariable("email") String query, @CurrentUser UserPrincipal users)
			throws GeneralSecurityException, IOException {
		List<User> returnUser = new ArrayList<User>();
		List<com.google.api.services.directory.model.User> user = googleAPIAdmin.getUserByName(users, query);
		for (com.google.api.services.directory.model.User usr : user) {
			User usre = userRepository.findByEmail(usr.getPrimaryEmail()) != null
					? userRepository.findByEmail(usr.getPrimaryEmail())
					: new User();
			usre.setGoogleUserData(usr);
			returnUser.add(usre);
		}
		return returnUser;
	}

	/**
	 * Replaces a user's role-group mappings keyed by Google Workspace email.
	 * Also auto-provisions a {@code User} row if one doesn't exist for that
	 * email yet. Annotated {@code @SensitiveOp("role.assign")} per Plan 20-02
	 * — privileged role mutation, audit row written regardless of branch.
	 */
	@SensitiveOp("role.assign")
	@PreAuthorize("@auth.allows('user_role_group_mapping.update')")
	@PostMapping(value = "/userrole/update/{email}", headers = "Accept=application/json")
	public List<Integer> updateUserRole(@PathVariable("email") String query,
			@RequestBody Map<String, List<Integer>> inputData,
			@CurrentUser UserPrincipal users)
			throws GeneralSecurityException, IOException {

		List<Integer> urGP = inputData.get("values");
		User usre = userRepository.findByEmail(query) != null
				? userRepository.findByEmail(query)
				: new User();
		if (usre.getId() == null) {
			List<com.google.api.services.directory.model.User> user = googleAPIAdmin.getUserByEmail(users, query);
			usre.setDisplay(true);
			usre.setName(user.get(0).getName().getFullName());
			usre.setProvider(AuthProvider.google);
			usre.setProviderId(user.get(0).getId());
			usre.setEmail(user.get(0).getPrimaryEmail());
			usre = userRepository.save(usre);

		}
		// delete role group of users

		userRoleGroupMappingRepository.deleteByUser(usre.getId());

		// add role groups to users
		List<UserRoleGroupMapping> urgm = new ArrayList<UserRoleGroupMapping>();
		for (Integer value : urGP) {
			UserRoleGroupMapping mapping = new UserRoleGroupMapping();
			mapping.setDisplay(true);
			mapping.setUser(usre.getId());
			mapping.setRoleGroup(roleGroupRepository.getById(value.longValue()));
			urgm.add(mapping);
		}
		userRoleGroupMappingRepository.saveAll(urgm);
		return urGP;

	}

	// ═══════════════════════════════════════════════════════════════════════
	// ABAC scope assignment (user_role_scope) — the admin surface that was
	// missing: until now scope rows were only written by provisioning services.
	// ═══════════════════════════════════════════════════════════════════════

	@Autowired
	private com.kccitm.api.repository.UserRoleScopeRepository userRoleScopeRepository;

	@Autowired(required = false)
	private com.kccitm.api.repository.Career9.StudentGroupRepository studentGroupRepository;

	/** JSON shape shared with the FE ScopeRowsEditor: {i,s,c,x,g}, absent = wildcard. */
	public static class ScopeRowDto {
		public Integer i; // institute
		public Integer s; // session
		public Integer c; // course / class
		public Long x;    // section
		public Long g;    // student group
	}

	public static class ScopeUpdateRequest {
		public List<ScopeRowDto> scopes;
	}

	public static class AssignmentDto {
		public Integer mappingId;
		public Long roleGroupId;
		public String roleGroupName;
		public Boolean display;
		public List<ScopeRowDto> scopes = new ArrayList<>();
	}

	/**
	 * All of a user's role-group assignments with their ABAC scope rows — the
	 * read model for the allotment UI (RoleAssignmentsTab / wizard Allot step).
	 */
	@PreAuthorize("@auth.allows('user_role_group_mapping.read')")
	@GetMapping(value = "userrolegroupmapping/user/{userId}", headers = "Accept=application/json")
	public List<AssignmentDto> getAssignmentsForUser(@PathVariable("userId") Long userId) {
		List<AssignmentDto> out = new ArrayList<>();
		for (UserRoleGroupMapping m : userRoleGroupMappingRepository.findByUser(userId)) {
			if (!Boolean.TRUE.equals(m.getDisplay())) {
				continue;
			}
			AssignmentDto dto = new AssignmentDto();
			dto.mappingId = m.getId();
			dto.roleGroupId = m.getRoleGroup() == null ? null : m.getRoleGroup().getId();
			dto.roleGroupName = m.getRoleGroup() == null ? null : m.getRoleGroup().getName();
			dto.display = m.getDisplay();
			for (com.kccitm.api.model.UserRoleScope s : userRoleScopeRepository
					.findByUserRoleGroupMapping_Id(m.getId())) {
				dto.scopes.add(toDto(s));
			}
			out.add(dto);
		}
		return out;
	}

	@PreAuthorize("@auth.allows('user_role_group_mapping.read')")
	@GetMapping(value = "userrolegroupmapping/{mappingId}/scopes", headers = "Accept=application/json")
	public List<ScopeRowDto> getScopes(@PathVariable("mappingId") Integer mappingId) {
		List<ScopeRowDto> out = new ArrayList<>();
		for (com.kccitm.api.model.UserRoleScope s : userRoleScopeRepository
				.findByUserRoleGroupMapping_Id(mappingId)) {
			out.add(toDto(s));
		}
		return out;
	}

	/**
	 * Replace-set write of a mapping's ABAC scope rows.
	 *
	 * <p>Containment rules (mirrors the user_role_scope CHECK constraint and the
	 * service-layer convention documented on {@link com.kccitm.api.model.UserRoleScope}):
	 * session/class require an institute, section requires a class, and a student
	 * group must belong to the row's institute. An empty list is valid — the
	 * assignment falls back to permission-only (wildcard) authorization.
	 *
	 * <p>Hard authorization check runs in the handler body (enforce-independent):
	 * {@code @PreAuthorize} is a no-op while auth.enforce-mode=log-only, and scope
	 * assignment is privilege escalation surface — same pattern as
	 * {@code ImpersonationController}.
	 *
	 * <p>Note on effect timing: scopes ride in the JWT ({@code scopes[]} claim is
	 * authoritative at request time), so a change takes effect on the subject's
	 * next token refresh (≤60 min) or next login.
	 */
	@SensitiveOp("role.assign")
	@PreAuthorize("@auth.allows('role.assign')")
	@org.springframework.web.bind.annotation.PutMapping(value = "userrolegroupmapping/{mappingId}/scopes", headers = "Accept=application/json")
	public org.springframework.http.ResponseEntity<?> updateScopes(
			@PathVariable("mappingId") Integer mappingId,
			@RequestBody ScopeUpdateRequest body,
			@CurrentUser UserPrincipal caller) {

		boolean permitted = caller != null && (caller.isSuperAdmin()
				|| (caller.getPermissions() != null && caller.getPermissions().contains("role.assign")));
		if (!permitted) {
			return org.springframework.http.ResponseEntity.status(403)
					.body(Map.of("message", "role.assign permission required"));
		}

		UserRoleGroupMapping mapping = userRoleGroupMappingRepository.findById(mappingId).orElse(null);
		if (mapping == null) {
			return org.springframework.http.ResponseEntity.status(404)
					.body(Map.of("message", "Role assignment not found"));
		}

		List<ScopeRowDto> rows = body == null || body.scopes == null
				? new ArrayList<>()
				: body.scopes;
		for (int idx = 0; idx < rows.size(); idx++) {
			String err = validateRow(rows.get(idx));
			if (err != null) {
				return org.springframework.http.ResponseEntity.badRequest()
						.body(Map.of("message", "Scope row " + (idx + 1) + ": " + err));
			}
		}

		userRoleScopeRepository.deleteAllByUserRoleGroupMapping_Id(mappingId);
		List<com.kccitm.api.model.UserRoleScope> entities = new ArrayList<>();
		for (ScopeRowDto row : rows) {
			com.kccitm.api.model.UserRoleScope s = new com.kccitm.api.model.UserRoleScope();
			s.setUserRoleGroupMapping(mapping);
			s.setInstituteId(row.i);
			s.setSessionId(row.s);
			s.setCourseCode(row.c);
			s.setSectionId(row.x == null ? null : row.x.intValue());
			s.setGroupId(row.g);
			s.setCreatedAt(java.time.LocalDateTime.now());
			s.setCreatedBy(caller.getId());
			entities.add(s);
		}
		userRoleScopeRepository.saveAll(entities);
		return org.springframework.http.ResponseEntity.ok(getScopes(mappingId));
	}

	private String validateRow(ScopeRowDto row) {
		if (row == null) {
			return "empty row";
		}
		if (row.s != null && row.i == null) {
			return "a session scope requires an institute";
		}
		if (row.c != null && row.i == null) {
			return "a class scope requires an institute";
		}
		if (row.x != null && row.c == null) {
			return "a section scope requires a class";
		}
		if (row.g != null) {
			if (row.i == null) {
				return "a student-group scope requires an institute";
			}
			if (studentGroupRepository == null) {
				return "student groups are not available on this deployment";
			}
			Integer groupInstitute = studentGroupRepository.findById(row.g)
					.map(g -> g.getInstituteCode())
					.orElse(null);
			if (groupInstitute == null) {
				return "student group " + row.g + " does not exist";
			}
			if (!groupInstitute.equals(row.i)) {
				return "student group " + row.g + " belongs to institute " + groupInstitute
						+ ", not " + row.i;
			}
		}
		return null;
	}

	private ScopeRowDto toDto(com.kccitm.api.model.UserRoleScope s) {
		ScopeRowDto dto = new ScopeRowDto();
		dto.i = s.getInstituteId();
		dto.s = s.getSessionId();
		dto.c = s.getCourseCode();
		dto.x = s.getSectionId() == null ? null : s.getSectionId().longValue();
		dto.g = s.getGroupId();
		return dto;
	}

}
