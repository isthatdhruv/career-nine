package com.kccitm.api.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.Permission;
import com.kccitm.api.repository.PermissionRepository;

/**
 * Read-only catalog of permission codes. Used by the role-permission assignment
 * UI to populate the multi-select; the codes themselves are the canonical
 * strings from {@link com.kccitm.api.security.PermissionCode} and live in the
 * {@code permission} table seeded by Flyway.
 */
@RestController
public class PermissionController {

    @Autowired
    private PermissionRepository permissionRepository;

    @PreAuthorize("@auth.allows('role.read')")
    @GetMapping(value = "/permission/getAll", headers = "Accept=application/json")
    public ResponseEntity<List<Permission>> getAll() {
        return ResponseEntity.ok(permissionRepository.findAll(Sort.by("code")));
    }
}
