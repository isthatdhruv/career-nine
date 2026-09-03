package com.kccitm.api.service.mail;

import java.util.Arrays;
import java.util.Collection;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.PaymentTransaction;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.b2c.StudentEntitlement;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.mail.MailPredicate;
import com.kccitm.api.repository.Career9.PaymentTransactionRepository;
import com.kccitm.api.repository.Career9.b2c.StudentEntitlementRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;

/**
 * Evaluates {@link MailPredicate}s. Field-based ones read the event snapshot; state-based ones
 * ("still not started", "still pending") do one indexed read using the typed refs the event
 * supplied. A predicate that cannot be evaluated (missing ref, lookup failure) is false, so
 * the engine errs on silence rather than on an unwanted mail.
 */
@Service
public class MailPredicateRegistry {

    private static final Logger logger = LoggerFactory.getLogger(MailPredicateRegistry.class);

    private static final Set<String> PAYMENT_PENDING = new HashSet<>(Arrays.asList("created", "sent", "pending", "issued"));
    private static final Set<String> APPOINTMENT_SCHEDULED = new HashSet<>(Arrays.asList("PENDING", "CONFIRMED"));

    @Autowired(required = false) private StudentAssessmentMappingRepository mappingRepository;
    @Autowired(required = false) private StudentEntitlementRepository entitlementRepository;
    @Autowired(required = false) private CounsellingAppointmentRepository appointmentRepository;
    @Autowired(required = false) private PaymentTransactionRepository paymentRepository;

    /** The first predicate key that does not hold, or null when all do. Unknown keys are treated as failing. */
    public String firstFailing(Collection<String> predicateKeys, Map<String, Long> refs, Map<String, String> fields) {
        if (predicateKeys == null) return null;
        for (String key : predicateKeys) {
            MailPredicate p = MailPredicate.fromKey(key);
            if (p == null) return key;
            if (!holds(p, refs, fields)) return key;
        }
        return null;
    }

    public boolean holds(MailPredicate p, Map<String, Long> refs, Map<String, String> fields) {
        try {
            switch (p) {
                case ASSESSMENT_NOT_STARTED: {
                    StudentAssessmentMapping m = mapping(refs);
                    if (m == null) return refs != null && refs.containsKey("userStudentId"); // no mapping row yet = not started
                    return m.getStatus() == null || "notstarted".equalsIgnoreCase(m.getStatus());
                }
                case ASSESSMENT_NOT_COMPLETED: {
                    StudentAssessmentMapping m = mapping(refs);
                    if (m == null) return refs != null && refs.containsKey("userStudentId");
                    return !"completed".equalsIgnoreCase(m.getStatus());
                }
                case ENTITLEMENT_ACTIVE: {
                    StudentEntitlement e = entitlement(refs);
                    if (e == null) return false;
                    boolean active = "active".equalsIgnoreCase(e.getStatus());
                    Date exp = e.getExpiresAt();
                    return active && (exp == null || exp.after(new Date()));
                }
                case HAS_COUNSELLING_SESSIONS: {
                    StudentEntitlement e = entitlement(refs);
                    if (e == null) return false;
                    int total = e.getCounsellingSessionsTotal() == null ? 0 : e.getCounsellingSessionsTotal();
                    int used = e.getCounsellingSessionsUsed() == null ? 0 : e.getCounsellingSessionsUsed();
                    return total - used > 0;
                }
                case COUNSELLING_NOT_BOOKED: {
                    Long studentId = ref(refs, "userStudentId");
                    if (studentId == null || appointmentRepository == null) return false;
                    Long entitlementId = ref(refs, "entitlementId");
                    List<CounsellingAppointment> active = appointmentRepository.findActiveByStudent(studentId);
                    if (active == null || active.isEmpty()) return true;
                    if (entitlementId == null) return false;
                    for (CounsellingAppointment a : active) {
                        if (a.getEntitlementId() == null || entitlementId.equals(a.getEntitlementId())) return false;
                    }
                    return true;
                }
                case PAYMENT_STILL_PENDING: {
                    Long paymentId = ref(refs, "paymentId");
                    if (paymentId == null || paymentRepository == null) return false;
                    Optional<PaymentTransaction> t = paymentRepository.findById(paymentId);
                    return t.isPresent() && t.get().getStatus() != null
                            && PAYMENT_PENDING.contains(t.get().getStatus().toLowerCase());
                }
                case APPOINTMENT_STILL_SCHEDULED: {
                    Long appointmentId = ref(refs, "appointmentId");
                    if (appointmentId == null || appointmentRepository == null) return false;
                    Optional<CounsellingAppointment> a = appointmentRepository.findById(appointmentId);
                    return a.isPresent() && a.get().getStatus() != null
                            && APPOINTMENT_SCHEDULED.contains(a.get().getStatus().toUpperCase());
                }
                case HAS_MEETING_LINK:
                    return notBlank(fields, "meeting_link");
                case IS_OFFLINE_SESSION:
                    return notBlank(fields, "venue") && !notBlank(fields, "meeting_link");
                case HAS_PARENT_EMAIL:
                    return "true".equalsIgnoreCase(value(fields, "has_parent_email")) || notBlank(fields, "parent_email");
                default:
                    return false;
            }
        } catch (Exception e) {
            logger.warn("Predicate {} could not be evaluated: {}", p.key(), e.getMessage());
            return false;
        }
    }

    private StudentAssessmentMapping mapping(Map<String, Long> refs) {
        Long studentId = ref(refs, "userStudentId");
        Long assessmentId = ref(refs, "assessmentId");
        if (studentId == null || assessmentId == null || mappingRepository == null) return null;
        return mappingRepository.findFirstByUserStudentUserStudentIdAndAssessmentId(studentId, assessmentId).orElse(null);
    }

    private StudentEntitlement entitlement(Map<String, Long> refs) {
        Long id = ref(refs, "entitlementId");
        if (id == null || entitlementRepository == null) return null;
        return entitlementRepository.findById(id).orElse(null);
    }

    private static Long ref(Map<String, Long> refs, String key) {
        return refs == null ? null : refs.get(key);
    }

    private static String value(Map<String, String> fields, String key) {
        return fields == null ? null : fields.get(key);
    }

    private static boolean notBlank(Map<String, String> fields, String key) {
        String v = value(fields, key);
        return v != null && !v.trim().isEmpty();
    }
}
