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

    // Basic lookups
    List<ContactPerson> findByName(String name);
    List<ContactPerson> findByEmail(String email);
    List<ContactPerson> findByPhoneNumber(String phoneNumber);
    List<ContactPerson> findByDesignation(String designation);
    List<ContactPerson> findByGender(String gender);

    // Convenience: getOne (exists on JpaRepository, but re-declared for clarity)
    ContactPerson getOne(Long id);

    // findById exists in JpaRepository as Optional<T>, but redeclare if you want direct return (not recommended)
    Optional<ContactPerson> findById(Long id);
}
