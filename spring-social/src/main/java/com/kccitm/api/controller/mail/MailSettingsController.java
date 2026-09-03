package com.kccitm.api.controller.mail;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.mail.MailSettings;
import com.kccitm.api.service.mail.MailSettingsService;

/** The Settings tab: engine switch, daily ceiling and reserve, pacing, quiet hours, staging sink. */
@RestController
@RequestMapping("/mail-settings")
public class MailSettingsController {

    @Autowired
    private MailSettingsService settings;

    @PreAuthorize("@auth.allows('mail_automation.read')")
    @GetMapping("")
    public ResponseEntity<?> get() {
        return ResponseEntity.ok(settings.reload());
    }

    @PreAuthorize("@auth.allows('mail_automation.edit')")
    @PutMapping("")
    public ResponseEntity<?> update(@RequestBody MailSettings body) {
        try {
            return ResponseEntity.ok(settings.update(body, MailAutomationController.currentUserId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(MailAutomationController.error(e.getMessage()));
        }
    }
}
