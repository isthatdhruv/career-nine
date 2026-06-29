package com.kccitm.api.service.email;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.email.EmailAccount;
import com.kccitm.api.model.email.EmailAccountCredentials;
import com.kccitm.api.model.email.EmailAccountForm;
import com.kccitm.api.model.email.EmailProvider;
import com.kccitm.api.model.email.EmailSendResult;
import com.kccitm.api.repository.email.EmailAccountRepository;

/** CRUD + global-default enforcement + test-send for {@link EmailAccount}. */
@Service
public class EmailAccountService {

    @Autowired
    private EmailAccountRepository accountRepository;

    @Autowired
    private EmailDispatchService dispatchService;

    public List<Map<String, Object>> list() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (EmailAccount a : accountRepository.findAllByOrderByNameAsc()) {
            out.add(toDto(a));
        }
        return out;
    }

    public Map<String, Object> get(Long id) {
        return accountRepository.findById(id).map(this::toDto).orElse(null);
    }

    @Transactional
    public Map<String, Object> create(EmailAccountForm form, Long userId) {
        validate(form, true);
        EmailAccount a = new EmailAccount();
        apply(a, form, userId, true);
        a = accountRepository.save(a);
        enforceSingleGlobalDefault(a);
        return toDto(a);
    }

    @Transactional
    public Map<String, Object> update(Long id, EmailAccountForm form, Long userId) {
        EmailAccount a = accountRepository.findById(id).orElse(null);
        if (a == null) {
            return null;
        }
        validate(form, false);
        apply(a, form, userId, false);
        a = accountRepository.save(a);
        enforceSingleGlobalDefault(a);
        return toDto(a);
    }

    @Transactional
    public boolean delete(Long id) {
        if (!accountRepository.existsById(id)) {
            return false;
        }
        accountRepository.deleteById(id);
        return true;
    }

    public EmailSendResult sendTest(Long id, String to) {
        EmailAccount a = accountRepository.findById(id).orElse(null);
        if (a == null) {
            return null;
        }
        return dispatchService.sendTestThroughAccount(a, to);
    }

    // ─── helpers ─────────────────────────────────────────────────────────

    private void validate(EmailAccountForm form, boolean isCreate) {
        if (isCreate) {
            if (form.name == null || form.name.trim().isEmpty()) {
                throw new IllegalArgumentException("name is required");
            }
            if (form.provider == null) {
                throw new IllegalArgumentException("provider is required");
            }
            if (form.fromEmail == null || form.fromEmail.trim().isEmpty()) {
                throw new IllegalArgumentException("fromEmail is required");
            }
        }
    }

    private void apply(EmailAccount a, EmailAccountForm f, Long userId, boolean isCreate) {
        if (f.name != null) {
            a.setName(f.name.trim());
        }
        if (f.provider != null) {
            a.setProvider(f.provider);
        }
        // mode is meaningful only for Gmail; allow null for Odoo.
        a.setMode(f.provider == EmailProvider.ODOO ? null : f.mode);
        if (f.fromEmail != null) {
            a.setFromEmail(f.fromEmail.trim());
        }
        a.setFromName(f.fromName != null && !f.fromName.trim().isEmpty() ? f.fromName.trim() : null);
        if (f.isGlobalDefault != null) {
            a.setIsGlobalDefault(f.isGlobalDefault);
        } else if (isCreate) {
            a.setIsGlobalDefault(false);
        }
        if (f.active != null) {
            a.setActive(f.active);
        } else if (isCreate) {
            a.setActive(true);
        }
        // Only overwrite credentials when the form actually carries them.
        if (f.credentials != null && hasAnyCredential(f.credentials)) {
            a.setCredentials(f.credentials.toJson());
        }
        a.setUpdatedBy(userId);
    }

    /** Ensure at most one active global-default account. */
    private void enforceSingleGlobalDefault(EmailAccount saved) {
        if (!Boolean.TRUE.equals(saved.getIsGlobalDefault())) {
            return;
        }
        for (EmailAccount other : accountRepository.findByIsGlobalDefaultTrue()) {
            if (!other.getId().equals(saved.getId())) {
                other.setIsGlobalDefault(false);
                accountRepository.save(other);
            }
        }
    }

    private boolean hasAnyCredential(EmailAccountCredentials c) {
        return c.isUseClasspathDefault()
                || notBlank(c.getServiceAccountJson()) || notBlank(c.getDelegatedUser())
                || notBlank(c.getSmtpHost()) || c.getSmtpPort() != null
                || notBlank(c.getSmtpUsername()) || notBlank(c.getSmtpPassword())
                || notBlank(c.getOdooUrl()) || notBlank(c.getOdooDatabase())
                || notBlank(c.getOdooUsername()) || notBlank(c.getOdooApiKey());
    }

    private static boolean notBlank(String s) {
        return s != null && !s.trim().isEmpty();
    }

    private Map<String, Object> toDto(EmailAccount a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.getId());
        m.put("name", a.getName());
        m.put("provider", a.getProvider() != null ? a.getProvider().name() : null);
        m.put("mode", a.getMode() != null ? a.getMode().name() : null);
        m.put("fromEmail", a.getFromEmail());
        m.put("fromName", a.getFromName());
        m.put("isGlobalDefault", a.getIsGlobalDefault());
        m.put("active", a.getActive());
        m.put("hasCredentials", notBlank(a.getCredentials()));
        m.put("createdAt", a.getCreatedAt());
        m.put("updatedAt", a.getUpdatedAt());
        return m;
    }
}
