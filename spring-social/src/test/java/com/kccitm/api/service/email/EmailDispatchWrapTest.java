package com.kccitm.api.service.email;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import com.kccitm.api.model.email.*;
import com.kccitm.api.model.userDefinedModel.SmtpEmailRequest;
import com.kccitm.api.repository.email.*;
import com.kccitm.api.service.email.theme.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class EmailDispatchWrapTest {
    private EmailDispatchService dispatch;
    private ConfiguredEmailSender sender;
    private EmailAccount account;

    @BeforeEach
    void setUp() {
        dispatch = new EmailDispatchService();
        account = new EmailAccount(); account.setId(1L); account.setActive(true); account.setFromEmail("n@career-9.net"); account.setFromName("Career-9");
        EmailAccountRepository accounts = mock(EmailAccountRepository.class);
        when(accounts.findFirstByIsGlobalDefaultTrueAndActiveTrue()).thenReturn(java.util.Optional.of(account));
        EmailTemplateRepository templates = mock(EmailTemplateRepository.class);
        when(templates.findFirstByEmailTypeAndIsDefaultTrueAndActiveTrue(anyString())).thenReturn(java.util.Optional.empty());
        EmailSendLogRepository logs = mock(EmailSendLogRepository.class);
        when(logs.save(any())).thenAnswer(i -> i.getArgument(0));
        sender = mock(ConfiguredEmailSender.class);
        SenderFactory factory = mock(SenderFactory.class);
        when(factory.forAccount(any())).thenReturn(sender);
        BrandResolver brands = mock(BrandResolver.class);
        when(brands.forRequest(any())).thenReturn(Brand.standard("https://cdn/logo.png", "support@career-9.net", "https://career-9.com", 2026));
        MailLinks links = mock(MailLinks.class);
        when(links.rewrite(anyString())).thenAnswer(i -> i.getArgument(0));
        ReflectionTestUtils.setField(dispatch, "accountRepository", accounts);
        ReflectionTestUtils.setField(dispatch, "templateRepository", templates);
        ReflectionTestUtils.setField(dispatch, "logRepository", logs);
        ReflectionTestUtils.setField(dispatch, "senderFactory", factory);
        ReflectionTestUtils.setField(dispatch, "placeholderResolver", mock(PlaceholderResolver.class));
        ReflectionTestUtils.setField(dispatch, "templateRenderer", new EmailTemplateRenderer());
        ReflectionTestUtils.setField(dispatch, "instituteEmailSettingService", mock(InstituteEmailSettingService.class));
        ReflectionTestUtils.setField(dispatch, "brandResolver", brands);
        ReflectionTestUtils.setField(dispatch, "mailRenderer", new MailRenderer());
        ReflectionTestUtils.setField(dispatch, "mailLinks", links);
    }

    private SmtpEmailRequest sent() throws Exception {
        ArgumentCaptor<SmtpEmailRequest> c = ArgumentCaptor.forClass(SmtpEmailRequest.class);
        verify(sender).send(c.capture());
        return c.getValue();
    }

    @Test
    void aMailIsRenderedWithShellAndTextPart() throws Exception {
        Mail m = Mail.builder().subject("Your login details").preheader("Inside.").title("Your login details").p("Hi Aarav,").signature().build();
        EmailSendRequest r = EmailSendRequest.mail(EmailType.LOGIN_CREDENTIALS, "a@example.com", m);
        r.setDeliveryModeOverride(EmailDeliveryMode.SYNC);
        dispatch.send(r);
        SmtpEmailRequest s = sent();
        assertEquals("Your login details", s.getSubject());
        assertTrue(s.getHtmlContent().contains(MailTheme.SHELL_MARKER));
        assertTrue(s.getTextContent().contains("Hi Aarav,"));
    }

    @Test
    void passThroughHtmlIsWrappedOnce() throws Exception {
        EmailSendRequest r = EmailSendRequest.html(EmailType.GENERIC, "a@example.com", "Hello", "<p>Dear Mr Menon, reports attached.</p>");
        r.setDeliveryModeOverride(EmailDeliveryMode.SYNC);
        dispatch.send(r);
        SmtpEmailRequest s = sent();
        assertEquals(1, s.getHtmlContent().split(MailTheme.SHELL_MARKER, -1).length - 1);
        assertTrue(s.getHtmlContent().contains("Dear Mr Menon, reports attached."));
        assertEquals("Dear Mr Menon, reports attached.", s.getTextContent().trim());
    }

    @Test
    void plainTextIsWrappedAsParagraphs() throws Exception {
        EmailSendRequest r = new EmailSendRequest();
        r.setEmailType(EmailType.GENERIC); r.getTo().add("a@example.com"); r.setSubject("Hi"); r.setTextContent("Line one <x>\n\nLine two");
        r.setDeliveryModeOverride(EmailDeliveryMode.SYNC);
        dispatch.send(r);
        SmtpEmailRequest s = sent();
        assertTrue(s.getHtmlContent().contains("Line one &lt;x&gt;"));
        assertEquals("Line one <x>\n\nLine two", s.getTextContent());
    }
}
