package com.kccitm.api.controller;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import com.kccitm.api.model.UserRoleGroupMapping;
import com.kccitm.api.model.UserRoleScope;
import com.kccitm.api.model.career9.group.StudentGroup;
import com.kccitm.api.repository.Career9.StudentGroupRepository;
import com.kccitm.api.repository.UserRoleGroupMappingRepository;
import com.kccitm.api.repository.UserRoleScopeRepository;
import com.kccitm.api.security.UserPrincipal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Contract of {@code PUT /userrolegroupmapping/{mappingId}/scopes}:
 * the enforce-independent role.assign hard check, and the containment
 * validation mirroring the user_role_scope CHECK constraint (session/class
 * need an institute, section needs a class, group needs its own institute).
 */
class UserRoleGroupMappingScopeTest {

    private UserRoleGroupMappingController controller;
    private UserRoleGroupMappingRepository mappingRepo;
    private UserRoleScopeRepository scopeRepo;
    private StudentGroupRepository groupRepo;

    @BeforeEach
    void setUp() {
        controller = new UserRoleGroupMappingController();
        mappingRepo = mock(UserRoleGroupMappingRepository.class);
        scopeRepo = mock(UserRoleScopeRepository.class);
        groupRepo = mock(StudentGroupRepository.class);
        ReflectionTestUtils.setField(controller, "userRoleGroupMappingRepository", mappingRepo);
        ReflectionTestUtils.setField(controller, "userRoleScopeRepository", scopeRepo);
        ReflectionTestUtils.setField(controller, "studentGroupRepository", groupRepo);

        UserRoleGroupMapping mapping = new UserRoleGroupMapping();
        mapping.setId(42);
        when(mappingRepo.findById(anyInt())).thenReturn(Optional.of(mapping));
        when(scopeRepo.findByUserRoleGroupMapping_Id(anyInt())).thenReturn(Collections.emptyList());
    }

    private UserPrincipal caller(boolean superAdmin, String... perms) {
        UserPrincipal up = new UserPrincipal(7L, "admin@x", null, null, Collections.emptyList());
        up.setSuperAdmin(superAdmin);
        up.setPermissions(new HashSet<>(Arrays.asList(perms)));
        return up;
    }

    private UserRoleGroupMappingController.ScopeUpdateRequest req(
            UserRoleGroupMappingController.ScopeRowDto... rows) {
        UserRoleGroupMappingController.ScopeUpdateRequest r =
                new UserRoleGroupMappingController.ScopeUpdateRequest();
        r.scopes = Arrays.asList(rows);
        return r;
    }

    private static UserRoleGroupMappingController.ScopeRowDto row(
            Integer i, Integer s, Integer c, Long x, Long g) {
        UserRoleGroupMappingController.ScopeRowDto d = new UserRoleGroupMappingController.ScopeRowDto();
        d.i = i; d.s = s; d.c = c; d.x = x; d.g = g;
        return d;
    }

    @Test
    @DisplayName("caller without role.assign is refused with 403 even though @PreAuthorize is log-only")
    void hardCheckRefusesWithoutPermission() {
        ResponseEntity<?> resp = controller.updateScopes(42, req(), caller(false, "student.read"));
        assertEquals(403, resp.getStatusCodeValue());
    }

    @Test
    @DisplayName("session scope without an institute is a 400")
    void sessionRequiresInstitute() {
        ResponseEntity<?> resp = controller.updateScopes(42,
                req(row(null, 2026, null, null, null)), caller(false, "role.assign"));
        assertEquals(400, resp.getStatusCodeValue());
    }

    @Test
    @DisplayName("section scope without a class is a 400")
    void sectionRequiresClass() {
        ResponseEntity<?> resp = controller.updateScopes(42,
                req(row(1, null, null, 9L, null)), caller(false, "role.assign"));
        assertEquals(400, resp.getStatusCodeValue());
    }

    @Test
    @DisplayName("group belonging to a different institute is a 400")
    void groupMustBelongToRowInstitute() {
        StudentGroup g = mock(StudentGroup.class);
        when(g.getInstituteCode()).thenReturn(99);
        when(groupRepo.findById(anyLong())).thenReturn(Optional.of(g));

        ResponseEntity<?> resp = controller.updateScopes(42,
                req(row(1, null, null, null, 5L)), caller(false, "role.assign"));
        assertEquals(400, resp.getStatusCodeValue());
    }

    @Test
    @DisplayName("valid rows replace the mapping's scope set")
    void validRowsAreSaved() {
        StudentGroup g = mock(StudentGroup.class);
        when(g.getInstituteCode()).thenReturn(1);
        when(groupRepo.findById(anyLong())).thenReturn(Optional.of(g));

        ResponseEntity<?> resp = controller.updateScopes(42,
                req(row(1, null, null, null, 5L), row(null, null, null, null, null)),
                caller(false, "role.assign"));

        assertEquals(200, resp.getStatusCodeValue());
        verify(scopeRepo).deleteAllByUserRoleGroupMapping_Id(42);
        @SuppressWarnings("unchecked")
        Class<List<UserRoleScope>> listClass = (Class<List<UserRoleScope>>) (Class<?>) List.class;
        verify(scopeRepo).saveAll(any(listClass));
    }

    @Test
    @DisplayName("super-admin passes the hard check without holding role.assign")
    void superAdminBypasses() {
        ResponseEntity<?> resp = controller.updateScopes(42, req(), caller(true));
        assertEquals(200, resp.getStatusCodeValue());
    }
}
