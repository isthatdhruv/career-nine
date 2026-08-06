package com.kccitm.api.repository.career9;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kccitm.api.model.career9.PrincipalDashboardReleaseLog;

public interface PrincipalDashboardReleaseLogRepository
        extends JpaRepository<PrincipalDashboardReleaseLog, Long> {

    /** One run, in the order it happened. */
    List<PrincipalDashboardReleaseLog> findByReleaseIdOrderByIdAsc(String releaseId);

    /**
     * A school's recent activity across every run, newest first.
     *
     * Paged because this grows without bound by design — the log viewer shows a window,
     * not the whole history.
     */
    List<PrincipalDashboardReleaseLog> findByInstituteCodeOrderByIdDesc(
            Long instituteCode, Pageable pageable);

    /**
     * The runs this school has had, newest first, with enough to label each in a picker.
     *
     * Grouped rather than distinct-on-release_id because the viewer needs the start time
     * and the size of each run to name it, and one query beats one per run.
     */
    @Query("SELECT l.releaseId, MIN(l.createdAt), MAX(l.createdAt), COUNT(l) "
            + "FROM PrincipalDashboardReleaseLog l "
            + "WHERE l.instituteCode = :instituteCode "
            + "GROUP BY l.releaseId ORDER BY MIN(l.createdAt) DESC")
    List<Object[]> findReleaseRuns(@Param("instituteCode") Long instituteCode, Pageable pageable);
}
