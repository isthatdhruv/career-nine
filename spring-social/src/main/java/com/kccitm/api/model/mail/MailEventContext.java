package com.kccitm.api.model.mail;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Everything an event knows at the moment it happens: who it is about (subjects), who it can
 * reach (recipients per role), the placeholder values it supplies (fields), the dates an
 * automation can schedule relative to, and typed ids (refs) predicates use to re-check state
 * later. Built once at the call site, snapshotted into every job it produces.
 *
 * <pre>
 * mailEvents.publish(MailEventContext.of(MailEvent.ENTITLEMENT_GRANTED)
 *         .subject("entitlement", entitlementId)
 *         .subject("student", userStudentId)
 *         .recipient(MailRecipientRole.STUDENT, email, name)
 *         .field("assessment_name", assessmentName)
 *         .date("expires_at", expiresAt)
 *         .ref("entitlementId", entitlementId)
 *         .institute(instituteCode).student(userStudentId)
 *         .build());
 * </pre>
 */
public final class MailEventContext {

    public static final class Recipient {
        public final String email;
        public final String name;
        public Recipient(String email, String name) {
            this.email = email;
            this.name = name;
        }
    }

    public final MailEvent event;
    /** Subject keys, {@code kind:id}, primary first. */
    public final List<String> subjects;
    public final Map<MailRecipientRole, List<Recipient>> recipients;
    public final Map<String, String> fields;
    public final Map<String, Date> dates;
    public final Map<String, Long> refs;
    public final Integer instituteCode;
    public final Long userStudentId;
    public final Date occurredAt;

    private MailEventContext(Builder b) {
        this.event = b.event;
        this.subjects = Collections.unmodifiableList(new ArrayList<>(b.subjects));
        Map<MailRecipientRole, List<Recipient>> r = new EnumMap<>(MailRecipientRole.class);
        for (Map.Entry<MailRecipientRole, List<Recipient>> e : b.recipients.entrySet()) {
            r.put(e.getKey(), Collections.unmodifiableList(new ArrayList<>(e.getValue())));
        }
        this.recipients = Collections.unmodifiableMap(r);
        this.fields = Collections.unmodifiableMap(new LinkedHashMap<>(b.fields));
        this.dates = Collections.unmodifiableMap(new LinkedHashMap<>(b.dates));
        this.refs = Collections.unmodifiableMap(new LinkedHashMap<>(b.refs));
        this.instituteCode = b.instituteCode;
        this.userStudentId = b.userStudentId;
        this.occurredAt = b.occurredAt != null ? b.occurredAt : new Date();
    }

    public String primarySubject() {
        return subjects.isEmpty() ? null : subjects.get(0);
    }

    public List<Recipient> recipients(MailRecipientRole role) {
        List<Recipient> r = recipients.get(role);
        return r == null ? Collections.emptyList() : r;
    }

    public static Builder of(MailEvent event) {
        return new Builder(event);
    }

    public static final class Builder {
        private final MailEvent event;
        private final List<String> subjects = new ArrayList<>();
        private final Map<MailRecipientRole, List<Recipient>> recipients = new EnumMap<>(MailRecipientRole.class);
        private final Map<String, String> fields = new LinkedHashMap<>();
        private final Map<String, Date> dates = new LinkedHashMap<>();
        private final Map<String, Long> refs = new LinkedHashMap<>();
        private Integer instituteCode;
        private Long userStudentId;
        private Date occurredAt;

        private Builder(MailEvent event) {
            if (event == null) throw new IllegalArgumentException("event required");
            this.event = event;
        }

        /** Add a subject; the first one added is the primary subject jobs are indexed under. Null ids are ignored. */
        public Builder subject(String kind, Object id) {
            if (kind != null && id != null) subjects.add(kind + ":" + id);
            return this;
        }

        /** Add a recipient for a role. Blank emails are ignored, so call sites need no null checks. */
        public Builder recipient(MailRecipientRole role, String email, String name) {
            if (role == null || email == null || email.trim().isEmpty()) return this;
            recipients.computeIfAbsent(role, k -> new ArrayList<>()).add(new Recipient(email.trim(), name));
            return this;
        }

        public Builder field(String key, Object value) {
            if (key != null) fields.put(key, value == null ? "" : String.valueOf(value));
            return this;
        }

        public Builder fields(Map<String, String> values) {
            if (values != null) {
                for (Map.Entry<String, String> e : values.entrySet()) field(e.getKey(), e.getValue());
            }
            return this;
        }

        public Builder date(String key, Date value) {
            if (key != null && value != null) dates.put(key, value);
            return this;
        }

        /** Typed id predicates use at fire time, e.g. {@code ref("entitlementId", id)}. */
        public Builder ref(String key, Long value) {
            if (key != null && value != null) refs.put(key, value);
            return this;
        }

        public Builder institute(Integer instituteCode) { this.instituteCode = instituteCode; return this; }
        public Builder student(Long userStudentId) { this.userStudentId = userStudentId; return this; }
        public Builder occurredAt(Date at) { this.occurredAt = at; return this; }

        public MailEventContext build() {
            return new MailEventContext(this);
        }
    }
}
