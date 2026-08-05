package com.kccitm.api.service.counselling;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.Counsellor;

/**
 * Supplies the meeting link for an ONLINE counselling appointment.
 *
 * Sessions run on Microsoft Teams and nothing else. Each counsellor holds one
 * permanent Teams link on their profile — a recurring meeting or "Meet now" link
 * they own — and every online session of theirs uses it. There is no generated
 * fallback: if a counsellor has no Teams link the appointment gets none, which
 * the emails and calendar invite already handle by omitting the line.
 *
 * Teams' default lobby holds external joiners until the counsellor admits them,
 * so reusing one room across sessions does not let a student walk into someone
 * else's appointment.
 */
@Service
public class MeetingLinkService {

    private static final Logger logger = LoggerFactory.getLogger(MeetingLinkService.class);

    /** The counsellor's permanent Teams link, or null when they haven't set one. */
    public String generateMeetLink(CounsellingAppointment appointment) {
        if (appointment == null) return null;
        Counsellor counsellor = appointment.getCounsellor();
        String link = counsellor != null ? counsellor.getMeetingLink() : null;

        if (isTeamsLink(link)) {
            String trimmed = link.trim();
            logger.info("Using counsellor {} Teams link for appointment {}",
                    counsellor.getId(), appointment.getId());
            return trimmed;
        }

        logger.warn("Counsellor {} has no Teams meeting link — appointment {} will have no meeting link",
                counsellor != null ? counsellor.getId() : "null", appointment.getId());
        return null;
    }

    /**
     * True for a Microsoft Teams join URL — {@code teams.microsoft.com} (work/school)
     * or {@code teams.live.com} (personal). Anything else is rejected, so no other
     * provider's link can be stored or handed to a student.
     */
    public static boolean isTeamsLink(String link) {
        if (link == null) return false;
        String v = link.trim().toLowerCase();
        return v.startsWith("https://teams.microsoft.com/")
                || v.startsWith("https://teams.live.com/");
    }

    /**
     * Sets a manually provided meeting link on the appointment (admin override for a
     * one-off session). Still Teams-only.
     */
    public void setManualLink(CounsellingAppointment appointment, String link) {
        appointment.setMeetingLink(link);
        appointment.setMeetingLinkSource("MANUAL");
        logger.info("Set manual meeting link for appointment ID {}: {}", appointment.getId(), link);
    }
}
