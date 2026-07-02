package com.kccitm.api.controller;

import java.util.Arrays;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.kccitm.api.exception.ServiceException;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;
import com.kccitm.api.service.email.EmailDispatchService;

@RestController
public class EmailController {

    @Autowired
    EmailDispatchService emailDispatchService;

    // no scope arg: email send with attachment; scope-less
    @PreAuthorize("@auth.allows('email.send')")
    @PostMapping("/email/send-with-attachment")
    public ResponseEntity<String> sendWithAttachment(
            @RequestParam("to") String to,
            @RequestParam("subject") String subject,
            @RequestParam("body") String body,
            @RequestParam("file") MultipartFile file) {
        try {
            SmtpEmailRequest request = new SmtpEmailRequest();
            Arrays.stream(to.split(","))
                    .map(String::trim)
                    .forEach(email -> request.getTo().add(email));
            request.setSubject(subject);
            request.setTextContent(body);

            SmtpEmailRequest.EmailAttachment attachment = new SmtpEmailRequest.EmailAttachment(
                    file.getOriginalFilename(), file.getBytes(), file.getContentType());
            request.getAttachments().add(attachment);

            emailDispatchService.send(EmailType.GENERIC, request, null);
            return ResponseEntity.ok("Email sent successfully");
        } catch (Exception e) {
            throw new ServiceException("Email failed: " + e.getMessage());
        }
    }
}
