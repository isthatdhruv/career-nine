package com.kccitm.api.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.BeanIds;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.kccitm.api.security.CustomUserDetailsService;
import com.kccitm.api.security.RestAuthenticationEntryPoint;
import com.kccitm.api.security.TokenAuthenticationFilter;
import com.kccitm.api.security.oauth2.CustomOAuth2UserService;
import com.kccitm.api.security.oauth2.HttpCookieOAuth2AuthorizationRequestRepository;
import com.kccitm.api.security.oauth2.OAuth2AuthenticationFailureHandler;
import com.kccitm.api.security.oauth2.OAuth2AuthenticationSuccessHandler;

@Configuration
@EnableWebSecurity
@EnableGlobalMethodSecurity(securedEnabled = true, jsr250Enabled = true, prePostEnabled = true)
public class SecurityConfig extends WebSecurityConfigurerAdapter {

    @Autowired
    private CustomUserDetailsService customUserDetailsService;

    @Autowired
    private CustomOAuth2UserService customOAuth2UserService;

    @Autowired
    private OAuth2AuthenticationSuccessHandler oAuth2AuthenticationSuccessHandler;

    @Autowired
    private OAuth2AuthenticationFailureHandler oAuth2AuthenticationFailureHandler;

    // @Autowired
    // private HttpCookieOAuth2AuthorizationRequestRepository
    // httpCookieOAuth2AuthorizationRequestRepository;

    @Bean
    public TokenAuthenticationFilter tokenAuthenticationFilter() {
        return new TokenAuthenticationFilter();
    }

    /*
     * By default, Spring OAuth2 uses
     * HttpSessionOAuth2AuthorizationRequestRepository to save
     * the authorization request. But, since our service is stateless, we can't save
     * it in
     * the session. We'll save the request in a Base64 encoded cookie instead.
     */
    @Bean
    public HttpCookieOAuth2AuthorizationRequestRepository cookieAuthorizationRequestRepository() {
        return new HttpCookieOAuth2AuthorizationRequestRepository();
    }

    @Override
    public void configure(AuthenticationManagerBuilder authenticationManagerBuilder) throws Exception {
        authenticationManagerBuilder
                .userDetailsService(customUserDetailsService)
                .passwordEncoder(passwordEncoder());
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean(BeanIds.AUTHENTICATION_MANAGER)
    @Override
    public AuthenticationManager authenticationManagerBean() throws Exception {
        return super.authenticationManagerBean();
    }

    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http
                .cors()
                .and()
                .sessionManagement()
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                .and()
                .csrf()
                .disable()
                .formLogin()
                .disable()
                .httpBasic()
                .disable()
                .exceptionHandling()
                .authenticationEntryPoint(new RestAuthenticationEntryPoint())
                .and()
                .authorizeRequests()
                .antMatchers("/",
                        "/error",
                        "/favicon.ico",
                        "/**/*.png",
                        "/**/*.gif",
                        "/**/*.svg",
                        "/**/*.jpg",
                        "/**/*.html",
                        "/**/*.css",
                        "/**/*.js")
                .permitAll()
                .antMatchers("/api/career9/","/api/assessment-questions/*","/api/question-sections/*","/api/question-sections/*/*","/api/assessment-questions/*/*","/api/firebase/*/*","/api/firebase/*" ,"/api/firebase/*","/actuator/*","/auth/**", "/oauth2/callback/google/*", "/oauth2/**", "/user/me", "role/*", "/gender/get",
                        "/category/*", "/board/*",
                        "/rolegroup/*", "/user/*", "/instituteDetail/*", "/role/*", "/instituteBranch/getbybranchid/*",
                        "/instituteBatch/getbyid/*", "/instituteCourse/getbyCollegeId/*",
                        "/instituteBranch/getbyCourseId/*", "/instituteSession/getbyBatchId/*",
                         "/section/get","/tools/*","/question-sections/*","/assesment-questions/*",
                        "/question-sections/getbyid/*","/assesment-questions/getbyid/*","/question-sections/getbycollegeid/*",
                        "/assesment-questions/getbycollegeid/*","/question-sections/getbyinstituteid/*","/assesment-questions/getbyinstituteid/*",
                        "/question-sections/getbybatchid/*","/assesment-questions/getbybatchid/*","/question-sections/getbycourseid/*",
                        "/section/update", "/generate_pdf", "/codingquestion/save", "/testcase/save",
                        "/student/update", "/student/getbyid/*", "/student/get", "/userrolegroupmapping/update",
                        "/util/**", "/util/file-get/getbyname/**", "/util/file-delete/deletebyname/**",
                        "/google-api/**", "/util/file-delete/delete/**", "/codingquestion/*", "/instituteBatch/*",
                        "/instituteBranch/*", "/instituteCourse/*", "/instituteDetail/getbyid/*", "/student/putmarks",
                        "/student/emailChecker", "/email-validation-official",
                        "/email-validation-official-confermation", "/getmarks/*", "/getmarks", "/coding/*","/career/edit/*",
                        "/google-api/email/get/*", "student/get-check","instituteBranchBatchMapping/*","/getmarks","/getmarksArray")
                .permitAll()
                .anyRequest()
                .authenticated()
                .and()
                .oauth2Login()
                .authorizationEndpoint()
                .baseUri("/oauth2/authorize")
                .authorizationRequestRepository(cookieAuthorizationRequestRepository())
                .and()
                .redirectionEndpoint()
                .baseUri("/oauth2/callback/*")
                .and()
                .userInfoEndpoint()
                .userService(customOAuth2UserService)
                .and()
                .successHandler(oAuth2AuthenticationSuccessHandler)
                .failureHandler(oAuth2AuthenticationFailureHandler);

        // Add our custom Token based authentication filter
        http.addFilterBefore(tokenAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class);
    }
}
