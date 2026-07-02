package com.kccitm.api.repository.email;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kccitm.api.model.email.InstituteEmailSetting;

public interface InstituteEmailSettingRepository extends JpaRepository<InstituteEmailSetting, Long> {

    Optional<InstituteEmailSetting> findByInstituteCode(Integer instituteCode);

    List<InstituteEmailSetting> findAllByOrderByInstituteCodeAsc();
}
