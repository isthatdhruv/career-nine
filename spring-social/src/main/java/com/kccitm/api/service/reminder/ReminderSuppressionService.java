package com.kccitm.api.service.reminder;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.reminder.ReminderServiceType;
import com.kccitm.api.model.reminder.ReminderSuppression;
import com.kccitm.api.repository.reminder.ReminderSuppressionRepository;

@Service
public class ReminderSuppressionService {

    @Autowired
    private ReminderSuppressionRepository repository;

    public boolean isSuppressed(Long userStudentId, ReminderServiceType type) {
        if (userStudentId == null) return false;
        return repository.existsByUserStudentIdAndServiceType(userStudentId, type);
    }

    public Page<ReminderSuppression> list(ReminderServiceType type, int page, int size) {
        return repository.search(type, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "suppressedAt")));
    }

    public List<ReminderSuppression> listForStudent(Long userStudentId) {
        return repository.findByUserStudentId(userStudentId);
    }

    @Transactional
    public ReminderSuppression add(Long userStudentId, ReminderServiceType type, String reason, Long actorUserId) {
        return repository.findByUserStudentIdAndServiceType(userStudentId, type)
                .orElseGet(() -> {
                    ReminderSuppression s = new ReminderSuppression();
                    s.setUserStudentId(userStudentId);
                    s.setServiceType(type);
                    s.setReason(reason);
                    s.setSuppressedBy(actorUserId);
                    return repository.save(s);
                });
    }

    @Transactional
    public void remove(Long id) {
        repository.deleteById(id);
    }
}
