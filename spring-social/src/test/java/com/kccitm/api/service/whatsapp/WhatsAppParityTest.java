package com.kccitm.api.service.whatsapp;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.kccitm.api.model.email.EmailSendRequest;
import com.kccitm.api.model.email.EmailType;
import com.kccitm.api.model.whatsapp.WhatsAppMessage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * One email, one WhatsApp. Per person, every time.
 *
 * <p>These are counting tests, and they exist because the counts came apart twice while this was
 * being built — in both directions. First too few: WhatsApp was sent <i>instead of</i> the email
 * on some flows and not at all on most. Then too many: numbers were carried as a loose list of
 * "everyone this appointment concerns", so a cancellation addressed to the counsellor alone put
 * the same message on the student's and the parent's phones as well. Both read as a broken
 * system to whoever is on the receiving end, and neither shows up in a log that only records
 * what was sent.
 *
 * <p>So the rule is asserted as arithmetic: the number of messages equals the number of people
 * the email went to who have a number on record.
 */
class WhatsAppParityTest {

    private WhatsAppDispatchService dispatcher;
    private WhatsAppRecipientResolver resolver;

    private static final String STUDENT = "asha@example.com";
    private static final String PARENT = "parent@example.com";
    private static final String COUNSELLOR = "counsellor@career-9.com";

    @BeforeEach
    void setUp() {
        dispatcher = new WhatsAppDispatchService();
        resolver = mock(WhatsAppRecipientResolver.class);
        // Nothing is on record unless a test says so, so every number in these cases is one the
        // caller supplied — which is the case the pairing has to get right.
        when(resolver.resolve(anyString())).thenReturn(null);
        ReflectionTestUtils.setField(dispatcher, "recipientResolver", resolver);
        // A real transport, not a mock: the dispatcher asks it whether two numbers are the same
        // person, and that answer is exactly what these tests are checking.
        ReflectionTestUtils.setField(dispatcher, "whatsAppService",
                new com.kccitm.api.service.counselling.WhatsAppService());
    }

    private EmailSendRequest mailTo(String... addresses) {
        EmailSendRequest req = new EmailSendRequest();
        req.setEmailType(EmailType.COUNSELLING_NOTIFICATION);
        req.setTo(Arrays.asList(addresses));
        return req;
    }

    /** The message a counselling mail carries: a number for each person who might be written to. */
    private WhatsAppMessage everyoneOnTheAppointment() {
        return new WhatsAppMessage()
                .forAddress(STUDENT, "9811111111")
                .forAddress(PARENT, "9822222222")
                .forAddress(COUNSELLOR, "9833333333");
    }

    /**
     * The regression. A cancellation goes to one side only; the message it carries knows all
     * three numbers, because the same helper serves the student's copy and the counsellor's.
     * Only the person actually emailed may hear about it.
     */
    @Test
    void mailToOnePersonSendsOneMessage() {
        List<WhatsAppDispatchService.Target> targets =
                dispatcher.targets(mailTo(COUNSELLOR), everyoneOnTheAppointment());

        assertEquals(1, targets.size(), "one address must produce exactly one WhatsApp");
        assertEquals("9833333333", targets.get(0).phone, "and it must be that address's number");
    }

    /** The booking confirmation: three addressees on one send, three messages. */
    @Test
    void mailToThreePeopleSendsThreeMessages() {
        List<WhatsAppDispatchService.Target> targets =
                dispatcher.targets(mailTo(STUDENT, PARENT, COUNSELLOR), everyoneOnTheAppointment());

        assertEquals(3, targets.size());
        assertEquals(Arrays.asList("9811111111", "9822222222", "9833333333"),
                Arrays.asList(targets.get(0).phone, targets.get(1).phone, targets.get(2).phone));
    }

    /**
     * A student who gave her own number as the parent contact too is one person, and hears once.
     * Formatting differences do not make her two people.
     */
    @Test
    void onePersonOnTwoAddressesHearsOnce() {
        WhatsAppMessage wa = new WhatsAppMessage()
                .forAddress(STUDENT, "98111 11111")
                .forAddress(PARENT, "+91 9811111111");

        assertEquals(1, dispatcher.targets(mailTo(STUDENT, PARENT), wa).size());
    }

    /** Nobody reachable: no messages, and the caller logs it rather than pretending otherwise. */
    @Test
    void mailToSomeoneWithNoNumberSendsNothing() {
        assertEquals(0, dispatcher.targets(mailTo(STUDENT), new WhatsAppMessage()).size());
    }

    /** A number on record is used when the caller supplies none — same count either way. */
    @Test
    void numberOnRecordIsUsedWhenTheCallerSuppliesNone() {
        when(resolver.resolve(STUDENT)).thenReturn(
                new WhatsAppRecipientResolver.Recipient("9844444444", "Asha", "student"));

        List<WhatsAppDispatchService.Target> targets =
                dispatcher.targets(mailTo(STUDENT), new WhatsAppMessage());

        assertEquals(1, targets.size());
        assertEquals("9844444444", targets.get(0).phone);
        assertEquals("Asha", targets.get(0).name);
    }

    /** A caller-supplied number wins over the record, and still counts once. */
    @Test
    void callerSuppliedNumberWinsOverTheRecord() {
        when(resolver.resolve(STUDENT)).thenReturn(
                new WhatsAppRecipientResolver.Recipient("9844444444", "Asha", "student"));

        List<WhatsAppDispatchService.Target> targets =
                dispatcher.targets(mailTo(STUDENT), new WhatsAppMessage().forAddress(STUDENT, "9811111111"));

        assertEquals(1, targets.size());
        assertEquals("9811111111", targets.get(0).phone,
                "the number given at booking is the one the student actually uses");
    }

    /**
     * Cc and Bcc are not written to. Someone copied on a mail was kept informed at one remove,
     * and a message on their personal phone is not the same gesture.
     */
    @Test
    void copiedRecipientsAreNotMessaged() {
        EmailSendRequest req = mailTo(STUDENT);
        req.setCc(Arrays.asList(COUNSELLOR));
        req.setBcc(Arrays.asList(PARENT));

        assertEquals(1, dispatcher.targets(req, everyoneOnTheAppointment()).size());
    }

    /**
     * The address-less number, for a send that has no email to pair with — a nudge to a student
     * with a phone number and nothing else on file. The only case that may add a message the
     * email did not send, and only because the alternative is reaching nobody.
     */
    @Test
    void numberWithNoAddressIsStillReached() {
        List<WhatsAppDispatchService.Target> targets =
                dispatcher.targets(mailTo(), new WhatsAppMessage().toPhone("9855555555"));

        assertEquals(1, targets.size());
        assertEquals("9855555555", targets.get(0).phone);
    }

    /** Each recipient can carry their own wording; that does not change how many are sent. */
    @Test
    void perRecipientParamsDoNotChangeTheCount() {
        WhatsAppMessage wa = new WhatsAppMessage()
                .forAddress(STUDENT, "9811111111")
                .forAddress(COUNSELLOR, "9833333333", "Dr Rao",
                        Arrays.asList("Dr Rao", "12 March", "Online"));

        List<WhatsAppDispatchService.Target> targets = dispatcher.targets(mailTo(STUDENT, COUNSELLOR), wa);

        assertEquals(2, targets.size());
        assertEquals("Dr Rao", targets.get(1).name);
        assertEquals(Arrays.asList("Dr Rao", "12 March", "Online"), targets.get(1).params);
    }
}
