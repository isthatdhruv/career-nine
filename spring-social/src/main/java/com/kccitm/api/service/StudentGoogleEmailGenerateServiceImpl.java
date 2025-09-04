package com.kccitm.api.service;

import java.util.ArrayList;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.userDefinedModel.EmailMessage;
import com.microtripit.mandrillapp.lutung.MandrillApi;
import com.microtripit.mandrillapp.lutung.logging.Logger;
import com.microtripit.mandrillapp.lutung.logging.LoggerFactory;
import com.microtripit.mandrillapp.lutung.view.MandrillMessage;
import com.microtripit.mandrillapp.lutung.view.MandrillMessageStatus;

@Service
public class StudentGoogleEmailGenerateServiceImpl implements StudentGoogleEmailGenerateService {
    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);

    @Autowired
    private MandrillApi mandrillApi;

    @Override
    public void resetPasswordMail(EmailMessage emailMessage) {

        MandrillMessage message = new MandrillMessage();
        message.setSubject(emailMessage.getSubject());
        message.setText(emailMessage.getTemplateName());
        message.setAutoText(true);
        message.setFromEmail(emailMessage.getFromEmail());
        message.setFromName(emailMessage.getFromName());

        ArrayList<MandrillMessage.Recipient> recipients = new ArrayList<>();
        for (String email : emailMessage.getTo()) {
            MandrillMessage.Recipient recipient = new MandrillMessage.Recipient();
            recipient.setEmail(email);
            // recipient.setName("optional name");
            recipient.setType(MandrillMessage.Recipient.Type.TO);
            recipients.add(recipient);
        }

        for (String email : emailMessage.getCc()) {
            MandrillMessage.Recipient recipient = new MandrillMessage.Recipient();
            recipient.setEmail(email);
            recipient.setType(MandrillMessage.Recipient.Type.CC);
            recipients.add(recipient);
        }
        message.setTo(recipients);
        message.setPreserveRecipients(true);
        try {
            // logger.info("Sending email to - {} with subject {}", emailMessage.getTo(),
            // emailMessage.getSubject());
            MandrillMessageStatus[] messageStatusReports = mandrillApi.messages().send(message, false);
            for (MandrillMessageStatus messageStatusReport : messageStatusReports) {
                final String status = messageStatusReport.getStatus();
                // logger.info("MessageStatusReports = " + status);
                if (status.equalsIgnoreCase("rejected") ||
                        status.equalsIgnoreCase("invalid")) {
                    // logger.error("Could not send email to {} status {}", emailMessage.getTo(),
                    // status);
                }
            }
        } catch (Exception e) {
            System.out.println(e);
        }
    }

}
