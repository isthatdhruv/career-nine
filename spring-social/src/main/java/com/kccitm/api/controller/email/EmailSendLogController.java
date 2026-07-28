package com.kccitm.api.controller.email;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.email.EmailAccount;
import com.kccitm.api.model.email.EmailSendLog;
import com.kccitm.api.model.email.EmailSendStatus;
import com.kccitm.api.repository.email.EmailAccountRepository;
import com.kccitm.api.repository.email.EmailSendLogRepository;

/** Read-only Email Log API powering the dashboard audit page. */
@RestController
@RequestMapping("/email-logs")
public class EmailSendLogController {

    @Autowired
    private EmailSendLogRepository logRepository;

    @Autowired
    private EmailAccountRepository accountRepository;

    @PreAuthorize("@auth.allows('email_log.read')")
    @GetMapping("")
    public ResponseEntity<?> list(@RequestParam(required = false) String status,
                                  @RequestParam(required = false) String type,
                                  @RequestParam(required = false) String recipient,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "25") int size) {
        EmailSendStatus statusFilter = parseStatus(status);
        String typeFilter = isBlank(type) ? null : type.trim();
        String recipientFilter = isBlank(recipient) ? null : recipient.trim();

        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 200),
                Sort.by(Sort.Direction.DESC, "id"));
        Page<EmailSendLog> result = logRepository.search(statusFilter, typeFilter, recipientFilter, pageable);

        Map<Long, String> accountNames = accountNameMap();
        List<Map<String, Object>> content = new ArrayList<>();
        for (EmailSendLog row : result.getContent()) {
            content.add(toDto(row, accountNames));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("content", content);
        out.put("totalElements", result.getTotalElements());
        out.put("totalPages", result.getTotalPages());
        out.put("page", result.getNumber());
        out.put("size", result.getSize());
        return ResponseEntity.ok(out);
    }

    @PreAuthorize("@auth.allows('email_log.read')")
    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id) {
        return logRepository.findById(id)
                .map(row -> ResponseEntity.ok((Object) toDto(row, accountNameMap())))
                .orElse(ResponseEntity.notFound().build());
    }

    private Map<Long, String> accountNameMap() {
        Map<Long, String> map = new HashMap<>();
        for (EmailAccount a : accountRepository.findAll()) {
            map.put(a.getId(), a.getName());
        }
        return map;
    }

    private Map<String, Object> toDto(EmailSendLog row, Map<Long, String> accountNames) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", row.getId());
        m.put("emailType", row.getEmailType());
        m.put("recipient", row.getRecipient());
        m.put("subject", row.getSubject());
        m.put("accountId", row.getAccountId());
        m.put("accountName", row.getAccountId() != null ? accountNames.get(row.getAccountId()) : null);
        m.put("templateId", row.getTemplateId());
        m.put("instituteCode", row.getInstituteCode());
        m.put("userStudentId", row.getUserStudentId());
        m.put("deliveryMode", row.getDeliveryMode() != null ? row.getDeliveryMode().name() : null);
        m.put("status", row.getStatus() != null ? row.getStatus().name() : null);
        m.put("errorMessage", row.getErrorMessage());
        m.put("createdAt", row.getCreatedAt());
        m.put("sentAt", row.getSentAt());
        return m;
    }

    private EmailSendStatus parseStatus(String status) {
        if (isBlank(status)) {
            return null;
        }
        try {
            return EmailSendStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
