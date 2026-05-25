package com.kccitm.api.service.counselling;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.kccitm.api.model.career9.counselling.CounsellingAppointment;

@Service
public class MeetingLinkService {

    private static final Logger logger = LoggerFactory.getLogger(MeetingLinkService.class);

    /**
     * Generates a Google Meet-style link using a UUID-derived room code.
     * Format: https://meet.google.com/xxx-xxxx-xxxx
     */
    public String generateMeetLink(CounsellingAppointment appointment) {
        try {
            String uuid = UUID.randomUUID().toString().replace("-", "").substring(0, 12).toLowerCase();
            String formattedRoom = uuid.substring(0, 3) + "-" + uuid.substring(3, 7) + "-" + uuid.substring(7, 11);
            String link = "https://meet.google.com/" + formattedRoom;
            logger.info("Generated meeting link for appointment ID {}: {}", appointment.getId(), link);
            return link;
        } catch (Exception e) {
            logger.error("Failed to generate meeting link for appointment ID {}: {}",
                    appointment != null ? appointment.getId() : "null", e.getMessage());
            return null;
        }
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
