package com.kccitm.api.controller.career9.counselling;

import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.SessionNotes;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.service.counselling.SessionNotesService;

@RestController
@RequestMapping("/api/session-notes")
public class SessionNotesController {

    private static final Logger logger = LoggerFactory.getLogger(SessionNotesController.class);

    @Autowired
    private SessionNotesService sessionNotesService;

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/create")
    public ResponseEntity<?> create(@RequestBody SessionNotes notes, @RequestParam Long userId) {
        try {
            Optional<User> userOpt = userRepository.findById(userId);
            if (!userOpt.isPresent()) {
                return ResponseEntity.badRequest().body("User not found with id: " + userId);
            }
            User user = userOpt.get();
            SessionNotes created = sessionNotesService.create(notes, user);
            logger.info("Session notes created for userId: {}", userId);
            return ResponseEntity.ok(created);
        } catch (Exception e) {
            logger.error("Error creating session notes for userId {}: {}", userId, e.getMessage());
            return ResponseEntity.badRequest().body("Error creating session notes: " + e.getMessage());
        }
    }

    @GetMapping("/get/{appointmentId}")
    public ResponseEntity<SessionNotes> getByAppointment(
            @PathVariable Long appointmentId,
            @RequestParam(defaultValue = "false") boolean isStudent) {
        Optional<SessionNotes> result;
        if (isStudent) {
            result = sessionNotesService.getByAppointmentIdForStudent(appointmentId);
        } else {
            result = sessionNotesService.getByAppointmentId(appointmentId);
        }
        return result
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<SessionNotes> update(@PathVariable Long id, @RequestBody SessionNotes notes) {
        logger.info("Updating session notes with id: {}", id);
        return ResponseEntity.ok(sessionNotesService.update(id, notes));
    }
}
