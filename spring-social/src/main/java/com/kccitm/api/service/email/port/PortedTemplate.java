package com.kccitm.api.service.email.port;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.email.MailClass;
import com.kccitm.api.model.email.SeedOrigin;

/**
 * One mail whose content was lifted out of Java (or the legacy reminder_config table) so it
 * can be seen, previewed, linted and reviewed in the admin catalogue. Seeded once per
 * {@link #mailKey} by {@code CodePortSeeder}; never re-applied over an admin edit.
 *
 * <p>Fidelity rule: subject and body are the ORIGINAL copy with dynamic Java expressions
 * replaced by {@code {{placeholders}}}, branches by {@code {{#flag}}…{{/flag}}} /
 * {@code {{^flag}}…{{/flag}}} sections, and loops by a pre-rendered {@code *_html} block.
 * Nothing is reworded during the port.
 */
public final class PortedTemplate {

    public final String mailKey;
    public final EmailType type;
    public final String name;
    public final String sourceRef;
    public final MailClass mailClass;
    public final SeedOrigin origin;
    public final String subject;
    public final String body;
    public final String text;
    public final List<String> variantFlags;

    private PortedTemplate(Builder b) {
        this.mailKey = b.mailKey;
        this.type = b.type;
        this.name = b.name;
        this.sourceRef = b.sourceRef;
        this.mailClass = b.mailClass;
        this.origin = b.origin;
        this.subject = b.subject;
        this.body = b.body;
        this.text = b.text;
        this.variantFlags = Collections.unmodifiableList(new ArrayList<>(b.variantFlags));
    }

    /**
     * @param mailKey fine-grained identity, {@code category.mail} in snake_case, e.g.
     *                {@code payment.success} or {@code counselling.session_confirmed}
     * @param type    the coarse {@link EmailType} slot this mail is dispatched under
     */
    public static Builder of(String mailKey, EmailType type) {
        return new Builder(mailKey, type);
    }

    public static final class Builder {
        private final String mailKey;
        private final EmailType type;
        private String name;
        private String sourceRef;
        private MailClass mailClass = MailClass.TRANSACTIONAL;
        private SeedOrigin origin = SeedOrigin.CODE_PORT;
        private String subject;
        private String body;
        private String text;
        private List<String> variantFlags = new ArrayList<>();

        private Builder(String mailKey, EmailType type) {
            this.mailKey = mailKey;
            this.type = type;
        }

        /** Human name shown in the catalogue, e.g. "Payment success / receipt (from code)". */
        public Builder name(String name) { this.name = name; return this; }

        /**
         * Where the copy was lifted from: {@code Class#method} plus a repo-relative path and
         * line range, e.g. {@code "PaymentEmailService#sendPaymentSuccess (service/PaymentEmailService.java:39-63)"}.
         */
        public Builder source(String classAndMethod, String pathAndLines) {
            this.sourceRef = classAndMethod + " (" + pathAndLines + ")";
            return this;
        }

        public Builder mailClass(MailClass mailClass) { this.mailClass = mailClass; return this; }
        public Builder origin(SeedOrigin origin) { this.origin = origin; return this; }
        public Builder subject(String subject) { this.subject = subject; return this; }
        public Builder body(String body) { this.body = body; return this; }

        /** Plain-text alternative, only when the original sender built one; otherwise leave null. */
        public Builder text(String text) { this.text = text; return this; }

        /**
         * Boolean flags the body branches on ({@code {{#flag}}…{{/flag}}}), so the preview can
         * offer a toggle for each, e.g. {@code "has_credentials", "has_parent"}.
         */
        public Builder variants(String... flags) {
            this.variantFlags = new ArrayList<>(Arrays.asList(flags));
            return this;
        }

        public PortedTemplate build() {
            if (mailKey == null || mailKey.trim().isEmpty()) throw new IllegalStateException("mailKey required");
            if (type == null) throw new IllegalStateException("type required for " + mailKey);
            if (name == null || name.trim().isEmpty()) throw new IllegalStateException("name required for " + mailKey);
            if (sourceRef == null) throw new IllegalStateException("source required for " + mailKey);
            if (body == null) throw new IllegalStateException("body required for " + mailKey);
            return new PortedTemplate(this);
        }
    }
}
