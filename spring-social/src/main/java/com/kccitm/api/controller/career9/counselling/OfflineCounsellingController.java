package com.kccitm.api.controller.career9.counselling;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.counselling.OfflineCounsellingException;
import com.kccitm.api.service.counselling.OfflineCounsellingService;
import com.kccitm.api.service.counselling.OtpGuardService;

/**
 * The offline-counselling page (counsellor portal) and its two admin actions.
 *
 * <p>The {@code @PreAuthorize} codes are what the archtest requires and what enforce mode would
 * check one day; today they are log-only, so every real gate lives in
 * {@link OfflineCounsellingService} (offline counsellor, school, student) or is a hard
 * permission check there (the admin endpoints). No new permission code: the COUNSELLOR role
 * already holds {@code counselling.appointment.read/update}; admins hold {@code .delete} and
 * {@code counsellor.create}.
 *
 * <p>Refusals come back as {@code {status, error, message, code, ...extras}} — see
 * {@link #handle}. The codes are what the page branches on.
 */
@RestController
@RequestMapping("/api/offline-counselling")
public class OfflineCounsellingController {

    @Autowired
    private OfflineCounsellingService offlineService;

    @Autowired
    private OtpGuardService otpGuardService;

    // no scope arg: resolves the caller's own counsellor profile; always 200
    @PreAuthorize("@auth.allows('counselling.appointment.read')")
    @GetMapping("/context")
    public ResponseEntity<OfflineCounsellingService.OfflineContext> context(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(offlineService.context(principal));
    }

    // no scope arg: school checked in-service against the caller's own institute mappings
    @PreAuthorize("@auth.allows('counselling.appointment.read')")
    @GetMapping("/assessments")
    public ResponseEntity<List<OfflineCounsellingService.AssessmentOption>> assessments(
            @RequestParam(value = "instituteCode", required = false) Integer instituteCode,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(offlineService.assessments(principal, instituteCode));
    }

    // no scope arg: school checked in-service against the caller's own institute mappings
    @PreAuthorize("@auth.allows('counselling.appointment.read')")
    @GetMapping("/students")
    public ResponseEntity<List<OfflineCounsellingService.StudentRow>> students(
            @RequestParam(value = "instituteCode", required = false) Integer instituteCode,
            @RequestParam(value = "assessmentId", required = false) Long assessmentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(offlineService.students(principal, instituteCode, assessmentId));
    }

    // no scope arg: body is raw Map; each student's own institute is checked in-service
    @PreAuthorize("@auth.allows('counselling.appointment.update')")
    @PostMapping("/map-to-me")
    public ResponseEntity<OfflineCounsellingService.MapToMeResponse> mapToMe(
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal principal) {
        Object raw = body != null ? body.get("userStudentIds") : null;
        List<Long> ids = new ArrayList<>();
        if (raw instanceof List) {
            for (Object o : (List<?>) raw) {
                Long id = toLong(o);
                if (id != null) ids.add(id);
            }
        } else if (raw != null) {
            throw OfflineCounsellingException.badRequest("BAD_REQUEST", "userStudentIds must be a list.");
        }
        return ResponseEntity.ok(offlineService.mapToMe(principal, ids));
    }

    /**
     * Records an in-person session. Three steps, in this order on purpose: every read-only check
     * first (so a request bound to fail cannot spend one of the student's OTP attempts), then
     * the OTP guard in its own committed transaction (so a wrong code is counted even though the
     * request then fails), then the locked, transactional write, which re-checks everything.
     */
    // no scope arg: body is raw Map; student's own institute and mapping checked in-service
    @PreAuthorize("@auth.allows('counselling.appointment.update')")
    @PostMapping("/mark-done")
    public ResponseEntity<OfflineCounsellingService.MarkDoneResult> markDone(
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal principal) {
        Map<String, Object> b = body != null ? body : new LinkedHashMap<>();
        Long userStudentId = toLong(b.get("userStudentId"));
        Long assessmentId = toLong(b.get("assessmentId"));
        LocalDate sessionDate = parseDate(b.get("sessionDate"));
        String otp = b.get("otp") != null ? b.get("otp").toString().trim() : "";

        Long counsellorId = offlineService.preflight(principal, userStudentId, assessmentId, sessionDate);

        boolean otpVerified = false;
        if (!otp.isEmpty()) {
            if (!otp.matches("\\d{4}")) {
                throw OfflineCounsellingException.badRequest("BAD_REQUEST", "The code is 4 digits.");
            }
            otpVerified = OfflineCounsellingService.otpVerifiedOrThrow(
                    otpGuardService.check(userStudentId, otp, counsellorId));
        }
        return ResponseEntity.ok(offlineService.markDone(principal, userStudentId, assessmentId, sessionDate, otpVerified));
    }

    // no scope arg: admin action on one appointment; hard permission check in-service
    @PreAuthorize("@auth.allows('counselling.appointment.delete')")
    @PostMapping("/admin/{appointmentId}/revert")
    public ResponseEntity<OfflineCounsellingService.RevertResult> revert(
            @PathVariable Long appointmentId,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal principal) {
        String note = body != null && body.get("note") != null ? body.get("note").toString() : null;
        return ResponseEntity.ok(offlineService.revert(principal, appointmentId, note));
    }

    // no scope arg: admin toggle on one counsellor; hard permission check in-service
    @PreAuthorize("@auth.allows('counsellor.create')")
    @PutMapping("/admin/counsellor/{counsellorId}/offline")
    public ResponseEntity<OfflineCounsellingService.OfflineFlagResult> setOffline(
            @PathVariable Long counsellorId,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal principal) {
        Object raw = body != null ? body.get("offline") : null;
        if (!(raw instanceof Boolean)) {
            throw OfflineCounsellingException.badRequest("BAD_REQUEST", "offline must be true or false.");
        }
        return ResponseEntity.ok(offlineService.setOffline(principal, counsellorId, (Boolean) raw));
    }

    /**
     * Renders a refusal. Handled here rather than in the global handler because the page needs
     * the {@code code} and the extras (attempts left, lock time, who already recorded it), which
     * the shared {@code ApiErrorResponse} has no room for.
     */
    @ExceptionHandler(OfflineCounsellingException.class)
    public ResponseEntity<Map<String, Object>> handle(OfflineCounsellingException e, HttpServletRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", e.getStatus().value());
        body.put("error", e.getStatus().getReasonPhrase());
        body.put("message", e.getMessage());
        body.put("code", e.getCode());
        body.putAll(e.getExtras());
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("path", request != null ? request.getRequestURI() : null);
        return ResponseEntity.status(e.getStatus()).body(body);
    }

    private static Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).longValue();
        String s = v.toString().trim();
        if (s.isEmpty()) return null;
        try {
            return Long.valueOf(s);
        } catch (NumberFormatException e) {
            throw OfflineCounsellingException.badRequest("BAD_REQUEST", "Expected a number.");
        }
    }

    private static LocalDate parseDate(Object v) {
        if (v == null || v.toString().trim().isEmpty()) return null;
        try {
            return LocalDate.parse(v.toString().trim());
        } catch (DateTimeParseException e) {
            throw OfflineCounsellingException.badRequest("BAD_DATE", "The session date must look like 2026-09-28.");
        }
    }
}
