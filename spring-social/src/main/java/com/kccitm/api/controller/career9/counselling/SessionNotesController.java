package com.kccitm.api.controller.career9.counselling;

import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.exception.ResourceNotFoundException;
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

    // no scope arg: counsellor writes notes; scope-filter narrows access
    @PreAuthorize("@auth.allows('counselling.session_notes.create')")
    @PostMapping("/create")
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body, @RequestParam Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        Long appointmentId = body.get("appointmentId") != null
                ? Long.valueOf(body.get("appointmentId").toString())
                : null;

        SessionNotes notes = new SessionNotes();
        notes.setKeyDiscussionPoints(asString(body.get("keyDiscussionPoints")));
        notes.setActionItems(asString(body.get("actionItems")));
        notes.setRecommendedNextSession(asString(body.get("recommendedNextSession")));
        // FE sends "followUpRequired"; the entity field is "followupRequired" — accept either.
        Object followUp = body.containsKey("followUpRequired") ? body.get("followUpRequired") : body.get("followupRequired");
        notes.setFollowupRequired(followUp != null && Boolean.parseBoolean(followUp.toString()));
        notes.setPublicRemarks(asString(body.get("publicRemarks")));
        notes.setPrivateNotes(asString(body.get("privateNotes")));

        SessionNotes created = sessionNotesService.create(appointmentId, notes, user);
        logger.info("Session notes created for userId: {} appointment: {}", userId, appointmentId);
        return ResponseEntity.ok(created);
    }

    private static String asString(Object o) {
        return o == null ? null : o.toString();
    }

    // no scope arg: fetch by appointmentId
    @PreAuthorize("@auth.allows('counselling.session_notes.read')")
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
        return ResponseEntity.ok(result
                .orElseThrow(() -> new ResourceNotFoundException("SessionNotes", "appointmentId", appointmentId)));
    }

    // no scope arg: update by id
    @PreAuthorize("@auth.allows('counselling.session_notes.update')")
    @PutMapping("/update/{id}")
    public ResponseEntity<SessionNotes> update(@PathVariable Long id, @RequestBody SessionNotes notes) {
        logger.info("Updating session notes with id: {}", id);
        return ResponseEntity.ok(sessionNotesService.update(id, notes));
    }
}
