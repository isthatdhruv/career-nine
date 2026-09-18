package com.kccitm.api.service.whatsapp;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.kccitm.api.model.ContactPerson;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.Lead;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.Career9.StudentInfoRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;

/**
 * Turns an email address into the phone number and name to WhatsApp.
 *
 * <p>Emails are addressed by address, WhatsApp by number, and the great majority of call sites
 * in this system only ever knew the address. Rather than rewrite every one of them to carry a
 * number as well — which is the change that never finishes, and leaves whichever call sites
 * were missed sending on one channel only — the number is looked up here from the address the
 * mail was already going to.
 *
 * <p>Five places hold a number against an address, checked in order of how specific they are:
 * the student record, the counsellor record, the school's contact person, the lead capture, then
 * the user account. Each was added because an email was going out on one channel without it —
 * a contact person receiving a school's dashboard-ready mail, or an enquirer receiving the lead
 * acknowledgement, both had a number sitting in the database that nothing was looking at.
 *
 * <p>What is still left over: an address that belongs to no record at all — a parent/guardian
 * contact typed in at booking, an ops mailbox from {@code email_notification_recipient}. Those
 * cannot be resolved by definition, so the caller passes the number explicitly instead.
 *
 * <p>Lookups are read-only and cheap, but they are not free, and a mail to ten recipients would
 * otherwise repeat them ten times per send. {@link #resolve} is called once per address per
 * dispatch and its misses are as informative as its hits, so both are returned rather than
 * throwing.
 */
@Component
public class WhatsAppRecipientResolver {

    private static final Logger logger = LoggerFactory.getLogger(WhatsAppRecipientResolver.class);

    @Autowired(required = false)
    private StudentInfoRepository studentInfoRepository;

    @Autowired(required = false)
    private CounsellorRepository counsellorRepository;

    @Autowired(required = false)
    private UserRepository userRepository;

    @Autowired(required = false)
    private com.kccitm.api.repository.ContactPersonRepository contactPersonRepository;

    @Autowired(required = false)
    private com.kccitm.api.repository.Career9.LeadRepository leadRepository;

    /** A resolved number, with the name to greet and where it was found. */
    public static final class Recipient {
        public final String phone;
        public final String name;
        public final String source;

        Recipient(String phone, String name, String source) {
            this.phone = phone;
            this.name = name;
            this.source = source;
        }
    }

    /**
     * The number held against {@code email}, or null when no record has one. Never throws: a
     * notification must not fail because a lookup did.
     */
    public Recipient resolve(String email) {
        if (email == null || email.trim().isEmpty()) return null;
        String addr = email.trim();
        try {
            Recipient student = fromStudent(addr);
            if (student != null) return student;

            Recipient counsellor = fromCounsellor(addr);
            if (counsellor != null) return counsellor;

            Recipient contact = fromContactPerson(addr);
            if (contact != null) return contact;

            Recipient lead = fromLead(addr);
            if (lead != null) return lead;

            return fromUser(addr);
        } catch (Exception e) {
            logger.warn("WhatsApp number lookup failed for {}: {}", addr, e.getMessage());
            return null;
        }
    }

    private Recipient fromStudent(String email) {
        if (studentInfoRepository == null) return null;
        List<StudentInfo> matches = studentInfoRepository.findByEmail(email);
        if (matches == null) return null;
        // A student may appear under more than one institute; the records share the person, so
        // the first with a number on it is the person's number.
        for (StudentInfo s : matches) {
            if (s != null && isSet(s.getPhoneNumber())) {
                return new Recipient(s.getPhoneNumber(), s.getName(), "student");
            }
        }
        return null;
    }

    private Recipient fromCounsellor(String email) {
        if (counsellorRepository == null) return null;
        Counsellor c = counsellorRepository.findByEmail(email).orElse(null);
        return c != null && isSet(c.getPhone())
                ? new Recipient(c.getPhone(), c.getName(), "counsellor")
                : null;
    }

    /**
     * The named contact at a school. Covers the B2B and report mail — dashboard released, report
     * ready, assessment assigned, school registration — whose recipients are contact people
     * rather than students, and whose numbers are on the contact_person row.
     */
    private Recipient fromContactPerson(String email) {
        if (contactPersonRepository == null) return null;
        List<ContactPerson> matches = contactPersonRepository.findByEmail(email);
        if (matches == null) return null;
        // One person can be the contact for several institutes; the rows share the person, so
        // the first with a number on it is their number.
        for (ContactPerson c : matches) {
            if (c != null && isSet(c.getPhoneNumber())) {
                return new Recipient(c.getPhoneNumber(), c.getName(), "contact_person");
            }
        }
        return null;
    }

    /**
     * Somebody who filled the enquiry form and is not yet anything else in the system. Their
     * number is the one thing the form always asks for, and the acknowledgement mail was going
     * out without it.
     */
    private Recipient fromLead(String email) {
        if (leadRepository == null) return null;
        List<Lead> matches = leadRepository.findByEmailOrderByIdDesc(email);
        if (matches == null) return null;
        for (Lead l : matches) {
            if (l != null && isSet(l.getPhone())) {
                return new Recipient(l.getPhone(), l.getFullName(), "lead");
            }
        }
        return null;
    }

    private Recipient fromUser(String email) {
        if (userRepository == null) return null;
        User u = userRepository.findByEmail(email);
        return u != null && isSet(u.getPhone())
                ? new Recipient(u.getPhone(), u.getName(), "user")
                : null;
    }

    private boolean isSet(String v) {
        return v != null && !v.trim().isEmpty();
    }
}
