package com.kccitm.api.service.mail;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.email.EmailPlaceholder;
import com.kccitm.api.model.email.EmailSendStatus;
import com.kccitm.api.model.email.EmailTemplate;
import com.kccitm.api.model.mail.MailAutomation;
import com.kccitm.api.model.mail.MailAutomationDelivery;
import com.kccitm.api.model.mail.MailAutomationForm;
import com.kccitm.api.model.mail.MailEvent;
import com.kccitm.api.model.mail.MailJob;
import com.kccitm.api.model.mail.MailPredicate;
import com.kccitm.api.model.mail.MailRecipientRole;
import com.kccitm.api.repository.email.EmailSendLogRepository;
import com.kccitm.api.repository.email.EmailTemplateRepository;
import com.kccitm.api.repository.mail.MailAutomationRepository;

/**
 * CRUD, validation and reporting for automations, plus the in-process cache of active ones
 * the engine reads on every event (refreshed every 30 seconds, so MySQL is not on the publish
 * path). Stats come from the send log in three grouped queries when the page loads.
 */
@Service
public class MailAutomationService {

    private static final Logger logger = LoggerFactory.getLogger(MailAutomationService.class);
    private static final long CACHE_TTL_MS = 30_000L;

    @Autowired private MailAutomationRepository repository;
    @Autowired private EmailTemplateRepository templateRepository;
    @Autowired private EmailSendLogRepository logRepository;
    @Autowired private MailAudienceRegistry audiences;
    @Autowired(required = false) private RedisMailQueue queue;

    private volatile List<MailAutomation> activeCache;
    private volatile long cacheAt;

    // ─── engine-facing ────────────────────────────────────────────────────

    public List<MailAutomation> active() {
        List<MailAutomation> c = activeCache;
        if (c != null && System.currentTimeMillis() - cacheAt < CACHE_TTL_MS) return c;
        return reloadActive();
    }

    public synchronized List<MailAutomation> reloadActive() {
        List<MailAutomation> out = new ArrayList<>();
        try {
            for (MailAutomation a : repository.findAll()) {
                if (a.isActive()) out.add(a);
            }
        } catch (Exception e) {
            logger.warn("Could not load automations: {}", e.getMessage());
        }
        activeCache = Collections.unmodifiableList(out);
        cacheAt = System.currentTimeMillis();
        return activeCache;
    }

    public List<MailAutomation> activeFor(MailEvent event) {
        List<MailAutomation> out = new ArrayList<>();
        for (MailAutomation a : active()) {
            if (!a.isScheduled() && a.triggerEventList().contains(event.key())) out.add(a);
        }
        return out;
    }

    public List<MailAutomation> activeScheduled() {
        List<MailAutomation> out = new ArrayList<>();
        for (MailAutomation a : active()) {
            if (a.isScheduled()) out.add(a);
        }
        return out;
    }

    public void invalidate() {
        activeCache = null;
    }

    // ─── admin CRUD ───────────────────────────────────────────────────────

    public List<Map<String, Object>> list() {
        Stats stats = loadStats();
        List<Map<String, Object>> out = new ArrayList<>();
        for (MailAutomation a : repository.findAllByOrderByNameAsc()) {
            out.add(toDto(a, stats));
        }
        return out;
    }

    public Map<String, Object> get(Long id) {
        MailAutomation a = repository.findById(id).orElse(null);
        return a == null ? null : toDto(a, loadStats());
    }

    @Transactional
    public Map<String, Object> create(MailAutomationForm form, Long userId) {
        MailAutomation a = new MailAutomation();
        a.setSeedOrigin("MANUAL");
        apply(a, form, userId);
        validate(a);
        a = repository.save(a);
        invalidate();
        return toDto(a, loadStats());
    }

    @Transactional
    public Map<String, Object> update(Long id, MailAutomationForm form, Long userId) {
        MailAutomation a = repository.findById(id).orElse(null);
        if (a == null) return null;
        apply(a, form, userId);
        validate(a);
        a = repository.save(a);
        invalidate();
        return toDto(a, loadStats());
    }

