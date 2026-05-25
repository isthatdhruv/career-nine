package com.kccitm.api.service.reminder;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

import javax.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.reminder.ReminderConfig;
import com.kccitm.api.model.reminder.ReminderServiceType;
import com.kccitm.api.repository.reminder.ReminderConfigRepository;

/**
 * Read/write cache for reminder configs. Reads are served from the in-memory
 * cache; writes invalidate the cache entry. Schedulers read on every tick so
 * config changes (enabled toggle, cron change) take effect within one cycle.
 */
@Service
public class ReminderConfigService {

    @Autowired
    private ReminderConfigRepository repository;

    private final Map<ReminderServiceType, AtomicReference<ReminderConfig>> cache = new ConcurrentHashMap<>();

    @PostConstruct
    public void prime() {
        for (ReminderConfig c : repository.findAll()) {
            cache.put(c.getServiceType(), new AtomicReference<>(c));
        }
    }

    public ReminderConfig get(ReminderServiceType type) {
        AtomicReference<ReminderConfig> ref = cache.get(type);
        if (ref != null && ref.get() != null) return ref.get();
        Optional<ReminderConfig> found = repository.findByServiceType(type);
        if (found.isPresent()) {
            cache.computeIfAbsent(type, k -> new AtomicReference<>()).set(found.get());
            return found.get();
        }
        return null;
    }

    public List<ReminderConfig> getAll() {
        List<ReminderConfig> all = new ArrayList<>();
        for (ReminderServiceType type : ReminderServiceType.values()) {
            ReminderConfig c = get(type);
            if (c != null) all.add(c);
        }
        return all;
    }

    public boolean isEnabled(ReminderServiceType type) {
        ReminderConfig c = get(type);
        return c != null && Boolean.TRUE.equals(c.getEnabled());
    }

    public Integer getMaxSendsPerRecipient(ReminderServiceType type) {
        ReminderConfig c = get(type);
        return c == null ? null : c.getMaxSendsPerRecipient();
    }

    public Integer getLeadTimeMinutes(ReminderServiceType type) {
        ReminderConfig c = get(type);
        return c == null ? null : c.getLeadTimeMinutes();
    }

    @Transactional
    public ReminderConfig updateConfig(ReminderServiceType type,
                                       Boolean enabled,
                                       String cronExpression,
                                       Integer leadTimeMinutes,
                                       Integer maxSendsPerRecipient,
                                       Long actorUserId) {
        ReminderConfig c = repository.findByServiceType(type)
                .orElseThrow(() -> new IllegalArgumentException("No reminder config for " + type));
        if (enabled != null) c.setEnabled(enabled);
        if (cronExpression != null && !cronExpression.isEmpty()) c.setCronExpression(cronExpression);
        if (leadTimeMinutes != null) c.setLeadTimeMinutes(leadTimeMinutes);
        if (maxSendsPerRecipient != null) c.setMaxSendsPerRecipient(maxSendsPerRecipient);
        c.setUpdatedAt(new Date());
        c.setUpdatedBy(actorUserId);
        ReminderConfig saved = repository.save(c);
        cache.computeIfAbsent(type, k -> new AtomicReference<>()).set(saved);
        return saved;
    }

    @Transactional
    public ReminderConfig updateTemplate(ReminderServiceType type,
                                         String subject,
                                         String body,
                                         Long actorUserId) {
        ReminderConfig c = repository.findByServiceType(type)
                .orElseThrow(() -> new IllegalArgumentException("No reminder config for " + type));
        if (subject != null) c.setSubjectTemplate(subject);
        if (body != null) c.setBodyTemplate(body);
        c.setUpdatedAt(new Date());
        c.setUpdatedBy(actorUserId);
        ReminderConfig saved = repository.save(c);
        cache.computeIfAbsent(type, k -> new AtomicReference<>()).set(saved);
        return saved;
    }
}
