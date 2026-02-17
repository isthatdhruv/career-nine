package com.kccitm.api.security;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import com.kccitm.api.service.UserActivityLogService;

public class TokenAuthenticationFilter extends OncePerRequestFilter {

    @Autowired
    private TokenProvider tokenProvider;

    @Autowired
    private CustomUserDetailsService customUserDetailsService;

    @Autowired(required = false)
    private UserActivityLogService userActivityLogService;

    private static final Logger logger = LoggerFactory.getLogger(TokenAuthenticationFilter.class);

    // URL patterns to skip logging (static assets, activity-log endpoints to avoid recursion)
    private static final List<String> SKIP_LOG_PATTERNS = Arrays.asList(
            "/activity-log/", ".png", ".jpg", ".gif", ".svg", ".css", ".js",
            ".html", ".ico", ".woff", ".woff2", ".ttf", ".map");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String jwt = getJwtFromRequest(request);

            if (StringUtils.hasText(jwt) && tokenProvider.validateToken(jwt)) {
                Long userId = tokenProvider.getUserIdFromToken(jwt);

                UserDetails userDetails = customUserDetailsService.loadUserById(userId);
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authentication);

                // Async URL access logging - fire-and-forget, never blocks the request
                try {
                    if (userActivityLogService != null && shouldLogUrl(request.getRequestURI())) {
                        userActivityLogService.logUrlAccess(userId, request.getRequestURI(), request.getMethod());
                    }
                } catch (Exception logEx) {
                    logger.error("Failed to initiate URL access logging", logEx);
                }
            }
        } catch (Exception ex) {
            logger.error("Could not set user authentication in security context", ex);
        }

        filterChain.doFilter(request, response);
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7, bearerToken.length());
        }
        return null;
    }

    private boolean shouldLogUrl(String uri) {
        if (uri == null) return false;
        String uriLower = uri.toLowerCase();
        for (String pattern : SKIP_LOG_PATTERNS) {
            if (uriLower.contains(pattern)) {
                return false;
            }
        }
        return true;
    }
}
