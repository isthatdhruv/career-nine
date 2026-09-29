package com.kccitm.api.controller.career9.counselling;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import com.kccitm.api.model.career9.counselling.CounsellorInstituteMapping;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.counselling.CounsellorInstituteMappingService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * A counsellor's active institute mappings are the allow-list the offline counselling page
 * trusts, so allocate/deallocate are hard-checked in code (the annotation is log-only).
 */
class CounsellorInstituteMappingGuardTest {

    private CounsellorInstituteMappingService mappingService;
    private CounsellorInstituteMappingController controller;

    @BeforeEach
    void setUp() {
        mappingService = Mockito.mock(CounsellorInstituteMappingService.class);
        controller = new CounsellorInstituteMappingController();
        ReflectionTestUtils.setField(controller, "mappingService", mappingService);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private static void signInWith(boolean superAdmin, String... permissions) {
        UserPrincipal caller = Mockito.mock(UserPrincipal.class);
        when(caller.isSuperAdmin()).thenReturn(superAdmin);
        when(caller.getPermissions()).thenReturn(new HashSet<>(Arrays.asList(permissions)));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(caller, null));
    }

    private static Map<String, Object> body() {
        Map<String, Object> b = new HashMap<>();
        b.put("counsellorId", 10);
        b.put("instituteCode", 101);
        return b;
    }

    @Test
    void counsellorCannotAllocateASchool() {
        signInWith(false, "counsellor_institute_mapping.read", "counsellor.update");
        ResponseEntity<?> resp = controller.allocate(body());
        assertEquals(403, resp.getStatusCodeValue());
        verify(mappingService, never()).allocate(any(), any(), any(), any());
    }

    @Test
    void unauthenticatedCallerCannotAllocate() {
        ResponseEntity<?> resp = controller.allocate(body());
        assertEquals(403, resp.getStatusCodeValue());
        verify(mappingService, never()).allocate(any(), any(), any(), any());
    }

    @Test
    void adminWithCreateAllocates() {
        signInWith(false, "counsellor_institute_mapping.create");
        when(mappingService.allocate(10L, 101, null, null)).thenReturn(new CounsellorInstituteMapping());
        ResponseEntity<?> resp = controller.allocate(body());
        assertEquals(201, resp.getStatusCodeValue());
    }

    @Test
    void counsellorCannotDeallocate() {
        signInWith(false, "counsellor_institute_mapping.create");
        ResponseEntity<?> resp = controller.deallocate(7L);
        assertEquals(403, resp.getStatusCodeValue());
        verify(mappingService, never()).deallocate(anyLong());
    }

    @Test
    void superAdminDeallocates() {
        signInWith(true);
        when(mappingService.deallocate(7L)).thenReturn(new CounsellorInstituteMapping());
        ResponseEntity<?> resp = controller.deallocate(7L);
        assertEquals(200, resp.getStatusCodeValue());
    }
}
