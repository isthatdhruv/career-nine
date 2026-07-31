package com.kccitm.api.controller.career9.counselling;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.service.counselling.CounsellingRescheduleService;

/**
 * Public (no-login) self-service counselling reschedule, reached from the tokenized link emailed to
 * a student when their counsellor becomes unavailable. Allow-listed in SecurityConfig via
 * {@code /counselling/public/**}. The token is the only credential and is validated server-side.
 */
@RestController
@RequestMapping("/counselling/public/reschedule")
public class CounsellingPublicRescheduleController {

    private static final Logger logger = LoggerFactory.getLogger(CounsellingPublicRescheduleController.class);

    @Autowired
    private CounsellingRescheduleService rescheduleService;

    /** Reschedule page context: old session details + currently-available slots. */
    @GetMapping("/{token}")
    public ResponseEntity<?> context(@PathVariable String token) {
        try {
            return ResponseEntity.ok(rescheduleService.getContext(token));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    /** Book the student's chosen slot; returns the confirmed session details. */
    @PostMapping("/{token}")
    public ResponseEntity<?> confirm(@PathVariable String token, @RequestBody Map<String, Object> body) {
        if (body == null || body.get("slotId") == null) {
            return ResponseEntity.badRequest().body("slotId is required");
        }
        Long slotId = Long.valueOf(body.get("slotId").toString());
        try {
            CounsellingAppointment appt = rescheduleService.confirmReschedule(token, slotId);
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("appointmentId", appt.getId());
            CounsellingSlot s = appt.getSlot();
            if (s != null) {
                out.put("date", String.valueOf(s.getDate()));
                out.put("startTime", String.valueOf(s.getStartTime()));
                out.put("endTime", String.valueOf(s.getEndTime()));
            }
            out.put("mode", appt.getMode());
            out.put("meetingLink", appt.getMeetingLink());
            out.put("location", appt.getLocation());
            return ResponseEntity.ok(out);
        } catch (RuntimeException e) {
            String tail = token != null && token.length() > 6 ? token.substring(token.length() - 6) : "?";
            logger.warn("Self-reschedule confirm failed (token …{}, slot {}): {}", tail, slotId, e.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        }
    }
}
