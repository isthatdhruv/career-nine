package com.kccitm.api.security;

import java.io.IOException;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Echoes {@code Access-Control-Allow-Private-Network: true} on preflight
 * responses when Chrome's PNA check sends
 * {@code Access-Control-Request-Private-Network: true}. Backfills the
 * functionality that {@code CorsConfiguration.setAllowPrivateNetwork()}
 * provides from Spring Framework 5.3.18 onward — this project runs on Spring
 * Framework 5.3.10 (Spring Boot 2.5.5).
 *
 * <p>Registered at {@link Ordered#HIGHEST_PRECEDENCE} so the header is set
 * on the response before Spring Security's {@code CorsFilter} short-circuits
 * the OPTIONS preflight and commits its own headers.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class PrivateNetworkAccessFilter extends OncePerRequestFilter {

    private static final String REQUEST_HEADER = "Access-Control-Request-Private-Network";
    private static final String RESPONSE_HEADER = "Access-Control-Allow-Private-Network";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if ("true".equalsIgnoreCase(request.getHeader(REQUEST_HEADER))) {
            response.setHeader(RESPONSE_HEADER, "true");
        }
        chain.doFilter(request, response);
    }
}
