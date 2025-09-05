package com.kccitm.api.model;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.EnumType;
import javax.persistence.Enumerated;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.JoinTable;
import javax.persistence.ManyToMany;
import javax.persistence.OneToMany;
import javax.persistence.Table;
import javax.persistence.Transient;
import javax.validation.constraints.Email;
import javax.validation.constraints.NotNull;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import com.fasterxml.jackson.annotation.JsonIgnore;

/**
 * The persistent class for the student_user database table.
 * 
 */
@Entity
@Table(name = "student_user")
// @NamedQuery(name = "StudentUser.findAll", query = "SELECT s FROM StudentUser
// s")
public class User implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Email
    @Column(nullable = false)
    private String email;

    private String imageUrl;

    @Column(nullable = false)
    private Boolean emailVerified = false;

    @JsonIgnore
    private String password;

    @NotNull
    @Enumerated(EnumType.STRING)
    private AuthProvider provider;

    private String providerId;

    private Boolean display;

    @Column(name = "google_auth_string")
    private String googleAuthString;

    @Transient
    private List<GrantedAuthority> Role;

    // bi-directional many-to-one association to UserRoleGroupMapping
    @OneToMany(mappedBy = "user", fetch = FetchType.EAGER)
    private List<UserRoleGroupMapping> userRoleGroupMappings;

    @ManyToMany
    @JoinTable(
        name = "user_group_mapping",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "group_id")
    )
    private Set<Group> groups = new HashSet<>();


    @Transient
    private List<String> authorityUrls;

    @Transient
    private com.google.api.services.directory.model.User googleUserData;

    public User() {

    }

    public User(Student r) {
        this.name = r.getFirstName() + " " + r.getLastName();
        this.email = r.getOfficialEmailAddress();

    }

    public User(Faculty r) {
        this.name = r.getFirstName()+" "+r.getLastName();
        this.email = r.getOfficialEmailAddress();

    }

    public Boolean getDisplay() {
        return display;
    }

    public void setDisplay(Boolean display) {
        this.display = display;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public Boolean getEmailVerified() {
        return emailVerified;
    }

    public void setEmailVerified(Boolean emailVerified) {
        this.emailVerified = emailVerified;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public AuthProvider getProvider() {
        return provider;
    }

    public void setProvider(AuthProvider provider) {
        this.provider = provider;
    }

    public String getProviderId() {
        return providerId;
    }

    public void setProviderId(String providerId) {
        this.providerId = providerId;
    }

    public List<UserRoleGroupMapping> getUserRoleGroupMappings() {
        return this.userRoleGroupMappings;
    }

    public void setUserRoleGroupMappings(List<UserRoleGroupMapping> userRoleGroupMappings) {
        this.userRoleGroupMappings = userRoleGroupMappings;
    }

    public String getGoogleAuthString() {
        return googleAuthString;
    }

    public void setGoogleAuthString(String googleAuthString) {
        this.googleAuthString = googleAuthString;
    }

    public List<GrantedAuthority> getRole() {
        List<GrantedAuthority> role = new ArrayList<GrantedAuthority>();
        if (this.userRoleGroupMappings != null)
            this.userRoleGroupMappings.stream()
                    .forEach((arg0) -> arg0.getRoleGroup().getRoleRoleGroupMappings().stream()
                            .forEach((agr1) -> role.add(new SimpleGrantedAuthority(agr1.getRole().getName()))));
        return role;
    }

    // public UserRoleGroupMapping addUserRoleGroupMapping(UserRoleGroupMapping
    // userRoleGroupMapping) {
    // getUserRoleGroupMappings().add(userRoleGroupMapping);
    // userRoleGroupMapping.setUser(this);

    // return userRoleGroupMapping;
    // }

    // public UserRoleGroupMapping removeUserRoleGroupMapping(UserRoleGroupMapping
    // userRoleGroupMapping) {
    // getUserRoleGroupMappings().remove(userRoleGroupMapping);
    // userRoleGroupMapping.setUser(null);

    // return userRoleGroupMapping;
    // }

    public Boolean isEmailVerified() {
        return this.emailVerified;
    }

    public Boolean isDisplay() {
        return this.display;
    }

    public void setRole(List<GrantedAuthority> Role) {
        this.Role = Role;
    }

    public List<String> getAuthorityUrls() {
        return this.authorityUrls;
    }

    public void setAuthorityUrls(List<String> authorityUrls) {
        this.authorityUrls = authorityUrls;
    }

    public com.google.api.services.directory.model.User getGoogleUserData() {
        return this.googleUserData;
    }

    public void setGoogleUserData(com.google.api.services.directory.model.User googleUserData) {
        this.googleUserData = googleUserData;
    }
    
public Set<Group> getGroups() {
    return groups;
}
public void setGroups(Set<Group> groups) {
    this.groups = groups;
}
}