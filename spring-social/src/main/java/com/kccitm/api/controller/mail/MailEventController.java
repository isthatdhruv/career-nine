package com.kccitm.api.controller.mail;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.service.mail.MailAutomationService;

/** The event catalogue: what the code reports, with fields, roles, dates and conditions per event. */
@RestController
@RequestMapping("/mail-events")
public class MailEventController {

    @Autowired
    private MailAutomationService service;

    @PreAuthorize("@auth.allows('mail_automation.read')")
    @GetMapping("")
    public ResponseEntity<?> list() {
        return ResponseEntity.ok(service.events());
    }
}
