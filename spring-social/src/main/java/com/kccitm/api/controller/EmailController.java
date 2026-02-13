package com.kccitm.api.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cribbstechnologies.clients.mandrill.exception.RequestFailedException;
import com.cribbstechnologies.clients.mandrill.model.MandrillRecipient;
import com.cribbstechnologies.clients.mandrill.model.response.message.SendMessageResponse;
import com.kccitm.api.service.EmailService;


@RestController
public class EmailController {
@Autowired
EmailService emailService;
    
	@GetMapping(value = "email-test/get", headers = "Accept=application/json")
	public SendMessageResponse getEmail() throws RequestFailedException {
        MandrillRecipient[] recipient = {
            new MandrillRecipient(
                    "kcc",
                    "kccproject75@gmail.com"
            )};
	    return emailService.sendMessage("testing", recipient, "Bhavya", "bhavya@kccitm.edu.in", "hello");
	}
}