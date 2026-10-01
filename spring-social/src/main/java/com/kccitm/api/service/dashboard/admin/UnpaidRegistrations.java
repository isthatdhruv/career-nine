package com.kccitm.api.service.dashboard.admin;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.persistence.EntityManager;

import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.model.career9.b2c.Campaign;
import com.kccitm.api.service.counselling.CounsellingClock;

/**
 * The people behind the "Unpaid registrations" card: every unpaid attempt that
 * {@link OverviewQuery#unpaidRegistrations} admits, created inside the applied
 * window, grouped into one entry per person. The card counts the entries and the
 * drill-down lists them, so the number and the list cannot drift apart.
 *
 * <p>A person is their email (case-insensitive), or their phone when the form
 * carried no email — so someone who tried three times counts once. Unpaid rows are
 * few (links expire, people retry), so grouping in memory is cheap.
 */
final class UnpaidRegistrations {

    static final class Person {
        /** Newest attempt first. */
        final List<PaymentTransaction> attempts = new ArrayList<>();
        /** The campaign behind each attempt, where there was one. */
        final Map<Long, Campaign> campaigns = new LinkedHashMap<>();

        PaymentTransaction latest() { return attempts.get(0); }

        Date firstAt() {
            Date first = null;
            for (PaymentTransaction p : attempts) {
                if (p.getCreatedAt() != null && (first == null || p.getCreatedAt().before(first))) first = p.getCreatedAt();
            }
            return first;
        }

        Set<Long> assessmentIds() {
            Set<Long> ids = new LinkedHashSet<>();
            for (PaymentTransaction p : attempts) if (p.getAssessmentId() != null) ids.add(p.getAssessmentId());
            return ids;
        }

        /** The institute of the latest attempt: its own column, else its campaign's. */
        Integer instituteCode() {
            PaymentTransaction p = latest();
            if (p.getInstituteCode() != null) return p.getInstituteCode();
            Campaign c = p.getCampaignId() == null ? null : campaigns.get(p.getCampaignId());
            return c == null ? null : c.getInstituteCode();
        }

        Campaign campaign() {
            PaymentTransaction p = latest();
            return p.getCampaignId() == null ? null : campaigns.get(p.getCampaignId());
        }
    }

    private UnpaidRegistrations() {
    }

    /** Everyone with an unpaid attempt in the window, newest attempt first. */
    static List<Person> load(EntityManager em, CounsellingClock clock, AdminOverviewFilter f, String search) {
        List<Object[]> rows = OverviewQuery.unpaidRegistrations(em, clock.zone(), f)
                .dateRange("p.createdAt", f)
                .searchFields(search, "p.studentName", "p.studentEmail", "p.studentPhone", "p.promoCode")
                .orderBy("p.createdAt DESC, p.transactionId DESC")
                .list("SELECT p, pc", Object[].class, 0, Integer.MAX_VALUE);

        Map<String, Person> byKey = new LinkedHashMap<>();
        for (Object[] row : rows) {
            PaymentTransaction p = (PaymentTransaction) row[0];
            Campaign c = (Campaign) row[1];
            Person person = byKey.computeIfAbsent(personKey(p), k -> new Person());
            person.attempts.add(p);
            if (c != null) person.campaigns.put(c.getCampaignId(), c);
        }
        return new ArrayList<>(byKey.values());
    }

    private static String personKey(PaymentTransaction p) {
        String email = p.getStudentEmail() == null ? "" : p.getStudentEmail().trim().toLowerCase();
        if (!email.isEmpty()) return "e:" + email;
        return "p:" + (p.getStudentPhone() == null ? "" : p.getStudentPhone().trim());
    }
}
