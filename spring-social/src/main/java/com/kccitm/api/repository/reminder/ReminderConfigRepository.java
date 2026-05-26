package com.kccitm.api.repository.reminder;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.reminder.ReminderConfig;
import com.kccitm.api.model.reminder.ReminderServiceType;

public interface ReminderConfigRepository extends JpaRepository<ReminderConfig, Long> {
    Optional<ReminderConfig> findByServiceType(ReminderServiceType serviceType);
}
