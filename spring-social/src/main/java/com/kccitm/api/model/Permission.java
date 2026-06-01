package com.kccitm.api.model;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;

/**
 * JPA entity for the {@code permission} table created in Plan 14-01
 * (migration V20260511001).
 *
 * <p>Each row corresponds to one {@link com.kccitm.api.security.PermissionCode}
 * enum constant; the table is seeded from the enum in migration V20260511002.
 * Phase 14 only persists this row catalog — no business code reads it yet.
 * Phase 15's {@code AuthorizationService} will look up these rows by code.
 */
@Entity
@Table(name = "permission")
public class Permission implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, unique = true, length = 64)
    private String code;

    @Column(name = "description", length = 255)
    private String description;

    public Permission() { }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
