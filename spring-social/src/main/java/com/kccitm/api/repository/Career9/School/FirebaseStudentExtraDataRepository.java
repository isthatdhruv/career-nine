package com.kccitm.api.repository.Career9.School;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.school.FirebaseStudentExtraData;

@Repository
public interface FirebaseStudentExtraDataRepository extends JpaRepository<FirebaseStudentExtraData, Long> {

    List<FirebaseStudentExtraData> findByUserStudentId(Long userStudentId);

    List<FirebaseStudentExtraData> findByFirebaseDocId(String firebaseDocId);

    List<FirebaseStudentExtraData> findByDataType(String dataType);

    void deleteByUserStudentId(Long userStudentId);
}
