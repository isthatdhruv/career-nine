package com.kccitm.api.repository.email;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.email.EmailNotificationRecipient;

public interface EmailNotificationRecipientRepository
        extends JpaRepository<EmailNotificationRecipient, Long> {

    /** The dispatch-time lookup — every live recipient for one send-scenario. */
    List<EmailNotificationRecipient> findByEmailTypeAndActiveTrue(String emailType);

    /** The admin list for one scenario, inactive rows included. */
    List<EmailNotificationRecipient> findByEmailTypeOrderByEmailAsc(String emailType);

    List<EmailNotificationRecipient> findAllByOrderByEmailTypeAscEmailAsc();
}
