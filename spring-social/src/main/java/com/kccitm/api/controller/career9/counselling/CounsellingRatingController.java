package com.kccitm.api.controller.career9.counselling;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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
import com.kccitm.api.model.career9.counselling.CounsellingRating;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingRatingRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;

@RestController
@RequestMapping("/api/counselling-rating")
public class CounsellingRatingController {

    private static final Logger logger = LoggerFactory.getLogger(CounsellingRatingController.class);

    @Autowired
    private CounsellingRatingRepository ratingRepository;

    @Autowired
    private CounsellingAppointmentRepository appointmentRepository;

    @Autowired
    private CounsellorRepository counsellorRepository;

    public static class CreateRatingRequest {
        public Long appointmentId;
        public Integer rating;
        public String review;
    }

    @PostMapping("/create")
    public ResponseEntity<?> create(@RequestBody CreateRatingRequest req) {
        if (req.appointmentId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("appointmentId is required");
        }
        if (req.rating == null || req.rating < 1 || req.rating > 5) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("rating must be between 1 and 5");
        }

        Optional<CounsellingAppointment> apptOpt = appointmentRepository.findById(req.appointmentId);
        if (!apptOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Appointment not found");
        }
        CounsellingAppointment appt = apptOpt.get();

        if (!"COMPLETED".equalsIgnoreCase(appt.getStatus())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Can only rate a completed session");
        }
        if (appt.getCounsellor() == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Appointment has no counsellor to rate");
        }

        if (ratingRepository.findByAppointmentId(req.appointmentId).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("This session has already been rated");
        }

        CounsellingRating rating = new CounsellingRating();
        rating.setAppointment(appt);
        rating.setCounsellor(appt.getCounsellor());
        rating.setStudent(appt.getStudent());
        rating.setRating(req.rating);
        rating.setReview(req.review);

        CounsellingRating saved = ratingRepository.save(rating);
        logger.info("Rating {} saved for appointment {}", req.rating, req.appointmentId);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/by-appointment/{appointmentId}")
    public ResponseEntity<?> getByAppointment(@PathVariable Long appointmentId) {
        return ratingRepository.findByAppointmentId(appointmentId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/pending-for-student/{studentId}")
    public ResponseEntity<?> pendingForStudent(@PathVariable Long studentId) {
        List<CounsellingAppointment> unrated =
                ratingRepository.findUnratedCompletedAppointmentsForStudent(studentId);
        return ResponseEntity.ok(unrated);
    }

    @GetMapping("/summary-by-counsellor")
    public ResponseEntity<List<Map<String, Object>>> summaryByCounsellor() {
        List<Object[]> rows = ratingRepository.summaryByCounsellor();
        List<Map<String, Object>> out = new java.util.ArrayList<>();
        for (Object[] row : rows) {
            Map<String, Object> m = new HashMap<>();
            m.put("counsellorId", row[0]);
            m.put("count", row[1] == null ? 0L : ((Number) row[1]).longValue());
            m.put("average", row[2] == null ? 0.0 : ((Number) row[2]).doubleValue());
            out.add(m);
        }
        return ResponseEntity.ok(out);
    }

    @GetMapping("/by-counsellor/{counsellorId}")
    public ResponseEntity<?> byCounsellor(@PathVariable Long counsellorId) {
        Optional<Counsellor> c = counsellorRepository.findById(counsellorId);
        if (!c.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        List<CounsellingRating> list = ratingRepository.findByCounsellorId(counsellorId);
        Double avg = ratingRepository.averageRatingForCounsellor(counsellorId);
        Map<String, Object> body = new HashMap<>();
        body.put("counsellorId", counsellorId);
        body.put("count", list.size());
        body.put("average", avg == null ? 0.0 : avg);
        body.put("ratings", list);
        return ResponseEntity.ok(body);
    }
}
