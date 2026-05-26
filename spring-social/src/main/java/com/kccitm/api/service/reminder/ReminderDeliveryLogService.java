package com.kccitm.api.service.reminder;

import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.reminder.ReminderDeliveryLog;
import com.kccitm.api.model.reminder.ReminderDeliveryStatus;
import com.kccitm.api.model.reminder.ReminderServiceType;
import com.kccitm.api.repository.reminder.ReminderDeliveryLogRepository;

@Service
public class ReminderDeliveryLogService {

    @Autowired
    private ReminderDeliveryLogRepository repository;

    @Transactional
    public ReminderDeliveryLog save(ReminderDeliveryLog log) {
        return repository.save(log);
    }

    public Page<ReminderDeliveryLog> search(ReminderServiceType type,
                                            ReminderDeliveryStatus status,
                                            String recipient,
                                            Date from,
                                            Date to,
                                            int page,
                                            int size) {
        String like = (recipient == null || recipient.isEmpty()) ? null : "%" + recipient + "%";
        return repository.search(type, status, like, from, to,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
    }

    public ReminderDeliveryLog findById(Long id) {
        return repository.findById(id).orElse(null);
    }

    public long countSentTo(ReminderServiceType type, String recipient) {
        return repository.countByServiceTypeAndRecipientAndDeliveryStatus(type, recipient, ReminderDeliveryStatus.SENT);
    }

    public long countSentToStudent(ReminderServiceType type, Long userStudentId) {
        return repository.countByServiceTypeAndUserStudentIdAndDeliveryStatus(type, userStudentId, ReminderDeliveryStatus.SENT);
    }

    public long countSentSince(ReminderServiceType type, Date since) {
        return repository.countByServiceTypeAndSentAtAfter(type, since);
    }

    public Date lastSentAt(ReminderServiceType type) {
        return repository.findLastSentAt(type);
    }

    /**
     * Aggregate (service_type, status) → count for the given window.
     * Returns a map keyed by service_type name, each value is a map of status → count.
     */
    public Map<String, Map<String, Long>> stats(Date from, Date to) {
        List<Object[]> rows = repository.aggregateStats(from, to);
        Map<String, Map<String, Long>> out = new LinkedHashMap<>();
        for (Object[] row : rows) {
            String svc = ((ReminderServiceType) row[0]).name();
            String st  = ((ReminderDeliveryStatus) row[1]).name();
            Long count = ((Number) row[2]).longValue();
            out.computeIfAbsent(svc, k -> new HashMap<>()).put(st, count);
        }
        return out;
    }
}
