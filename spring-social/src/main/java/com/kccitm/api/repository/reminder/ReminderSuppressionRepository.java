package com.kccitm.api.repository.reminder;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kccitm.api.model.reminder.ReminderServiceType;
import com.kccitm.api.model.reminder.ReminderSuppression;

public interface ReminderSuppressionRepository extends JpaRepository<ReminderSuppression, Long> {

    Optional<ReminderSuppression> findByUserStudentIdAndServiceType(Long userStudentId,
                                                                    ReminderServiceType serviceType);

    boolean existsByUserStudentIdAndServiceType(Long userStudentId, ReminderServiceType serviceType);

    Page<ReminderSuppression> findByServiceType(ReminderServiceType serviceType, Pageable pageable);

    @Query("select s from ReminderSuppression s where (:serviceType is null or s.serviceType = :serviceType)")
    Page<ReminderSuppression> search(@Param("serviceType") ReminderServiceType serviceType, Pageable pageable);

    List<ReminderSuppression> findByUserStudentId(Long userStudentId);
}
