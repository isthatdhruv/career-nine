package com.kccitm.api.security;

import java.util.ArrayList;
import java.util.List;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.DefaultCsrfToken;
import org.springframework.util.StringUtils;

/**
 * {@link CsrfTokenRepository} variant that tolerates the request carrying more
 * than one cookie with the configured name.
 *
 * <p>Stock {@link CookieCsrfTokenRepository#loadToken(HttpServletRequest)}
 * delegates to {@code WebUtils.getCookie(request, cookieName)}, which returns
 * the FIRST matching cookie regardless of value. That's safe as long as the
 * browser only ever holds one {@code cn_csrf} cookie, which is the happy path.
 * It breaks when the deployment's {@code app.cookie.domain} configuration
 * changes over time (e.g. from unset → {@code career-9.com}), because the
 * browser then holds BOTH a stale host-only cookie AND a fresh Domain-scoped
 * one. Both are sent on every request, and Spring picks the stale one — the
 * {@code X-CSRF-Token} header matches the fresh one — and the request 403s
 * with {@code InvalidCsrfTokenException}.
 *
 * <p>This repository keeps the standard contract for the happy single-cookie
 * case and only diverges when the request carries multiple cookies under the
 * configured name. In that case it scans every value and prefers the one that
 * matches the submitted header / parameter. If the submitted token matches any
 * of the cookies the browser sent, the double-submit invariant still holds:
 * the requester must have had read access to at least one cookie scoped to
 * this site, which a cross-origin attacker by definition cannot.
 *
 * <p>If no submitted token is present, or if none of the cookie values match,
 * falls back to the first cookie (identical to the default), preserving the
 * framework's failure mode.
 *
 * <p>Spring Security 5.5 marks {@link CookieCsrfTokenRepository} as
 * {@code final}, so this class implements {@link CsrfTokenRepository} via
 * composition rather than inheritance. Token generation and persistence
 * (writing the {@code Set-Cookie} response header) are delegated to an inner
 * {@link CookieCsrfTokenRepository}; only {@link #loadToken} is replaced.
 */
public class DuplicateTolerantCsrfTokenRepository implements CsrfTokenRepository {

    private final CookieCsrfTokenRepository delegate;
    private String cookieName = "XSRF-TOKEN";
    private String headerName = "X-XSRF-TOKEN";
    private String parameterName = "_csrf";

    public DuplicateTolerantCsrfTokenRepository() {
        this(new CookieCsrfTokenRepository());
    }

    public DuplicateTolerantCsrfTokenRepository(CookieCsrfTokenRepository delegate) {
        this.delegate = delegate;
    }

    /**
     * Factory mirroring {@link CookieCsrfTokenRepository#withHttpOnlyFalse()}
     * so callers don't have to instantiate the delegate separately. Returns
     * a repository whose Set-Cookie writes set {@code HttpOnly=false}.
     */
    public static DuplicateTolerantCsrfTokenRepository withHttpOnlyFalse() {
        return new DuplicateTolerantCsrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse());
    }

    public void setCookieName(String cookieName) {
        this.cookieName = cookieName;
        delegate.setCookieName(cookieName);
    }

    public void setHeaderName(String headerName) {
        this.headerName = headerName;
        delegate.setHeaderName(headerName);
    }

    public void setParameterName(String parameterName) {
        this.parameterName = parameterName;
        delegate.setParameterName(parameterName);
    }

    public void setCookiePath(String cookiePath) {
        delegate.setCookiePath(cookiePath);
    }

    public void setCookieDomain(String cookieDomain) {
        delegate.setCookieDomain(cookieDomain);
    }

    public void setCookieHttpOnly(boolean cookieHttpOnly) {
        delegate.setCookieHttpOnly(cookieHttpOnly);
    }

    @Override
    public CsrfToken generateToken(HttpServletRequest request) {
        return delegate.generateToken(request);
    }

    @Override
    public void saveToken(CsrfToken token, HttpServletRequest request, HttpServletResponse response) {
        delegate.saveToken(token, request, response);
    }

    @Override
    public CsrfToken loadToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }

        List<String> values = new ArrayList<>(2);
        for (Cookie c : cookies) {
            if (cookieName.equals(c.getName()) && StringUtils.hasText(c.getValue())) {
                values.add(c.getValue());
            }
        }
        if (values.isEmpty()) {
            return null;
        }

        String chosen = values.get(0);
        if (values.size() > 1) {
            String submitted = request.getHeader(headerName);
            if (!StringUtils.hasText(submitted)) {
                submitted = request.getParameter(parameterName);
            }
            if (StringUtils.hasText(submitted)) {
                for (String v : values) {
                    if (submitted.equals(v)) {
                        chosen = v;
                        break;
                    }
                }
            }
        }
        return new DefaultCsrfToken(headerName, parameterName, chosen);
    }
}
