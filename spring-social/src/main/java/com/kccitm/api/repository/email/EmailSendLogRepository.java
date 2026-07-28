package com.kccitm.api.repository.email;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kccitm.api.model.email.EmailSendLog;
import com.kccitm.api.model.email.EmailSendStatus;

public interface EmailSendLogRepository extends JpaRepository<EmailSendLog, Long> {

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
