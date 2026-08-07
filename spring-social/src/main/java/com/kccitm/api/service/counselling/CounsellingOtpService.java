package com.kccitm.api.service.counselling;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Date;

public interface CounsellingOtpService {

    /** DOB as ddMMyyyy — 12-08-2026 becomes 12082026. */
    DateTimeFormatter DOB_KEY = DateTimeFormatter.ofPattern("ddMMyyyy");

    /** Fallback OTP when the student has no DOB on record. */
    String DEFAULT_OTP = "1111";

    /**
     * Counselling OTP: reverse the DOB's digits, add 256, keep the last four.
     *
     * <p>The DOB is zero-padded back to 8 characters before reversing, because
     * {@code int} has already eaten the leading zero of a single-digit day —
     * 05-08-2026 must reverse as {@code 62028050}, not {@code 6202805}, or the
     * OTP shifts for every student born on days 1-9.
     *
     * <p>Returned as a String so a result whose last four digits are e.g.
     * {@code 0042} keeps its leading zero.
     */
    public static String generateCounsellingOtp(int dob) {

        String key = String.format("%08d", dob);
        int reversed = Integer.parseInt(new StringBuilder(key).reverse().toString());
        return String.format("%04d", Math.abs(reversed + 256) % 10000);

    }

    /**
     * OTP for a stored DOB, falling back to {@link #DEFAULT_OTP} when the DOB is
     * missing. The Date → LocalDate conversion uses the JVM zone, mirroring the
     * round-trip JDBC already performs on the DATE column, so the digits match
     * the DOB the student sees.
     */
    static String counsellingOtpFor(Date dob) {
        if (dob == null) return DEFAULT_OTP;
        LocalDate birth = dob.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        return generateCounsellingOtp(Integer.parseInt(birth.format(DOB_KEY)));
    }

}
