package com.kccitm.api.service.email;

import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import com.kccitm.api.model.email.EmailTemplate;
import com.kccitm.api.model.reminder.ReminderConfig;
import com.kccitm.api.model.reminder.ReminderServiceType;
import com.kccitm.api.repository.email.EmailTemplateRepository;
import com.kccitm.api.service.reminder.ReminderConfigService;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MailSeedUpgraderTest {

    private MailSeedUpgrader upgrader;
    private EmailTemplateRepository templateRepository;
    private ReminderConfigService reminderConfigService;

    @BeforeEach
    void setUp() {
        upgrader = new MailSeedUpgrader();
        templateRepository = mock(EmailTemplateRepository.class);
        reminderConfigService = mock(ReminderConfigService.class);
        // Every type the runner touches defaults to a no-op (no row / no config) so a test only
        // needs to stub the one call it cares about.
        when(templateRepository.findByEmailTypeOrderByNameAsc(anyString())).thenReturn(Collections.emptyList());
        when(reminderConfigService.get(any())).thenReturn(null);
        ReflectionTestUtils.setField(upgrader, "templateRepository", templateRepository);
        ReflectionTestUtils.setField(upgrader, "reminderConfigService", reminderConfigService);
    }

    @Test
    void onlyUntouchedSeedsAreReplaced() {
        assertTrue(MailSeedUpgrader.isUntouched("<p>old</p>", "<p>old</p>"));
        assertTrue(MailSeedUpgrader.isUntouched("<p>old</p>\n", "<p>old</p>"), "whitespace at the ends does not count as an edit");
        assertFalse(MailSeedUpgrader.isUntouched("<p>old edited</p>", "<p>old</p>"));
        assertFalse(MailSeedUpgrader.isUntouched(null, "<p>old</p>"));
    }

    @Test
    void subjectEditedRowIsLeftAlone() {
        ReminderConfig cfg = new ReminderConfig();
        cfg.setServiceType(ReminderServiceType.COUNSELLING_1H);
        cfg.setBodyTemplate(LegacySeeds.REMINDER_COUNSELLING_1H);
        cfg.setSubjectTemplate("Your session starts soon!"); // admin edited the subject only
        when(reminderConfigService.get(ReminderServiceType.COUNSELLING_1H)).thenReturn(cfg);

        upgrader.run(null);

        verify(reminderConfigService, never()).updateTemplate(any(), any(), any(), any());
    }

    @Test
    void untouchedRowIsUpgradedOnce() {
        EmailTemplate t = new EmailTemplate();
        t.setId(42L);
        t.setSubjectTemplate(LegacySeeds.LEAD_WELCOME_SUBJECT);
        t.setBodyTemplate(LegacySeeds.LEAD_WELCOME_BODY);
        when(templateRepository.findByEmailTypeOrderByNameAsc("LEAD_WELCOME")).thenReturn(List.of(t));
        when(templateRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        upgrader.run(null);

        ArgumentCaptor<EmailTemplate> captor = ArgumentCaptor.forClass(EmailTemplate.class);
        verify(templateRepository, times(1)).save(captor.capture());
        EmailTemplate saved = captor.getValue();
        assertEquals("Thanks for getting in touch with Career-9", saved.getSubjectTemplate());
        assertTrue(saved.getBodyTemplate().contains("Thanks for getting in touch"));
    }

    @Test
    void oneFailureDoesNotStopTheOthers() {
        when(templateRepository.findByEmailTypeOrderByNameAsc("LOGIN_CREDENTIALS")).thenThrow(new RuntimeException("db down"));
        EmailTemplate t = new EmailTemplate();
        t.setId(7L);
        t.setSubjectTemplate(LegacySeeds.LEAD_WELCOME_SUBJECT);
        t.setBodyTemplate(LegacySeeds.LEAD_WELCOME_BODY);
        when(templateRepository.findByEmailTypeOrderByNameAsc("LEAD_WELCOME")).thenReturn(List.of(t));
        when(templateRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        upgrader.run(null);

        verify(templateRepository, times(1)).save(any());
    }
}