    @Transactional
    public boolean delete(Long id) {
        if (!repository.existsById(id)) return false;
        repository.deleteById(id);
        invalidate();
        return true;
    }

    @Transactional
    public Map<String, Object> setEnabled(Long id, boolean enabled, Long userId) {
        MailAutomation a = repository.findById(id).orElse(null);
        if (a == null) return null;
        a.setEnabled(enabled);
        a.setUpdatedBy(userId);
        a = repository.save(a);
        invalidate();
        return toDto(a, loadStats());
    }

    @Transactional
    public Map<String, Object> setPaused(Long id, boolean paused, Long userId) {
        MailAutomation a = repository.findById(id).orElse(null);
        if (a == null) return null;
        a.setPaused(paused);
        a.setUpdatedBy(userId);
        a = repository.save(a);
        invalidate();
        return toDto(a, loadStats());
    }

    /** Seed helper: insert only when the key is absent. */
    @Transactional
    public MailAutomation seed(MailAutomation a) {
        if (a.getAutomationKey() != null && repository.existsByAutomationKey(a.getAutomationKey())) {
            return repository.findFirstByAutomationKey(a.getAutomationKey()).orElse(null);
        }
        a.setSeedOrigin("SEED");
        MailAutomation saved = repository.save(a);
        invalidate();
        return saved;
    }

    // ─── catalogue ────────────────────────────────────────────────────────

