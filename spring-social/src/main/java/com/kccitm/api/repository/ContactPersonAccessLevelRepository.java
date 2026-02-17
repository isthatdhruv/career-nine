package com.kccitm.api.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.ContactPersonAccessLevel;

@Repository
public interface ContactPersonAccessLevelRepository extends JpaRepository<ContactPersonAccessLevel, Long> {

    List<ContactPersonAccessLevel> findByContactPersonId(Long contactPersonId);

    @Transactional
    void deleteByContactPersonId(Long contactPersonId);
}
