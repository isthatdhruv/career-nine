package com.kccitm.api.service.counselling;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

import com.kccitm.api.exception.DuplicateResourceException;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.counselling.Counsellor;
import com.kccitm.api.model.career9.counselling.StudentCounsellorMapping;
import com.kccitm.api.repository.UserRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.Career9.counselling.CounsellorRepository;
import com.kccitm.api.repository.Career9.counselling.StudentCounsellorMappingRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Covers the reassign-in-place semantics of {@link StudentCounsellorMappingService}: one row per
 * student ({@code uk_scm_student}), so assigning to a new counsellor moves that row instead of
 * adding a second active one — which, with the unique key, would now fail outright.
 */
class StudentCounsellorMappingServiceTest {

    private StudentCounsellorMappingRepository mappingRepository;
    private CounsellorRepository counsellorRepository;
    private UserStudentRepository userStudentRepository;
    private UserRepository userRepository;
    private StudentCounsellorMappingService service;

    @BeforeEach
    void setUp() {
        mappingRepository = mock(StudentCounsellorMappingRepository.class);
        counsellorRepository = mock(CounsellorRepository.class);
        userStudentRepository = mock(UserStudentRepository.class);
        userRepository = mock(UserRepository.class);
        service = new StudentCounsellorMappingService();
        ReflectionTestUtils.setField(service, "mappingRepository", mappingRepository);
        ReflectionTestUtils.setField(service, "counsellorRepository", counsellorRepository);
        ReflectionTestUtils.setField(service, "userStudentRepository", userStudentRepository);
        ReflectionTestUtils.setField(service, "userRepository", userRepository);
        when(mappingRepository.save(any(StudentCounsellorMapping.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static Counsellor counsellor(long id) {
        Counsellor c = new Counsellor();
        c.setId(id);
        c.setName("Counsellor " + id);
        return c;
    }

    private static StudentCounsellorMapping mapping(long id, long studentId, Counsellor c, boolean active) {
        UserStudent us = new UserStudent();
        us.setUserStudentId(studentId);
        StudentCounsellorMapping m = new StudentCounsellorMapping();
        m.setId(id);
        m.setStudent(us);
        m.setCounsellor(c);
        m.setIsActive(active);
        return m;
    }

    @Test
    @DisplayName("Reassigning moves the student's one row to the new counsellor, in place")
    void reassignUpdatesRowInPlace() {
        StudentCounsellorMapping existing = mapping(9L, 5L, counsellor(1L), true);
        when(mappingRepository.findByStudentUserStudentId(5L)).thenReturn(Optional.of(existing));
        Counsellor b = counsellor(2L);
        when(counsellorRepository.findById(2L)).thenReturn(Optional.of(b));

        StudentCounsellorMapping saved = service.assignStudentToCounsellor(5L, 2L, null, "moved");

        assertSame(existing, saved);
        assertEquals(Long.valueOf(9L), saved.getId());
        assertSame(b, saved.getCounsellor());
        assertTrue(saved.getIsActive());
        assertNotNull(saved.getAssignedAt());
        assertEquals("moved", saved.getNotes());
        verify(mappingRepository, times(1)).save(existing);
        // The old (counsellor, student) lookup would find nothing here and insert a duplicate.
        verify(mappingRepository, never()).findByCounsellorIdAndStudentUserStudentId(anyLong(), anyLong());
        verify(userStudentRepository, never()).findById(anyLong());
    }

    @Test
    @DisplayName("An inactive row is reactivated for the new counsellor rather than duplicated")
    void inactiveRowIsReused() {
        StudentCounsellorMapping existing = mapping(9L, 5L, counsellor(1L), false);
        when(mappingRepository.findByStudentUserStudentId(5L)).thenReturn(Optional.of(existing));
        when(counsellorRepository.findById(3L)).thenReturn(Optional.of(counsellor(3L)));

        StudentCounsellorMapping saved = service.assignStudentToCounsellor(5L, 3L, null, null);

        assertSame(existing, saved);
        assertEquals(Long.valueOf(3L), saved.getCounsellor().getId());
        assertTrue(saved.getIsActive());
    }

    @Test
    @DisplayName("Assigning to the counsellor the student already has is still refused")
    void sameCounsellorIsDuplicate() {
        when(mappingRepository.findByStudentUserStudentId(5L))
                .thenReturn(Optional.of(mapping(9L, 5L, counsellor(1L), true)));

        assertThrows(DuplicateResourceException.class, () -> service.assignStudentToCounsellor(5L, 1L, null, null));
        verify(mappingRepository, never()).save(any());
    }

    @Test
    @DisplayName("A student with no row gets a new one")
    void unmappedStudentIsInserted() {
        when(mappingRepository.findByStudentUserStudentId(5L)).thenReturn(Optional.empty());
        UserStudent us = new UserStudent();
        us.setUserStudentId(5L);
        when(userStudentRepository.findById(5L)).thenReturn(Optional.of(us));
        when(counsellorRepository.findById(2L)).thenReturn(Optional.of(counsellor(2L)));

        StudentCounsellorMapping saved = service.assignStudentToCounsellor(5L, 2L, null, null);

        assertSame(us, saved.getStudent());
        assertEquals(Long.valueOf(2L), saved.getCounsellor().getId());
    }

    @Test
    @DisplayName("Bulk assign: one failing student is skipped, the rest are still written")
    void bulkAssignSurvivesOneFailure() {
        when(counsellorRepository.findById(2L)).thenReturn(Optional.of(counsellor(2L)));
        for (long sid : new long[] {1L, 2L, 3L}) {
            when(mappingRepository.findByStudentUserStudentId(sid))
                    .thenReturn(Optional.of(mapping(100 + sid, sid, counsellor(1L), true)));
        }
        when(mappingRepository.save(any(StudentCounsellorMapping.class))).thenAnswer(inv -> {
            StudentCounsellorMapping m = inv.getArgument(0);
            if (m.getStudent().getUserStudentId() == 2L) {
                throw new DataIntegrityViolationException("uk_scm_student");
            }
            return m;
        });

        List<StudentCounsellorMapping> written = service.bulkAssign(2L, Arrays.asList(1L, 2L, 3L), null);

        assertEquals(2, written.size());
        assertEquals(Long.valueOf(1L), written.get(0).getStudent().getUserStudentId());
        assertEquals(Long.valueOf(3L), written.get(1).getStudent().getUserStudentId());
    }

    @Test
    @DisplayName("The offline page's upsert goes through the native one-statement repository call")
    void upsertDelegatesToNativeUpsert() {
        service.upsertActiveMapping(5L, 2L, 77L);

        ArgumentCaptor<java.time.LocalDateTime> at = ArgumentCaptor.forClass(java.time.LocalDateTime.class);
        verify(mappingRepository).upsertActive(eq(5L), eq(2L), eq(77L), at.capture());
        assertNotNull(at.getValue());
    }
}
