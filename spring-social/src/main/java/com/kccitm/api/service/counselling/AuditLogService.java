package com.kccitm.api.service.counselling;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.User;
import com.kccitm.api.model.career9.counselling.AppointmentAuditLog;
import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.repository.Career9.counselling.AppointmentAuditLogRepository;

@Service
public class AuditLogService {

    private static final Logger logger = LoggerFactory.getLogger(AuditLogService.class);

    @Autowired
    private AppointmentAuditLogRepository auditLogRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Async
    public void log(CounsellingAppointment appointment, String action, User performedBy,
            String reason, Map<String, Object> oldValues, Map<String, Object> newValues) {
        try {
            AppointmentAuditLog auditLog = new AppointmentAuditLog();
            auditLog.setAppointment(appointment);
            auditLog.setAction(action);
            auditLog.setPerformedBy(performedBy);
            auditLog.setReason(reason);

            if (oldValues != null) {
                auditLog.setOldValues(objectMapper.writeValueAsString(oldValues));
            }
            if (newValues != null) {
                auditLog.setNewValues(objectMapper.writeValueAsString(newValues));
            }

            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            logger.error("Failed to save audit log for appointment ID: {}. Action: {}. Error: {}",
                    appointment != null ? appointment.getId() : "null", action, e.getMessage());
        }
    }

    public void logSimple(CounsellingAppointment appointment, String action, User performedBy, String reason) {
        Map<String, Object> newValues = new HashMap<>();
        newValues.put("status", appointment.getStatus());
        log(appointment, action, performedBy, reason, null, newValues);
    }

    public List<AppointmentAuditLog> getLogsForAppointment(Long appointmentId) {
        return auditLogRepository.findByAppointmentIdOrderByTimestampDesc(appointmentId);
    }
}
