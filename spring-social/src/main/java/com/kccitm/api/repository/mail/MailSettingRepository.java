package com.kccitm.api.repository.mail;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.mail.MailSetting;

public interface MailSettingRepository extends JpaRepository<MailSetting, String> {
}
