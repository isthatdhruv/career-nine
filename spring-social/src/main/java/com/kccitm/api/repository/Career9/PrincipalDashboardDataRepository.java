package com.kccitm.api.repository.Career9;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.PrincipalDashboardData;

@Repository
public interface PrincipalDashboardDataRepository extends JpaRepository<PrincipalDashboardData, Long> {

    /**
     * The one lookup the read path uses. Callers must pass a key produced by
     * {@link com.kccitm.api.service.dashboard.principal.ScopeKey} rather than
     * assembling the string themselves.
     */
    Optional<PrincipalDashboardData> findByInstituteCodeAndScopeKey(Long instituteCode, String scopeKey);

    List<PrincipalDashboardData> findByInstituteCodeAndAssessmentId(Long instituteCode, Long assessmentId);

    List<PrincipalDashboardData> findByReleaseId(String releaseId);

    /**
     * The institute-level scopes this school has released, newest first.
     *
     * <p>Lets the dashboard bootstrap from stored data alone: the page has an institute
     * but no assessment, and asking the live computation which assessments exist would
     * reintroduce the recompute the read path is meant to avoid. The first row is the
     * most recent release, and carries the assessmentId every other scope lookup needs.
     */
    @Query("SELECT p FROM PrincipalDashboardData p "
         + "WHERE p.instituteCode = :instituteCode AND p.scopeLevel = 'INSTITUTE' "
         + "AND p.isCurrent = true AND p.generatedAt IS NOT NULL "
         + "ORDER BY p.generatedAt DESC")
    List<PrincipalDashboardData> findInstituteScopesNewestFirst(@Param("instituteCode") Long instituteCode);

    /**
     * Make one assessment the school's live dashboard and clear the others.
     *
     * <p>Ordering by {@code generatedAt} alone answered the wrong question: re-releasing
     * an older assessment would make it live purely because it was regenerated last.
     * A release states which assessment is current instead.
     */
    @Modifying
    @Query("UPDATE PrincipalDashboardData p "
         + "SET p.isCurrent = CASE WHEN p.assessmentId = :assessmentId THEN true ELSE false END "
         + "WHERE p.instituteCode = :instituteCode")
    void markCurrentAssessment(@Param("instituteCode") Long instituteCode,
                               @Param("assessmentId") Long assessmentId);

    /**
     * Whether a release is already in flight for this institute+assessment — the
     * duplicate-click guard behind the Release button.
     */
    @Query("SELECT COUNT(p) FROM PrincipalDashboardData p "
         + "WHERE p.instituteCode = :instituteCode AND p.assessmentId = :assessmentId "
         + "AND p.generationStatus IN ('PENDING','GENERATING')")
    long countInFlight(@Param("instituteCode") Long instituteCode,
                       @Param("assessmentId") Long assessmentId);

    /** Progress for the polling endpoint, without loading the LONGTEXT payloads. */
    @Query("SELECT p.generationStatus, COUNT(p) FROM PrincipalDashboardData p "
         + "WHERE p.releaseId = :releaseId GROUP BY p.generationStatus")
    List<Object[]> countByStatusForRelease(@Param("releaseId") String releaseId);

    /**
     * Why the failed scopes in a release failed.
     *
     * <p>A count of failures on its own is not actionable — "2 failed" gives an admin
     * nothing to do. The stored message usually names the cause outright (a missing
     * API key, a token limit, a timeout), so the dialog can say it instead of sending
     * someone to the server logs.
     */
    @Query("SELECT p.scopeKey, p.errorMessage FROM PrincipalDashboardData p "
         + "WHERE p.releaseId = :releaseId AND p.generationStatus = 'FAILED'")
    List<Object[]> findFailuresForRelease(@Param("releaseId") String releaseId);

    @Modifying
    @Query("DELETE FROM PrincipalDashboardData p "
         + "WHERE p.instituteCode = :instituteCode AND p.assessmentId = :assessmentId")
    void deleteForInstituteAssessment(@Param("instituteCode") Long instituteCode,
                                      @Param("assessmentId") Long assessmentId);
}
