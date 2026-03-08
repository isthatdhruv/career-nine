package com.kccitm.api.repository.Career9;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.UserUrlAccessLog;

@Repository
public interface UserUrlAccessLogRepository extends JpaRepository<UserUrlAccessLog, Long> {

    List<UserUrlAccessLog> findByUserIdAndAccessTimeBetweenOrderByAccessTimeDesc(
            Long userId, LocalDateTime start, LocalDateTime end);
}
