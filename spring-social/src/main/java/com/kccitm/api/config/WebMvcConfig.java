package com.kccitm.api.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.MultipartConfigFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.unit.DataSize;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.kccitm.api.security.AssessmentScopeOwnershipInterceptor;
import com.kccitm.api.security.ScopeFilterInterceptor;

import javax.servlet.MultipartConfigElement;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final long MAX_AGE_SECS = 3600;

    @Value("${app.cors.allowedOrigins}")
    private String[] allowedOrigins;

    @Autowired
    private AssessmentSessionInterceptor sessionInterceptor;

    /**
     * Phase 1 (Task 1.2) — assessment-scoped token IDOR guard. Cross-checks any
     * student/assessment id in the request against the token's own pair so an assessment
     * session cannot read/write another student's data (audit CRIT-C / MED-H).
     */
    @Autowired
    private AssessmentScopeOwnershipInterceptor assessmentScopeOwnershipInterceptor;

    /**
     * Phase 15-06 — Hibernate ABAC row-level scope filter enable/disable.
     * Runs on every request EXCEPT auth-establishment, public marketing, and
     * health/webhook paths where {@link org.springframework.security.core.context.SecurityContextHolder}
     * is empty (or the request is intentionally anonymous).
     */
    @Autowired
    private ScopeFilterInterceptor scopeFilterInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Phase 1 (Task 1.2): assessment-token ownership guard over every assessment-scope path
        // (mirrors ASSESSMENT_SCOPE_PATHS in TokenAuthenticationFilter). No-ops for admin/staff
        // sessions (they carry no assessment attributes); only assessment-scoped tokens are checked.
        registry.addInterceptor(assessmentScopeOwnershipInterceptor)
                .addPathPatterns(
                        "/assessments/**",
                        "/assessment-answer/**",
                        "/student-demographics/**",
                        "/assessment-proctoring/**",
                        "/student-info/**");

        registry.addInterceptor(sessionInterceptor)
                .addPathPatterns("/assessment-answer/**", "/assessments/**")
                .excludePathPatterns(
                        "/assessments/getAll",
                        "/assessments/get/list*",
                        "/assessments/create",
                        "/assessments/update/**",
                        "/assessments/delete/**",
                        "/assessments/prefetch/**",
                        "/assessments/startAssessment"
                );

        // Phase 15-06: ABAC row-level filter interceptor. Auth-establishment
        // endpoints, the public lead-capture form, health/webhook endpoints,
        // and static assets are excluded because SecurityContextHolder is empty
        // there — the filter would no-op anyway, but the exclusion keeps the
        // request-attribute machinery clean.
        registry.addInterceptor(scopeFilterInterceptor)
                .excludePathPatterns(
                        "/auth/**",
                        "/leads/capture",
                        "/heartbeat/**",
                        "/payment/webhook/**",
                        "/campaign/public/**",
                        "/school-registration/public/**",
                        "/static/**",
                        "/actuator/**"
                );
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(MAX_AGE_SECS);
    }

    /**
     * Configure maximum payload size for multipart requests
     * Increases the default limit to handle large assessment submissions
     */
    @Bean
    public MultipartConfigElement multipartConfigElement() {
        MultipartConfigFactory factory = new MultipartConfigFactory();
        factory.setMaxFileSize(DataSize.ofMegabytes(500));
        factory.setMaxRequestSize(DataSize.ofMegabytes(500));
        return factory.createMultipartConfig();
    }
}
