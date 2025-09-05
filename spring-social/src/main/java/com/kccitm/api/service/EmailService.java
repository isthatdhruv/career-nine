package com.kccitm.api.service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

import org.apache.http.client.HttpClient;
import org.apache.http.impl.client.DefaultHttpClient;
import org.springframework.stereotype.Service;

import com.cribbstechnologies.clients.mandrill.exception.RequestFailedException;
import com.cribbstechnologies.clients.mandrill.model.MandrillAttachment;
import com.cribbstechnologies.clients.mandrill.model.MandrillHtmlMessage;
import com.cribbstechnologies.clients.mandrill.model.MandrillMessageRequest;
import com.cribbstechnologies.clients.mandrill.model.MandrillRecipient;
import com.cribbstechnologies.clients.mandrill.model.response.message.SendMessageResponse;
import com.cribbstechnologies.clients.mandrill.request.MandrillMessagesRequest;
import com.cribbstechnologies.clients.mandrill.request.MandrillRESTRequest;
import com.cribbstechnologies.clients.mandrill.util.MandrillConfiguration;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.User;
import com.microtripit.mandrillapp.lutung.MandrillApi;
import com.microtripit.mandrillapp.lutung.model.MandrillApiError;
import com.microtripit.mandrillapp.lutung.view.MandrillMessage;
import com.microtripit.mandrillapp.lutung.view.MandrillMessage.MergeVar;
import com.microtripit.mandrillapp.lutung.view.MandrillMessage.MessageContent;
import com.microtripit.mandrillapp.lutung.view.MandrillMessage.Recipient;
import com.microtripit.mandrillapp.lutung.view.MandrillMessageStatus;

@Service
public class EmailService {
  private static final String API_VERSION = "1.0";
  private static final String BASE_URL = "https://mandrillapp.com/api";
  private static final String MANDRILL_API_KEY = "ABCDE";

  private static MandrillRESTRequest request = new MandrillRESTRequest();
  private static MandrillConfiguration config = new MandrillConfiguration();
  private static MandrillMessagesRequest messagesRequest = new MandrillMessagesRequest();
  private static HttpClient client = new DefaultHttpClient();
  private static ObjectMapper mapper = new ObjectMapper();

  public EmailService() {
    config.setApiKey("fP9M1EdclB4If4eAqxV7tQ");
    config.setApiVersion(API_VERSION);
    config.setBaseURL(BASE_URL);
    request.setConfig(config);
    request.setObjectMapper(mapper);
    request.setHttpClient(client);
    messagesRequest.setRequest(request);
  }

  public SendMessageResponse sendMessage(
      String subject,
      MandrillRecipient[] recipients,
      String senderName,
      String senderEmail,
      String content
  // List<MandrillAttachment> attachments
  )
      throws RequestFailedException {
    MandrillMessageRequest mmr = new MandrillMessageRequest();
    MandrillHtmlMessage message = new MandrillHtmlMessage();

    Map<String, String> headers = new HashMap<String, String>();
    message.setFrom_email(senderEmail);
    message.setFrom_name(senderName);
    message.setHeaders(headers);
    message.setHtml(content);
    message.setSubject(subject);
    // message.setAttachments(attachments);
    message.setTo(recipients);
    message.setTrack_clicks(true);
    message.setTrack_opens(true);
    mmr.setMessage(message);

    return messagesRequest.sendMessage(mmr);
  }

  public void sendMessageUsingTemplates(
      String subject,
      User recipientsUser,
      String senderName,
      String senderEmail,
      String templateName,
      Map<String, Object> data
  // List<MandrillAttachment> attachments
  )
      throws RequestFailedException, MandrillApiError, IOException {
    ArrayList<Recipient> recipients = new ArrayList<Recipient>();
    MandrillMessage message = new MandrillMessage();
    Recipient recipient = new Recipient();
    recipient.setEmail(recipientsUser.getEmail());
    recipient.setName(recipientsUser.getName());
    recipients.add(recipient);
    message.setTo(recipients);
    message.setPreserveRecipients(true);

    List<MergeVar> globalMergeVars = new ArrayList<>();
    MergeVar mergeVar = new MergeVar();
    Iterator<Entry<String, Object>> itr = data.entrySet().iterator();

    while (itr.hasNext()) {
      Entry<String, Object> entry = itr.next();
      mergeVar.setName(entry.getKey());
      mergeVar.setContent(entry.getValue());
      globalMergeVars.add(mergeVar);
      mergeVar = new MergeVar();
    }

    message.setGlobalMergeVars(globalMergeVars);

    message.setMergeLanguage("handlebars");

    // You must provide at least an empty template content
    Map<String, String> template_content = new HashMap<>();
    MandrillApi mandrillApi = new MandrillApi("WXX3fC00pJTZgonjnVvkgQ");
    // Send mail
    MandrillMessageStatus[] messageStatusReports = mandrillApi.messages().sendTemplate(templateName, template_content,
        message, false);
    System.out.println(messageStatusReports);
    if (messageStatusReports != null && messageStatusReports.length > 0) {
      System.out.println("Mail sent info: " + messageStatusReports[0].getStatus() + " More Information:"
          + messageStatusReports[0].getRejectReason());
    }
  }

  public void sendMessageUsingTemplatesAndAttachment(
      String subject,
      User recipientsUser,
      String senderName,
      String senderEmail,
      String templateName,
      Map<String, Object> data,
      String fileName,
      String fileType,
      ByteArrayInputStream file)
      throws RequestFailedException, MandrillApiError, IOException {
    ArrayList<Recipient> recipients = new ArrayList<Recipient>();
    MandrillMessage message = new MandrillMessage();
    Recipient recipient = new Recipient();
    recipient.setEmail(recipientsUser.getEmail());
    recipient.setName(recipientsUser.getName());
    recipients.add(recipient);
    message.setTo(recipients);
    message.setPreserveRecipients(true);
    MandrillAttachment ma = new MandrillAttachment(fileName, fileType, file + "");
    List<MergeVar> globalMergeVars = new ArrayList<>();
    MergeVar mergeVar = new MergeVar();
    Iterator<Entry<String, Object>> itr = data.entrySet().iterator();

    while (itr.hasNext()) {
      Entry<String, Object> entry = itr.next();
      mergeVar.setName(entry.getKey());
      mergeVar.setContent(entry.getValue());
      globalMergeVars.add(mergeVar);
      mergeVar = new MergeVar();
    }
    MessageContent mc = new MessageContent();
    message.setGlobalMergeVars(globalMergeVars);

    message.setMergeLanguage("handlebars");

    // You must provide at least an empty template content
    Map<String, String> template_content = new HashMap<>();
    MandrillApi mandrillApi = new MandrillApi("WXX3fC00pJTZgonjnVvkgQ");
    // Send mail
    MandrillMessageStatus[] messageStatusReports = mandrillApi.messages().sendTemplate(templateName, template_content,
        message, false);
    System.out.println(messageStatusReports);
    if (messageStatusReports != null && messageStatusReports.length > 0) {
      System.out.println("Mail sent info: " + messageStatusReports[0].getStatus() + " More Information:"
          + messageStatusReports[0].getRejectReason());
    }
  }
}
