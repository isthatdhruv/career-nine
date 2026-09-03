package com.kccitm.api.repository.email;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kccitm.api.model.email.EmailSendLog;
import com.kccitm.api.model.email.EmailSendStatus;

public interface EmailSendLogRepository extends JpaRepository<EmailSendLog, Long> {

    /** Per-automation outcome counts for the Automations page: rows of {automationId, status, count}. */
    @Query("select l.automationId, l.status, count(l) from EmailSendLog l where l.automationId is not null group by l.automationId, l.status")
    java.util.List<Object[]> countByAutomationAndStatus();

    @Query("select l.automationId, count(l) from EmailSendLog l where l.automationId is not null and l.status = :status and l.createdAt >= :since group by l.automationId")
    java.util.List<Object[]> countByAutomationSince(@Param("status") EmailSendStatus status, @Param("since") java.util.Date since);

    @Query("select l.automationId, max(l.sentAt) from EmailSendLog l where l.automationId is not null and l.sentAt is not null group by l.automationId")
    java.util.List<Object[]> lastSentByAutomation();

    long countByStatusAndCreatedAtAfter(EmailSendStatus status, java.util.Date after);

    /** Filtered, paged log view for the Email Log page; any filter may be null. */
    @Query("select l from EmailSendLog l where "
            + "(:status is null or l.status = :status) and "
            + "(:emailType is null or l.emailType = :emailType) and "
            + "(:recipient is null or lower(l.recipient) like lower(concat('%', :recipient, '%')))")
    Page<EmailSendLog> search(@Param("status") EmailSendStatus status,
                              @Param("emailType") String emailType,
                              @Param("recipient") String recipient,
                              Pageable pageable);
}
