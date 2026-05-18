package com.kccitm.api.util;

import java.util.LinkedHashMap;
import java.util.Map;

import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.InstituteDetailRepository;

/**
 * Builds the response body the registration endpoints return when an email is
 * already on file under a different date of birth. Instead of a flat error
 * message, the registrant gets enough context to recognise their own existing
 * account ("ABC School, John D., j***@gmail.com") and pick between using the
 * registered DOB or switching to a different email/phone — all without leaking
 * full PII to whoever happened to type the email.
 *
 * The DOB mismatch check upstream is what prevents a stranger from using this
 * response to harvest a real account: they still cannot proceed with the
 * existing account without knowing the registered DOB.
 */
public final class DuplicateEmailResponse {

    private DuplicateEmailResponse() {}

    public static Map<String, Object> build(StudentInfo existing,
                                            InstituteDetailRepository instituteRepo) {
        Map<String, Object> existingStudent = new LinkedHashMap<>();
        existingStudent.put("displayName", firstNameWithInitial(existing.getName(), existing.getFamily()));
        existingStudent.put("maskedEmail", maskEmail(existing.getEmail()));
        existingStudent.put("maskedPhone", maskPhone(existing.getPhoneNumber()));
        existingStudent.put("userId", existing.getCareerNineRollNumber());
        existingStudent.put("schoolName", lookupSchoolName(existing.getInstituteId(), instituteRepo));
        existingStudent.put("studentClass", existing.getStudentClass());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "duplicate_email");
        body.put("message",
                "This email is already linked to another Career-9 account. " +
                "If this looks like you, retry with the registered date of birth — " +
                "otherwise use a different email or phone number.");
        body.put("existingStudent", existingStudent);
        return body;
    }

    private static String firstNameWithInitial(String name, String family) {
        if (name == null || name.trim().isEmpty()) return null;
        String first = name.trim().split("\\s+")[0];
        String initial = family != null && !family.trim().isEmpty()
                ? " " + family.trim().substring(0, 1).toUpperCase() + "."
                : "";
        return first + initial;
    }

    private static String maskEmail(String email) {
        if (email == null) return null;
        int at = email.indexOf('@');
        if (at <= 0) return email;
        String local = email.substring(0, at);
        String domain = email.substring(at);
        if (local.length() <= 1) return local + "***" + domain;
        return local.charAt(0) + "***" + domain;
    }

    private static String maskPhone(String phone) {
        if (phone == null) return null;
        String digits = phone.replaceAll("\\D", "");
        if (digits.length() < 4) return null;
        return "•••••• " + digits.substring(digits.length() - 4);
    }

    private static String lookupSchoolName(Integer instituteId, InstituteDetailRepository repo) {
        if (instituteId == null || repo == null) return null;
        try {
            // The repo defines an int-overload of findById that returns the
            // entity directly (unlike JpaRepository's Optional<T> version).
            InstituteDetail i = repo.findById(instituteId.intValue());
            return i != null ? i.getInstituteName() : null;
        } catch (Exception ignored) {
            return null;
        }
    }
}
