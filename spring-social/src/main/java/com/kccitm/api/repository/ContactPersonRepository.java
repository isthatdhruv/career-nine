package com.kccitm.api.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.ContactPerson;


@Repository
public interface ContactPersonRepository extends JpaRepository<ContactPerson, Long> {

    // Find all contact persons for an institute (by institute_code)
    List<ContactPerson> findByInstitute_InstituteCode(int instituteCode);

    // Convenience: getOne (exists on JpaRepository, but re-declared for clarity)
    ContactPerson getOne(Long id);

    // findById exists in JpaRepository as Optional<T>, but redeclare if you want direct return (not recommended)
    Optional<ContactPerson> findById(Long id);

    // Find all contact person entries for a user (across all institutes)
    List<ContactPerson> findByUserId(Long userId);

    // Find a specific user+institute pair
    Optional<ContactPerson> findByUserIdAndInstitute_InstituteCode(Long userId, int instituteCode);
}
