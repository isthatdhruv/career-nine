package com.kccitm.api.service;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.persistence.EntityManager;
import javax.persistence.Query;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * {@link StudentPurgeService} and offline records: the synthetic slots are found while the
 * appointments still point at them, deleted only after the appointments (the slot is the FK
 * parent), and the student's OTP attempt counter goes too.
 */
class StudentPurgeOfflineRecordTest {

    private static final Long STUDENT = 42L;

    private EntityManager em;
    private final List<String> executed = new ArrayList<>();
    private List<Object> slotIdsFound;
    private StudentPurgeService service;

    @BeforeEach
    void setUp() {
        em = mock(EntityManager.class);
        UserStudentRepository userStudentRepository = mock(UserStudentRepository.class);
        StudentAssessmentMappingRepository samRepository = mock(StudentAssessmentMappingRepository.class);
        UserStudent us = new UserStudent();
        us.setUserStudentId(STUDENT);
        when(userStudentRepository.findById(STUDENT)).thenReturn(Optional.of(us));
        when(samRepository.findByUserStudentUserStudentId(STUDENT)).thenReturn(Collections.emptyList());

        // Every native statement is recorded in the order it runs.
        when(em.createNativeQuery(anyString())).thenAnswer(inv -> {
            String sql = inv.getArgument(0);
            Query q = mock(Query.class);
            when(q.setParameter(anyString(), any())).thenReturn(q);
            when(q.executeUpdate()).thenAnswer(x -> {
                executed.add(sql);
                return 1;
            });
            when(q.getResultList()).thenAnswer(x -> {
                executed.add(sql);
                return slotIdsFound;
            });
            return q;
        });

        service = new StudentPurgeService();
        ReflectionTestUtils.setField(service, "em", em);
        ReflectionTestUtils.setField(service, "userStudentRepository", userStudentRepository);
        ReflectionTestUtils.setField(service, "studentAssessmentMappingRepository", samRepository);
    }

    private int indexOf(String prefix) {
        for (int i = 0; i < executed.size(); i++) {
            if (executed.get(i).startsWith(prefix)) return i;
        }
        return -1;
    }

    @Test
    void syntheticSlotsAreCollectedBeforeAndDeletedAfterTheAppointments() {
        slotIdsFound = new ArrayList<>(Collections.singletonList(BigInteger.valueOf(301)));

        Map<String, Integer> counts = service.purge(STUDENT).deleted;

        int select = indexOf("SELECT ca.slot_id FROM counselling_appointment");
        int appointments = indexOf("DELETE FROM counselling_appointment ");
        int slots = indexOf("DELETE FROM counselling_slot ");
        assertTrue(select >= 0 && appointments >= 0 && slots >= 0, executed.toString());
        assertTrue(select < appointments, "slot ids must be read while the appointments exist");
        assertTrue(appointments < slots, "slots are the FK parent, so they go after the appointments");
        assertTrue(executed.get(select).contains("origin = 'OFFLINE_RECORD'"));
        assertTrue(executed.get(select).contains("block_reason = 'OFFLINE_RECORD'"));
        assertEquals(1, counts.get("counselling_slot (offline records)"));
    }

    @Test
    void otpGuardRowIsDeleted() {
        slotIdsFound = new ArrayList<>();
        Map<String, Integer> counts = service.purge(STUDENT).deleted;
        assertTrue(indexOf("DELETE FROM counselling_otp_guard WHERE student_id = :id") >= 0, executed.toString());
        assertTrue(counts.containsKey("counselling_otp_guard"));
    }

    @Test
    void noOfflineRecordsMeansNoSlotDelete() {
        slotIdsFound = new ArrayList<>();
        Map<String, Integer> counts = service.purge(STUDENT).deleted;
        assertEquals(-1, indexOf("DELETE FROM counselling_slot "));
        assertEquals(0, counts.get("counselling_slot (offline records)"));
    }
}
