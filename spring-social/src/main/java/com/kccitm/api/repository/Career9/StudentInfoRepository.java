package com.kccitm.api.repository.Career9;

import java.util.Date;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.StudentInfo;

@Repository
public interface StudentInfoRepository extends JpaRepository<StudentInfo, Long> {

    StudentInfo findByUser(User user);

    List<StudentInfo> findByInstituteId(Integer instituteId);

    List<StudentInfo> findByEmailAndInstituteId(String email, Integer instituteId);

    List<StudentInfo> findByEmail(String email);

    List<StudentInfo> findByStudentDobAndInstituteIdAndStudentClass(Date studentDob, Integer instituteId,
            Integer studentClass);

    List<StudentInfo> findByStudentDobAndInstituteIdAndStudentClassAndNameIgnoreCase(Date studentDob,
            Integer instituteId, Integer studentClass, String name);

    List<StudentInfo> findByNameIgnoreCaseAndStudentDobAndInstituteId(String name, Date studentDob,
            Integer instituteId);

    List<StudentInfo> findByNameIgnoreCaseAndPhoneNumberAndInstituteId(String name, String phoneNumber,
            Integer instituteId);

    List<StudentInfo> findByNameIgnoreCaseAndInstituteId(String name, Integer instituteId);

    List<StudentInfo> findByPhoneNumberAndInstituteId(String phoneNumber, Integer instituteId);

    /**
     * Spotlight-style fuzzy search across the metadata columns of student_info.
     * The Hibernate {@code scopeFilter} on {@link StudentInfo} narrows the
     * result set to institutes the caller is scoped to, so a "global" search is
     * automatically reduced to the caller's allotted institutes without an
     * explicit institute argument.
     *
     * <p>{@code :q} should be passed pre-padded with {@code %} wildcards
     * (caller-side) so the index strategy stays in the controller, not buried
     * in JPQL.
     */
    @Query("SELECT si FROM StudentInfo si WHERE "
            + " LOWER(COALESCE(si.name, ''))             LIKE LOWER(:q) "
            + "OR LOWER(COALESCE(si.email, ''))            LIKE LOWER(:q) "
            + "OR LOWER(COALESCE(si.phoneNumber, ''))      LIKE LOWER(:q) "
            + "OR LOWER(COALESCE(si.schoolRollNumber, '')) LIKE LOWER(:q) "
            + "OR LOWER(COALESCE(si.address, ''))          LIKE LOWER(:q) "
            + "OR LOWER(COALESCE(si.family, ''))           LIKE LOWER(:q) "
            + "OR LOWER(COALESCE(si.schoolBoard, ''))      LIKE LOWER(:q) "
            + "OR LOWER(COALESCE(si.gender, ''))           LIKE LOWER(:q) "
            + "OR CAST(si.controlNumber AS string)         LIKE :q "
            + "OR CAST(si.id              AS string)       LIKE :q "
            + "ORDER BY si.name ASC")
    List<StudentInfo> globalSearch(@Param("q") String q);

    /**
     * Hydrate a fixed set of StudentInfo IDs while still respecting the scope
     * filter — used to fold in matches that came from the demographic table
     * (father name, mother name, etc.) without leaking cross-institute rows.
     */
    @Query("SELECT si FROM StudentInfo si WHERE si.id IN :ids ORDER BY si.name ASC")
    List<StudentInfo> findAllByIdInScoped(@Param("ids") List<Integer> ids);
}
