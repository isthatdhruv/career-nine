package com.kccitm.api.repository.reminder;

import java.util.Date;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kccitm.api.model.reminder.ReminderDeliveryLog;
import com.kccitm.api.model.reminder.ReminderDeliveryStatus;
import com.kccitm.api.model.reminder.ReminderServiceType;

public interface ReminderDeliveryLogRepository extends JpaRepository<ReminderDeliveryLog, Long> {

    @Query("select l from ReminderDeliveryLog l " +
           "where (:serviceType is null or l.serviceType = :serviceType) " +
           "  and (:status      is null or l.deliveryStatus = :status) " +
           "  and (:recipient   is null or l.recipient like :recipient) " +
           "  and (:from        is null or l.createdAt >= :from) " +
           "  and (:to          is null or l.createdAt <= :to)")
    Page<ReminderDeliveryLog> search(@Param("serviceType") ReminderServiceType serviceType,
                                     @Param("status") ReminderDeliveryStatus status,
                                     @Param("recipient") String recipientLike,
                                     @Param("from") Date from,
                                     @Param("to") Date to,
                                     Pageable pageable);

    long countByServiceTypeAndRecipientAndDeliveryStatus(ReminderServiceType serviceType,
                                                         String recipient,
                                                         ReminderDeliveryStatus status);

    long countByServiceTypeAndUserStudentIdAndDeliveryStatus(ReminderServiceType serviceType,
                                                             Long userStudentId,
                                                             ReminderDeliveryStatus status);

    @Query("select l.serviceType, l.deliveryStatus, count(l) from ReminderDeliveryLog l " +
           "where (:from is null or l.createdAt >= :from) " +
           "  and (:to   is null or l.createdAt <= :to) " +
           "group by l.serviceType, l.deliveryStatus")
    List<Object[]> aggregateStats(@Param("from") Date from, @Param("to") Date to);

    @Query("select max(l.sentAt) from ReminderDeliveryLog l where l.serviceType = :serviceType")
    Date findLastSentAt(@Param("serviceType") ReminderServiceType serviceType);

    long countByServiceTypeAndSentAtAfter(ReminderServiceType serviceType, Date after);
}
