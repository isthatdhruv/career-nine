package com.kccitm.api.controller;

import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.security.CustomUserDetailsService;
import com.kccitm.api.security.TokenProvider;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.UserActivityLogService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

class ImpersonationControllerTest {

    private UserStudentRepository userStudentRepository;
    private CustomUserDetailsService customUserDetailsService;
    private TokenProvider tokenProvider;
    private UserActivityLogService userActivityLogService;
    private ImpersonationController controller;

    @BeforeEach
    void setup() {
        userStudentRepository = Mockito.mock(UserStudentRepository.class);
        customUserDetailsService = Mockito.mock(CustomUserDetailsService.class);
        tokenProvider = Mockito.mock(TokenProvider.class);
        userActivityLogService = Mockito.mock(UserActivityLogService.class);
        controller = new ImpersonationController(
                userStudentRepository, customUserDetailsService,
                tokenProvider, userActivityLogService);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void authenticateAsSuperAdmin() {
        UserPrincipal caller = Mockito.mock(UserPrincipal.class);
        when(caller.isSuperAdmin()).thenReturn(true);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(caller, null));
    }

    @Test
    void returnsTokenForExistingStudent() {
        authenticateAsSuperAdmin();

        UserStudent us = new UserStudent();
        us.setUserId(42L);
        when(userStudentRepository.findById(7L)).thenReturn(Optional.of(us));

        UserPrincipal principal = Mockito.mock(UserPrincipal.class);
        when(principal.getId()).thenReturn(42L);
        when(principal.getUsername()).thenReturn("stud42");
        when(principal.getEmail()).thenReturn("s42@example.com");
        when(customUserDetailsService.loadUserById(42L)).thenReturn(principal);
        when(tokenProvider.createImpersonationToken(principal)).thenReturn("minted.jwt.token");

        ResponseEntity<?> resp = controller.impersonateStudent(7L, new MockHttpServletRequest());

        assertEquals(200, resp.getStatusCodeValue());
        assertEquals("minted.jwt.token", ((Map<?, ?>) resp.getBody()).get("token"));
    }

    @Test
    void returns404WhenStudentMissing() {
        authenticateAsSuperAdmin();

        when(userStudentRepository.findById(99L)).thenReturn(Optional.empty());
        ResponseEntity<?> resp = controller.impersonateStudent(99L, new MockHttpServletRequest());
        assertEquals(404, resp.getStatusCodeValue());
    }

    @Test
    void returns403WhenCallerLacksPermission() {
        UserStudent us = new UserStudent();
        us.setUserId(42L);
        when(userStudentRepository.findById(7L)).thenReturn(Optional.of(us));

        UserPrincipal caller = Mockito.mock(UserPrincipal.class);
        when(caller.isSuperAdmin()).thenReturn(false);
        when(caller.getPermissions()).thenReturn(Collections.<String>emptySet());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(caller, null));

        ResponseEntity<?> resp = controller.impersonateStudent(7L, new MockHttpServletRequest());

        assertEquals(403, resp.getStatusCodeValue());
        assertFalse(resp.getBody() instanceof Map, "403 response body should not be a token map");
        Mockito.verify(tokenProvider, Mockito.never()).createImpersonationToken(any());
    }
}
