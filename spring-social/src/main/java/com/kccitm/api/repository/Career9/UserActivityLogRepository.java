package com.kccitm.api.repository.Career9;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.kccitm.api.model.career9.UserActivityLog;

@Repository
public interface UserActivityLogRepository extends JpaRepository<UserActivityLog, Long> {

    List<UserActivityLog> findByLoginTimeBetweenOrderByLoginTimeDesc(
            LocalDateTime start, LocalDateTime end);

    List<UserActivityLog> findByUserIdAndLoginTimeBetweenOrderByLoginTimeDesc(
            Long userId, LocalDateTime start, LocalDateTime end);
}
