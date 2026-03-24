package com.kccitm.api.repository.Career9.School;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.school.FirebaseDataMapping;

@Repository
public interface FirebaseDataMappingRepository extends JpaRepository<FirebaseDataMapping, Long> {

    List<FirebaseDataMapping> findByFirebaseType(String firebaseType);

    Optional<FirebaseDataMapping> findByFirebaseIdAndFirebaseType(String firebaseId, String firebaseType);

    List<FirebaseDataMapping> findByParentMappingId(Long parentMappingId);

    Optional<FirebaseDataMapping> findByNewEntityIdAndFirebaseType(Long newEntityId, String firebaseType);
}
