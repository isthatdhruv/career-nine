package com.kccitm.api.service.email;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.email.EmailNotificationRecipient;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.email.RecipientKind;
import com.kccitm.api.repository.email.EmailNotificationRecipientRepository;

/**
 * Reads and maintains the standing recipient lists that drive automatic notifications.
 *
 * <p>Two jobs, deliberately in one class: the admin page edits these rows and the
 * dispatcher reads them, and keeping the filter semantics in a single place is what stops
 * the list an admin sees from disagreeing with the list that actually gets mailed.
 */
@Service
public class EmailNotificationRecipientService {

    /**
     * Deliberately permissive — enough to catch a typo like a missing @ or a stray space,
     * not an attempt to implement RFC 5322. A wrong-but-well-formed address is caught by
     * the bounce, and over-strict validation would reject addresses that do deliver.
     */
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    @Autowired
    private EmailNotificationRecipientRepository repository;

    // ─── dispatch-time read ──────────────────────────────────────────────

    /** The addresses for one scenario, grouped by header, after applying the row filters. */
    public static class Resolved {
        public final List<String> to = new ArrayList<>();
        public final List<String> cc = new ArrayList<>();
        public final List<String> bcc = new ArrayList<>();

        public boolean isEmpty() {
            return to.isEmpty() && cc.isEmpty() && bcc.isEmpty();
        }

        public int size() {
            return to.size() + cc.size() + bcc.size();
        }
    }

    /**
     * Who should hear about an event of this type with these attributes.
     *
     * <p>An address configured more than once — say once for all leads and once for school
     * leads — is mailed once, in the strongest header it appears in. Sending someone the
     * same alert twice reads as a fault in the system, not as emphasis.
     */
    public Resolved resolve(EmailType type, String leadType, String source) {
        Resolved out = new Resolved();
        if (type == null) {
            return out;
        }

        Set<String> seen = new LinkedHashSet<>();
        Map<String, RecipientKind> kinds = new LinkedHashMap<>();

        for (EmailNotificationRecipient row : repository.findByEmailTypeAndActiveTrue(type.name())) {
            if (row.getEmail() == null || !row.matches(leadType, source)) {
                continue;
            }
            String address = row.getEmail().trim();
            if (address.isEmpty()) {
                continue;
            }
            String key = address.toLowerCase();
            RecipientKind kind = row.getRecipientKind() != null ? row.getRecipientKind() : RecipientKind.TO;
            if (seen.add(key)) {
                kinds.put(key, kind);
                // Keep the address as typed for the header; the lowercase form is only the key.
                out.to.add(address);
                continue;
            }
            // Already present: promote if this row puts it in a more visible header.
            if (kind.ordinal() < kinds.get(key).ordinal()) {
                kinds.put(key, kind);
            }
        }

        // The loop above collects into `to` for ordering; split into the real headers now.
        List<String> collected = new ArrayList<>(out.to);
        out.to.clear();
        for (String address : collected) {
            switch (kinds.get(address.toLowerCase())) {
                case CC:
                    out.cc.add(address);
                    break;
                case BCC:
                    out.bcc.add(address);
                    break;
                default:
                    out.to.add(address);
            }
        }

        // A list of only Cc/Bcc has no To — most providers accept that, but some drop it,
        // and an alert nobody receives is the worst possible outcome here. Promote one.
        if (out.to.isEmpty() && !out.isEmpty()) {
            List<String> fallback = !out.cc.isEmpty() ? out.cc : out.bcc;
            out.to.add(fallback.remove(0));
        }
        return out;
    }

    // ─── admin CRUD ──────────────────────────────────────────────────────

    public List<Map<String, Object>> list(String emailType) {
        List<EmailNotificationRecipient> rows = (emailType == null || emailType.trim().isEmpty())
                ? repository.findAllByOrderByEmailTypeAscEmailAsc()
                : repository.findByEmailTypeOrderByEmailAsc(emailType.trim().toUpperCase());
        List<Map<String, Object>> out = new ArrayList<>();
        for (EmailNotificationRecipient row : rows) {
            out.add(toDto(row));
        }
        return out;
    }

    public Map<String, Object> create(Map<String, Object> form, Long userId) {
        EmailNotificationRecipient row = new EmailNotificationRecipient();
        apply(row, form);
        row.setUpdatedBy(userId);
        return toDto(repository.save(row));
    }

    /** Returns null when the id does not exist, so the controller can 404. */
    public Map<String, Object> update(Long id, Map<String, Object> form, Long userId) {
        EmailNotificationRecipient row = repository.findById(id).orElse(null);
        if (row == null) {
            return null;
        }
        apply(row, form);
        row.setUpdatedBy(userId);
        return toDto(repository.save(row));
    }

    public boolean delete(Long id) {
        if (!repository.existsById(id)) {
            return false;
        }
        repository.deleteById(id);
        return true;
    }

    private void apply(EmailNotificationRecipient row, Map<String, Object> form) {
        String emailType = str(form.get("emailType"));
        if (emailType != null) {
            EmailType parsed = EmailType.from(emailType);
            if (parsed == null) {
                throw new IllegalArgumentException("Unknown email type: " + emailType);
            }
            row.setEmailType(parsed.name());
        }
        if (row.getEmailType() == null) {
            throw new IllegalArgumentException("emailType is required");
        }

        if (form.containsKey("email")) {
            String email = str(form.get("email"));
            if (email == null || !EMAIL.matcher(email).matches()) {
                throw new IllegalArgumentException("A valid email address is required");
            }
            row.setEmail(email);
        }
        if (row.getEmail() == null) {
            throw new IllegalArgumentException("email is required");
        }

        if (form.containsKey("label")) {
            row.setLabel(str(form.get("label")));
        }
        if (form.containsKey("recipientKind")) {
            row.setRecipientKind(RecipientKind.from(str(form.get("recipientKind"))));
        }
        // Blank from the form means "no filter", which is a null column, not an empty string —
        // the matcher treats blank as unfiltered anyway, but a null keeps the table honest.
        if (form.containsKey("leadType")) {
            String leadType = str(form.get("leadType"));
            row.setLeadType(leadType == null ? null : leadType.toUpperCase());
        }
        if (form.containsKey("source")) {
            row.setSource(str(form.get("source")));
        }
        if (form.containsKey("active")) {
            row.setActive(!Boolean.FALSE.equals(form.get("active")));
        }
    }

    private Map<String, Object> toDto(EmailNotificationRecipient row) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", row.getId());
        m.put("emailType", row.getEmailType());
        m.put("email", row.getEmail());
        m.put("label", row.getLabel());
        m.put("recipientKind", row.getRecipientKind() != null ? row.getRecipientKind().name() : "TO");
        m.put("leadType", row.getLeadType());
        m.put("source", row.getSource());
        m.put("active", Boolean.TRUE.equals(row.getActive()));
        m.put("updatedAt", row.getUpdatedAt());
        return m;
    }

    /** Trimmed, with blank collapsing to null. */
    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String s = String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }
}
