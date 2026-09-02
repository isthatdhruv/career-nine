package com.kccitm.api.controller.career9.counselling;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.service.counselling.CounsellingBookingLinkService;

/**
 * Public (no-login) counselling booking, reached from the tokenized link emailed to a student who
 * completed an assessment but never booked their session. Allow-listed in SecurityConfig via
 * {@code /counselling/public/**}. The token is the only credential and is validated server-side.
 *
 * <p>Context-only: it resolves the token into the student/assessment ids, and the page then renders
 * the exact ThankYouPage counselling component (MappingCounsellingSection), which books through the
 * existing public counselling endpoints — one booking pipeline, one confirmation email path.
 */
@RestController
@RequestMapping("/counselling/public/book")
public class CounsellingPublicBookingController {

    @Autowired
    private CounsellingBookingLinkService bookingLinkService;

    /** Booking page context: greeting + the ids the counselling component runs on. */
    @GetMapping("/{token}")
    public ResponseEntity<?> context(@PathVariable String token) {
        try {
            return ResponseEntity.ok(bookingLinkService.getContext(token));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }
}
