package com.kccitm.api.repository;

import com.kccitm.api.model.Owner;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OwnerRepository extends JpaRepository<Owner, Long> {
    
    // Find owners that are linked to an institute (by institute_code)
    List<Owner> findByInstitutes_InstituteCode(int instituteCode);
    
    // Basic lookups
    List<Owner> findByOwnerName(String ownerName);
    Optional<Owner> findByOwnerEmail(String ownerEmail);

    // Convenience
    Owner getOne(Long id);
    Optional<Owner> findById(Long id);
}
