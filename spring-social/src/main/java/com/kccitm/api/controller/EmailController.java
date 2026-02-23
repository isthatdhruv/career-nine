package com.kccitm.api.controller;

import java.util.Arrays;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.cribbstechnologies.clients.mandrill.exception.RequestFailedException;
import com.cribbstechnologies.clients.mandrill.model.MandrillRecipient;
import com.cribbstechnologies.clients.mandrill.model.response.message.SendMessageResponse;
import com.kccitm.api.service.EmailService;
import com.kccitm.api.service.SmtpEmailService;
import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;


@RestController
public class EmailController {
@Autowired
EmailService emailService;

@Autowired
SmtpEmailService smtpEmailService;

	@GetMapping(value = "email-test/get", headers = "Accept=application/json")
	public SendMessageResponse getEmail() throws RequestFailedException {
        MandrillRecipient[] recipient = {
            new MandrillRecipient(
                    "kcc",
                    "kccproject75@gmail.com"
            )};
	    return emailService.sendMessage("testing", recipient, "Bhavya", "bhavya@kccitm.edu.in", "hello");
	}

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

			smtpEmailService.sendEmail(request);
			return ResponseEntity.ok("Email sent successfully");
		} catch (Exception e) {
			return ResponseEntity.status(500).body("Email failed: " + e.getMessage());
		}
	}
}