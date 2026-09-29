package com.kccitm.api.controller.career9.counselling;

import java.time.LocalTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;
import com.kccitm.api.repository.Career9.counselling.CounsellingAppointmentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellingSlotRepository;
import com.kccitm.api.service.counselling.CounsellingClock;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * The counsellor dashboard's "today" list leaves out sessions recorded from the offline page
 * (nothing to start or check in), while the completed count keeps them.
 */
class CounsellorDashboardSummaryOfflineTest {

    private static CounsellingAppointment appt(long id, String status, String origin) {
        CounsellingSlot slot = new CounsellingSlot();
        slot.setStartTime(origin != null ? LocalTime.MIDNIGHT : LocalTime.of(15, 0));
        CounsellingAppointment a = new CounsellingAppointment();
        a.setId(id);
        a.setStatus(status);
        a.setOrigin(origin);
        a.setSlot(slot);
        return a;
    }

    @Test
    @SuppressWarnings("unchecked")
    void todayListSkipsOfflineRecordsButCompletedCountDoesNot() {
        CounsellingAppointmentRepository appointments = Mockito.mock(CounsellingAppointmentRepository.class);
        CounsellingSlotRepository slots = Mockito.mock(CounsellingSlotRepository.class);
        CounsellorController controller = new CounsellorController();
        ReflectionTestUtils.setField(controller, "clock", new CounsellingClock("Asia/Kolkata"));
        ReflectionTestUtils.setField(controller, "appointmentRepository", appointments);
        ReflectionTestUtils.setField(controller, "slotRepository", slots);

        when(appointments.findByCounsellorIdAndDate(eq(10L), any())).thenReturn(Arrays.asList(
                appt(1, "COMPLETED", CounsellingAppointment.ORIGIN_OFFLINE_RECORD),
                appt(2, "CONFIRMED", null),
                appt(3, "COMPLETED", CounsellingAppointment.ORIGIN_OFFLINE_RECORD)));
        when(slots.findByCounsellorIdAndDateBetween(anyLong(), any(), any())).thenReturn(Collections.emptyList());
        when(appointments.countByCounsellorAndStatusInRange(anyLong(), anyString(), any(), any())).thenReturn(0L);
        when(appointments.countByCounsellorAndStatusInRange(eq(10L), eq("COMPLETED"), any(), any())).thenReturn(7L);

        ResponseEntity<?> resp = controller.dashboardSummary(10L);
        Map<String, Object> body = (Map<String, Object>) resp.getBody();

        List<Map<String, Object>> today = (List<Map<String, Object>>) body.get("todaysAppointments");
        assertEquals(1, today.size());
        assertEquals(2L, today.get(0).get("appointmentId"));
        assertEquals(1, body.get("todayCount"));
        assertEquals(7L, body.get("completedCount"));
    }
}
