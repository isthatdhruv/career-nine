package com.kccitm.api.repository.Career9.counselling;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.counselling.CounsellingActivityLog;

@Repository
public interface CounsellingActivityLogRepository extends JpaRepository<CounsellingActivityLog, Long> {

    @Query("SELECT a FROM CounsellingActivityLog a ORDER BY a.createdAt DESC")
    List<CounsellingActivityLog> findAllRecent(Pageable pageable);

    Long countByIsReadFalse();

    @Modifying
    @Transactional
    @Query("UPDATE CounsellingActivityLog a SET a.isRead = true WHERE a.isRead = false")
    void markAllAsRead();
}
