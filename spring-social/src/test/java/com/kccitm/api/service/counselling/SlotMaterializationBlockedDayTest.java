package com.kccitm.api.service.counselling;

import java.util.Arrays;
import java.util.Collections;

import org.junit.jupiter.api.Test;

import com.kccitm.api.model.career9.counselling.CounsellingAppointment;
import com.kccitm.api.model.career9.counselling.CounsellingSlot;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@link SlotMaterializationService#blocksDay}: the synthetic slot an offline record hangs on is
 * blocked, but it is a held session, not a day off, so it must not stop availability being
 * generated for that date.
 */
class SlotMaterializationBlockedDayTest {

    private static CounsellingSlot blocked(String status, String reason) {
        CounsellingSlot s = new CounsellingSlot();
        s.setIsBlocked(true);
        s.setStatus(status);
        s.setBlockReason(reason);
        return s;
    }

    @Test
    void noBlockedSlotsMeansAnOpenDay() {
        assertFalse(SlotMaterializationService.blocksDay(Collections.emptyList()));
        assertFalse(SlotMaterializationService.blocksDay(null));
    }

    @Test
    void offlineRecordSlotDoesNotBlockTheDay() {
        assertFalse(SlotMaterializationService.blocksDay(Collections.singletonList(
                blocked("COMPLETED", CounsellingAppointment.ORIGIN_OFFLINE_RECORD))));
    }

    @Test
    void revertedOfflineRecordSlotDoesNotBlockTheDay() {
        assertFalse(SlotMaterializationService.blocksDay(Collections.singletonList(
                blocked("CANCELLED", CounsellingAppointment.ORIGIN_OFFLINE_RECORD))));
    }

    @Test
    void aRealDateBlockStillBlocks() {
        assertTrue(SlotMaterializationService.blocksDay(Collections.singletonList(
                blocked("CANCELLED", "Date blocked: exam duty"))));
        assertTrue(SlotMaterializationService.blocksDay(Arrays.asList(
                blocked("COMPLETED", CounsellingAppointment.ORIGIN_OFFLINE_RECORD),
                blocked("AVAILABLE", null))));
    }
}