    public List<Map<String, Object>> events() {
        Map<String, Integer> counts = new HashMap<>();
        for (MailAutomation a : repository.findAll()) {
            for (String k : a.triggerEventList()) counts.merge(k, 1, Integer::sum);
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (MailEvent e : MailEvent.values()) {
            if (e == MailEvent.SCHEDULED) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", e.key());
            m.put("label", e.label());
            m.put("description", e.description());
            m.put("subjectKinds", e.subjectKinds());
            List<Map<String, String>> roles = new ArrayList<>();
            for (MailRecipientRole r : e.roles()) roles.add(kv(r.name(), r.label()));
            m.put("roles", roles);
            List<Map<String, String>> fields = new ArrayList<>();
            for (String f : e.fields()) fields.add(kv(f, placeholderLabel(f)));
            m.put("fields", fields);
            List<Map<String, String>> dates = new ArrayList<>();
            for (String d : e.dateFields()) dates.add(kv(d, humanize(d)));
            m.put("dateFields", dates);
            List<Map<String, String>> preds = new ArrayList<>();
            for (MailPredicate p : e.predicates()) preds.add(kv(p.key(), p.label()));
            m.put("predicates", preds);
            m.put("automationCount", counts.getOrDefault(e.key(), 0));
            out.add(m);
        }
        return out;
    }

    // ─── helpers ──────────────────────────────────────────────────────────

    private void apply(MailAutomation a, MailAutomationForm f, Long userId) {
        if (f.name != null) a.setName(f.name.trim());
        if (f.description != null) a.setDescription(f.description.trim().isEmpty() ? null : f.description.trim());
        if (f.triggerEvents != null) a.setTriggerEvents(MailAutomation.listToCsv(f.triggerEvents));
        if (f.cron != null) a.setCron(f.cron.trim().isEmpty() ? null : f.cron.trim());
        if (f.audienceKey != null) a.setAudienceKey(f.audienceKey.trim().isEmpty() ? null : f.audienceKey.trim());
        if (f.conditions != null) a.setConditions(MailAutomation.listToCsv(f.conditions));
        if (f.delayMinutes != null) a.setDelayMinutes(f.delayMinutes);
        if (f.relativeToField != null) a.setRelativeToField(f.relativeToField.trim().isEmpty() ? null : f.relativeToField.trim());
        if (f.relativeOffsetsMinutes != null) a.setRelativeOffsetsMinutes(MailAutomation.listToCsv(f.relativeOffsetsMinutes));
        if (f.repeatEveryMinutes != null || f.delayMinutes != null || f.relativeToField != null) {
            a.setRepeatEveryMinutes(f.repeatEveryMinutes != null && f.repeatEveryMinutes > 0 ? f.repeatEveryMinutes : null);
        }
        if (f.maxSends != null || f.repeatEveryMinutes != null) {
            a.setMaxSends(f.maxSends != null && f.maxSends > 0 ? f.maxSends : null);
        }
        if (f.templateId != null) {
            a.setTemplateId(f.templateId);
            EmailTemplate t = templateRepository.findById(f.templateId).orElse(null);
            a.setEmailType(t != null ? t.getEmailType() : f.emailType);
        } else if (f.emailType != null) {
            a.setEmailType(f.emailType);
        }
        if (f.recipientRoles != null) {
            List<String> upper = new ArrayList<>();
            for (String r : f.recipientRoles) if (r != null) upper.add(r.trim().toUpperCase());
            a.setRecipientRoles(MailAutomation.listToCsv(upper));
        }
        if (f.extraRecipients != null) a.setExtraRecipients(MailAutomation.listToCsv(f.extraRecipients));
        if (f.cancelOnEvents != null) a.setCancelOnEvents(MailAutomation.listToCsv(f.cancelOnEvents));
        if (f.deliveryMode != null) {
            try {
                a.setDeliveryMode(MailAutomationDelivery.valueOf(f.deliveryMode.trim().toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("deliveryMode must be IMMEDIATE or QUEUED");
            }
        }
        if (f.recheckBeforeSend != null) a.setRecheckBeforeSend(f.recheckBeforeSend);
        if (f.respectQuietHours != null) a.setRespectQuietHours(f.respectQuietHours);
        if (f.channel != null) a.setChannel(f.channel.trim().toUpperCase());
        if (f.scopeInstitutes != null) a.setScopeInstitutes(f.scopeInstitutes.isEmpty() ? null : MailAutomation.listToCsv(f.scopeInstitutes));
        if (f.topic != null) a.setTopic(f.topic.trim().isEmpty() ? null : f.topic.trim());
        if (f.enabled != null) a.setEnabled(f.enabled);
        if (f.paused != null) a.setPaused(f.paused);
        a.setUpdatedBy(userId);
    }

    private void validate(MailAutomation a) {
        EmailTemplate t = a.getTemplateId() == null ? null : templateRepository.findById(a.getTemplateId()).orElse(null);
        MailAutomationValidator.validate(a, t, audiences.byKey(a.getAudienceKey()) != null);
    }

    static final class Stats {
        final Map<Long, Map<String, Long>> byStatus = new HashMap<>();
        final Map<Long, Long> last7d = new HashMap<>();
        final Map<Long, Date> lastSent = new HashMap<>();
        final Map<Long, Long> queued = new HashMap<>();
    }

    private Stats loadStats() {
        Stats s = new Stats();
        try {
            for (Object[] row : logRepository.countByAutomationAndStatus()) {
                Long id = (Long) row[0];
                String status = row[1] instanceof EmailSendStatus ? ((EmailSendStatus) row[1]).name() : String.valueOf(row[1]);
                s.byStatus.computeIfAbsent(id, k -> new HashMap<>()).put(status, ((Number) row[2]).longValue());
            }
            Date since = new Date(System.currentTimeMillis() - 7L * 24 * 3600 * 1000);
            for (Object[] row : logRepository.countByAutomationSince(EmailSendStatus.SENT, since)) {
                s.last7d.put((Long) row[0], ((Number) row[1]).longValue());
            }
            for (Object[] row : logRepository.lastSentByAutomation()) {
                s.lastSent.put((Long) row[0], (Date) row[1]);
            }
        } catch (Exception e) {
            logger.warn("Automation stats unavailable: {}", e.getMessage());
        }
        if (queue != null) {
            try {
                for (MailJob j : queue.listPending(2000)) {
                    if (j.automationId != null) s.queued.merge(j.automationId, 1L, Long::sum);
                }
            } catch (Exception e) {
                logger.debug("Queue counts unavailable: {}", e.getMessage());
            }
        }
        return s;
    }

    private Map<String, Object> toDto(MailAutomation a, Stats stats) {
        EmailTemplate t = a.getTemplateId() == null ? null : templateRepository.findById(a.getTemplateId()).orElse(null);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.getId());
        m.put("automationKey", a.getAutomationKey());
        m.put("name", a.getName());
        m.put("description", a.getDescription());
        m.put("triggerEvents", a.triggerEventList());
        m.put("cron", a.getCron());
        m.put("audienceKey", a.getAudienceKey());
        m.put("conditions", a.conditionList());
        m.put("delayMinutes", a.getDelayMinutes() == null ? 0 : a.getDelayMinutes());
        m.put("relativeToField", a.getRelativeToField());
        m.put("relativeOffsetsMinutes", a.offsetList());
        m.put("repeatEveryMinutes", a.getRepeatEveryMinutes());
        m.put("maxSends", a.getMaxSends());
        m.put("templateId", a.getTemplateId());
        m.put("templateName", t != null ? t.getName() : null);
        m.put("templateMailKey", t != null ? t.getMailKey() : null);
        m.put("emailType", a.getEmailType());
        m.put("recipientRoles", a.roleList());
        m.put("extraRecipients", a.extraRecipientList());
        m.put("cancelOnEvents", a.cancelEventList());
        m.put("deliveryMode", (a.getDeliveryMode() == null ? MailAutomationDelivery.QUEUED : a.getDeliveryMode()).name());
        m.put("recheckBeforeSend", Boolean.TRUE.equals(a.getRecheckBeforeSend()));
        m.put("respectQuietHours", !Boolean.FALSE.equals(a.getRespectQuietHours()));
        m.put("channel", a.getChannel() == null ? "EMAIL" : a.getChannel());
        m.put("scopeInstitutes", a.scopeList());
        m.put("topic", a.getTopic());
        m.put("enabled", Boolean.TRUE.equals(a.getEnabled()));
        m.put("paused", Boolean.TRUE.equals(a.getPaused()));
        m.put("seedOrigin", a.getSeedOrigin() == null ? "MANUAL" : a.getSeedOrigin());
        List<String> warnings;
        try {
            warnings = MailAutomationValidator.warnings(a, t);
        } catch (IllegalArgumentException e) {
            warnings = Collections.singletonList(e.getMessage());
        }
        m.put("warnings", warnings);
        m.put("createdAt", a.getCreatedAt());
        m.put("updatedAt", a.getUpdatedAt());
        Map<String, Long> by = stats.byStatus.getOrDefault(a.getId(), Collections.emptyMap());
        Map<String, Object> st = new LinkedHashMap<>();
        st.put("queued", stats.queued.getOrDefault(a.getId(), 0L));
        st.put("sent", by.getOrDefault("SENT", 0L));
        st.put("failed", by.getOrDefault("FAILED", 0L));
        st.put("skipped", by.getOrDefault("SKIPPED", 0L));
        st.put("cancelled", 0L);
        st.put("last7dSent", stats.last7d.getOrDefault(a.getId(), 0L));
        st.put("lastSentAt", stats.lastSent.get(a.getId()));
        m.put("stats", st);
        return m;
    }

    private static Map<String, String> kv(String key, String label) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("key", key);
        m.put("label", label);
        return m;
    }

    private static String placeholderLabel(String key) {
        for (EmailPlaceholder p : EmailPlaceholder.values()) {
            if (p.key().equals(key)) return p.label();
        }
        return humanize(key);
    }

    static String humanize(String key) {
        StringBuilder sb = new StringBuilder();
        for (String part : key.split("_")) {
            if (part.isEmpty()) continue;
            if (sb.length() > 0) sb.append(' ');
            sb.append(sb.length() == 0 ? Character.toUpperCase(part.charAt(0)) : part.charAt(0)).append(part.substring(1));
        }
        return sb.toString();
    }
}
