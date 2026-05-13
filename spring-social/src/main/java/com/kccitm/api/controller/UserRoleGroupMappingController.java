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
		ArrayList<UserRoleGroupMapping> rList = new ArrayList<>();
		userRoleGroupMappingRepository.deleteAllByUser(r.getUser());
		for (int i = 0; i < r.getRoleGroupTemp().size(); i++) {
			Integer t = (Integer) r.getRoleGroupTemp().get(i);
			Optional<RoleGroup> t1 = roleGroupRepository.findById((int) t);
			if (t1.isPresent()) {
				RoleGroup rg = t1.get();
				UserRoleGroupMapping urt = new UserRoleGroupMapping(true, r.getUser(), rg);
				rList.add(urt);
			}
		}
		userRoleGroupMappingRepository.saveAll(rList);
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
			mapping.setRoleGroup(roleGroupRepository.getById(value));
			urgm.add(mapping);
		}
		userRoleGroupMappingRepository.saveAll(urgm);
		return urGP;

	}

}
