package com.kccitm.api.security;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;

import com.kccitm.api.model.Student;
import com.kccitm.api.model.User;
import com.kccitm.api.repository.StudentRepository;

public class UserPrincipal implements OAuth2User, UserDetails {

    @Autowired
    private StudentRepository studentRepository;

    private Long id;
    private String email;
    private String password;
    private Collection<? extends GrantedAuthority> authorities;
    private Map<String, Object> attributes;
    private String googleAuthString;
    private Student studnetData;

    public UserPrincipal(Long id, String email, String password, String googleAuthString,
            Collection<? extends GrantedAuthority> authorities) {
        this.id = id;
        this.email = email;
        this.password = password;
        this.authorities = authorities;
        this.googleAuthString = googleAuthString;
    }

    public static UserPrincipal create(User user) {
        List<GrantedAuthority> authorities = Collections.singletonList(new SimpleGrantedAuthority("USER_ME"));

        authorities = user.getRole();
        UserPrincipal usp = new UserPrincipal(
                user.getId(),
                user.getEmail(),
                user.getPassword(),
                user.getGoogleAuthString(),
                authorities);
        return usp;
    }

    public static UserPrincipal create(User user, Map<String, Object> attributes) {
        UserPrincipal userPrincipal = UserPrincipal.create(user);
        userPrincipal.setAttributes(attributes);

        return userPrincipal;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public Map<String, Object> getAttributes() {
        return attributes;
    }

    public void setAttributes(Map<String, Object> attributes) {
        this.attributes = attributes;
    }

    @Override
    public String getName() {
        return String.valueOf(id);
    }

    public void setGoogleAuthString(String googleAuthString) {
        this.googleAuthString = googleAuthString;
    }

    public String getGoogleAuthString() {
        return googleAuthString;
    }

    public Student getStudnetData() {
        try {
            return studentRepository.findByPersonalEmailAddress(this.email).get(0) != null
                    ? studentRepository.findByPersonalEmailAddress(this.email).get(0)
                    : new Student();
        } catch (Exception e) {
            return new Student();
        }
    }

    public void setStudnetData(Student studnetData) {
        this.studnetData = studnetData;
    }
}