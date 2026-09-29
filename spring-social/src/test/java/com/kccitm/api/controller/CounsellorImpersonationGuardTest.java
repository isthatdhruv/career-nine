package com.kccitm.api.controller;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import com.kccitm.api.security.CustomUserDetailsService;
import com.kccitm.api.security.TokenProvider;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.UserActivityLogService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * "Open as Counsellor" is admin-only: {@code counsellor.update} (which every counsellor holds)
 * no longer mints a token, and a counsellor profile linked to a super-admin login cannot be
 * opened at all, since the token would carry the super-admin flag.
 */
class CounsellorImpersonationGuardTest {

    private static final Long COUNSELLOR = 5L;
    private static final Long TARGET_USER = 42L;

    private CounsellorRepository counsellorRepository;
    private CustomUserDetailsService customUserDetailsService;
    private TokenProvider tokenProvider;
    private ImpersonationController controller;

    @BeforeEach
    void setUp() {
        counsellorRepository = Mockito.mock(CounsellorRepository.class);
        customUserDetailsService = Mockito.mock(CustomUserDetailsService.class);
        tokenProvider = Mockito.mock(TokenProvider.class);
        controller = new ImpersonationController(Mockito.mock(UserStudentRepository.class), counsellorRepository,
                customUserDetailsService, tokenProvider, Mockito.mock(UserActivityLogService.class));

        User u = new User();
        u.setId(TARGET_USER);
        Counsellor c = new Counsellor();
        c.setId(COUNSELLOR);
        c.setUser(u);
        when(counsellorRepository.findById(COUNSELLOR)).thenReturn(Optional.of(c));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void signInWith(String... permissions) {
        UserPrincipal caller = Mockito.mock(UserPrincipal.class);
        when(caller.isSuperAdmin()).thenReturn(false);
        when(caller.getId()).thenReturn(1L);
        when(caller.getPermissions()).thenReturn(new HashSet<>(Arrays.asList(permissions)));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(caller, null));
    }

    private UserPrincipal target(boolean superAdmin) {
        UserPrincipal p = Mockito.mock(UserPrincipal.class);
        when(p.getId()).thenReturn(TARGET_USER);
        when(p.isSuperAdmin()).thenReturn(superAdmin);
        when(customUserDetailsService.loadUserById(TARGET_USER)).thenReturn(p);
        when(tokenProvider.createImpersonationToken(p)).thenReturn("minted.jwt");
        return p;
    }

    @Test
    void counsellorUpdateAloneNoLongerMintsAToken() {
        target(false);
        signInWith("counsellor.update", "counsellor.read", "counselling.appointment.update");

        ResponseEntity<?> resp = controller.impersonateCounsellor(COUNSELLOR, new MockHttpServletRequest());

        assertEquals(403, resp.getStatusCodeValue());
        verify(tokenProvider, never()).createImpersonationToken(any());
    }

    @Test
    void counsellorCreateMintsAToken() {
        target(false);
        signInWith("counsellor.create");

        ResponseEntity<?> resp = controller.impersonateCounsellor(COUNSELLOR, new MockHttpServletRequest());

        assertEquals(200, resp.getStatusCodeValue());
        assertEquals("minted.jwt", ((Map<?, ?>) resp.getBody()).get("token"));
    }

    @Test
    void superAdminTargetIsRefused() {
        target(true);
        signInWith("counsellor.create");

        ResponseEntity<?> resp = controller.impersonateCounsellor(COUNSELLOR, new MockHttpServletRequest());

        assertEquals(403, resp.getStatusCodeValue());
        verify(tokenProvider, never()).createImpersonationToken(any());
    }
}
