package com.kccitm.api.service.email;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.email.EmailAccount;
import com.kccitm.api.model.email.InstituteEmailSetting;
import com.kccitm.api.repository.email.EmailAccountRepository;
import com.kccitm.api.repository.email.InstituteEmailSettingRepository;

/**
 * Per-institute default sending-account settings (Phase 2 routing). Exposes CRUD for the
 * admin UI and {@link #resolveDefaultAccountId(Integer)} for the dispatcher's account
 * resolution (manual override → institute default → global default).
 */
@Service
public class InstituteEmailSettingService {

    @Autowired
    private InstituteEmailSettingRepository settingRepository;

    @Autowired
    private EmailAccountRepository accountRepository;

    public List<Map<String, Object>> list() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (InstituteEmailSetting s : settingRepository.findAllByOrderByInstituteCodeAsc()) {
            out.add(toDto(s));
        }
        return out;
    }

    public Map<String, Object> getByInstitute(Integer instituteCode) {
        return settingRepository.findByInstituteCode(instituteCode).map(this::toDto).orElse(null);
    }

    /** The configured default account id for an institute, or null if none/absent. */
    public Long resolveDefaultAccountId(Integer instituteCode) {
        if (instituteCode == null) {
            return null;
        }
        return settingRepository.findByInstituteCode(instituteCode)
                .map(InstituteEmailSetting::getDefaultAccountId)
                .orElse(null);
    }

    /**
     * Upsert the default account for an institute. A null {@code accountId} clears the
     * mapping (the institute falls back to the global default). Validates that the account
     * exists when one is set.
     */
    @Transactional
    public Map<String, Object> setDefault(Integer instituteCode, Long accountId, Long userId) {
        if (instituteCode == null) {
            throw new IllegalArgumentException("instituteCode is required");
        }
        if (accountId != null && !accountRepository.existsById(accountId)) {
            throw new IllegalArgumentException("Unknown email account: " + accountId);
        }
        InstituteEmailSetting s = settingRepository.findByInstituteCode(instituteCode)
                .orElseGet(InstituteEmailSetting::new);
        s.setInstituteCode(instituteCode);
        s.setDefaultAccountId(accountId);
        s.setUpdatedBy(userId);
        s = settingRepository.save(s);
        return toDto(s);
    }

    @Transactional
    public boolean clear(Integer instituteCode) {
        InstituteEmailSetting s = settingRepository.findByInstituteCode(instituteCode).orElse(null);
        if (s == null) {
            return false;
        }
        settingRepository.delete(s);
        return true;
    }

    private Map<String, Object> toDto(InstituteEmailSetting s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("instituteCode", s.getInstituteCode());
        m.put("defaultAccountId", s.getDefaultAccountId());
        m.put("defaultAccountName", accountName(s.getDefaultAccountId()));
        m.put("updatedAt", s.getUpdatedAt());
        return m;
    }

    private String accountName(Long accountId) {
        if (accountId == null) {
            return null;
        }
        return accountRepository.findById(accountId).map(EmailAccount::getName).orElse(null);
    }
}
