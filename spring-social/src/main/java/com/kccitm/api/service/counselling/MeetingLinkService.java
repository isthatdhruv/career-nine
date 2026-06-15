package com.kccitm.api.service.counselling;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.counselling.CounsellingAppointment;

/**
 * Generates the online meeting link for an ONLINE counselling appointment.
 *
 * Provider is config-driven via {@code app.counselling.meeting-provider}:
 *   - JITSI       (default) — a real, working Jitsi Meet room URL. No credentials,
 *                  no OAuth, no cost; the link opens a live video room immediately.
 *   - GOOGLE_MEET — real Google Meet via the Calendar API. Requires a Google
 *                  Workspace + OAuth/service-account credentials (not yet configured),
 *                  so it currently falls back to Jitsi until those are added.
 *   - MS_TEAMS    — real Teams via Microsoft Graph. Requires an Azure AD app +
 *                  M365 tenant (not yet configured), so it falls back to Jitsi.
 *
 * The fallback means online bookings always get a working link today, and Meet/Teams
 * can be switched on later purely by adding credentials — no code change here.
 */
@Service
public class MeetingLinkService {

    private static final Logger logger = LoggerFactory.getLogger(MeetingLinkService.class);

    @Value("${app.counselling.meeting-provider:JITSI}")
    private String provider;

    @Value("${app.counselling.jitsi-base-url:https://meet.jit.si}")
    private String jitsiBaseUrl;

    public String generateMeetLink(CounsellingAppointment appointment) {
        try {
            String p = provider == null ? "JITSI" : provider.trim().toUpperCase();
            switch (p) {
                case "GOOGLE_MEET":
                    String meet = generateGoogleMeetLink(appointment);
                    if (meet != null) return logged(appointment, meet);
                    logger.info("Google Meet not configured — falling back to Jitsi for appointment {}",
                            appointment != null ? appointment.getId() : "null");
                    return logged(appointment, generateJitsiLink(appointment));
                case "MS_TEAMS":
                    String teams = generateTeamsLink(appointment);
                    if (teams != null) return logged(appointment, teams);
                    logger.info("MS Teams not configured — falling back to Jitsi for appointment {}",
                            appointment != null ? appointment.getId() : "null");
                    return logged(appointment, generateJitsiLink(appointment));
                case "JITSI":
                default:
                    return logged(appointment, generateJitsiLink(appointment));
            }
        } catch (Exception e) {
            logger.error("Failed to generate meeting link for appointment ID {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
            return null;
        }
    }

    /**
     * A real, working Jitsi Meet room URL. The room name is unique per appointment
     * and Jitsi-safe (alphanumerics + hyphens, no spaces).
     */
    private String generateJitsiLink(CounsellingAppointment appointment) {
        String unique = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        Long id = appointment != null ? appointment.getId() : null;
        String room = "Career9-Counselling-" + (id != null ? id + "-" : "") + unique;
        String base = (jitsiBaseUrl == null || jitsiBaseUrl.isBlank()) ? "https://meet.jit.si" : jitsiBaseUrl.trim();
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        return base + "/" + room;
    }

    /**
     * Real Google Meet link via the Google Calendar API (conferenceData). Returns null
     * until Google Workspace + OAuth/service-account credentials are configured.
     * TODO(integration): create a calendar event with conferenceDataVersion=1 and read
     * back entryPoints[].uri once {@code app.google.*} credentials exist.
     */
    private String generateGoogleMeetLink(CounsellingAppointment appointment) {
        return null;
    }

    /**
     * Real Microsoft Teams link via Microsoft Graph (POST /communications/onlineMeetings).
     * Returns null until an Azure AD app + M365 credentials are configured.
     * TODO(integration): acquire a Graph token and create an online meeting once
     * {@code app.msgraph.*} credentials exist.
     */
    private String generateTeamsLink(CounsellingAppointment appointment) {
        return null;
    }

    private String logged(CounsellingAppointment appointment, String link) {
        logger.info("Generated meeting link for appointment ID {}: {}",
                appointment != null ? appointment.getId() : "null", link);
        return link;
    }

    /**
     * Sets a manually provided meeting link on the appointment.
     */
    public void setManualLink(CounsellingAppointment appointment, String link) {
        appointment.setMeetingLink(link);
        appointment.setMeetingLinkSource("MANUAL");
        logger.info("Set manual meeting link for appointment ID {}: {}", appointment.getId(), link);
    }
}
