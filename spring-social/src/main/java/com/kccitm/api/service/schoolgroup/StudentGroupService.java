package com.kccitm.api.service.schoolgroup;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.ContactPerson;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.group.StudentGroup;
import com.kccitm.api.model.career9.group.StudentGroupContact;
import com.kccitm.api.model.career9.group.StudentGroupMember;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.repository.ContactPersonRepository;
import com.kccitm.api.repository.Career9.StudentGroupContactRepository;
import com.kccitm.api.repository.Career9.StudentGroupMemberRepository;
import com.kccitm.api.repository.Career9.StudentGroupRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.repository.InstituteDetailRepository;

/**
 * Every invariant for student groups lives here, not in the controller.
 *
 * <p>The load-bearing one is {@link #assertSameInstitute}: a group may only hold
 * students, and may only be administered by contact persons, from its own
 * institute. Without that check group membership becomes a hole straight
 * through institute isolation — someone with {@code student_group.member.manage}
 * on School A could pull School B's students into an A-owned group and then read
 * them through the group endpoints, and (once the group ABAC dimension lands) a
 * cross-tenant contact person would inherit access to another school's students.
 *
 * <p>Groups are deliberately independent of session, class and section. Nothing
 * in this class reads or writes those; do not add a section filter here.
 */
@Service
public class StudentGroupService {

    private static final Logger logger = LoggerFactory.getLogger(StudentGroupService.class);

    @Autowired private StudentGroupRepository groupRepository;
    @Autowired private StudentGroupMemberRepository memberRepository;
    @Autowired private StudentGroupContactRepository contactRepository;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private ContactPersonRepository contactPersonRepository;
    @Autowired private InstituteDetailRepository instituteDetailRepository;

    /** Thrown for caller mistakes; the controller maps this to 400/404/409. */
    public static class GroupException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        private final int status;

        public GroupException(int status, String message) {
            super(message);
            this.status = status;
        }

        public int getStatus() {
            return status;
        }
    }

    /** Outcome of a bulk attach/detach, so the caller can report honestly. */
    public static class BulkResult {
        public int added;
        public int alreadyPresent;
        public int removed;
        public int notPresent;
        public int total;
    }

    // ══════════════════════════ GROUP CRUD ══════════════════════════

    @Transactional
    public StudentGroup create(Integer instituteCode, String name, String description, Long actorUserId) {
        if (instituteCode == null) {
            throw new GroupException(400, "instituteCode is required");
        }
        String cleanName = requireName(name);

        InstituteDetail institute = instituteDetailRepository.findById(instituteCode)
                .orElseThrow(() -> new GroupException(404, "Institute not found: " + instituteCode));

        groupRepository.findByInstitute_InstituteCodeAndNameIgnoreCase(instituteCode, cleanName)
                .ifPresent(existing -> {
                    throw new GroupException(409,
                            "A group named '" + existing.getName() + "' already exists in this school");
                });

        StudentGroup group = groupRepository.save(
                new StudentGroup(institute, cleanName, trimToNull(description), actorUserId));
        logger.info("Student group created: id={} name='{}' institute={} by user={}",
                group.getId(), group.getName(), instituteCode, actorUserId);
        return group;
    }

    @Transactional
    public StudentGroup update(Long groupId, String name, String description, Boolean active, Long actorUserId) {
        StudentGroup group = require(groupId);

        if (name != null) {
            String cleanName = requireName(name);
            // Renaming onto another group's name in the same school is a 409;
            // renaming to its own current name is a no-op, not a clash.
            Optional<StudentGroup> clash = groupRepository
                    .findByInstitute_InstituteCodeAndNameIgnoreCase(group.getInstituteCode(), cleanName);
            if (clash.isPresent() && !clash.get().getId().equals(group.getId())) {
                throw new GroupException(409,
                        "A group named '" + cleanName + "' already exists in this school");
            }
            group.setName(cleanName);
        }
        if (description != null) {
            group.setDescription(trimToNull(description));
        }
        if (active != null) {
            group.setActive(active);
        }
        group.setUpdatedBy(actorUserId);
        return groupRepository.save(group);
    }

    /**
     * Soft delete. The rows stay so that anything referencing the group — scope
     * grants, historical reports — does not dangle; an inactive group grants
     * nobody access and drops out of every list.
     */
    @Transactional
    public void deactivate(Long groupId, Long actorUserId) {
        StudentGroup group = require(groupId);
        group.setActive(Boolean.FALSE);
        group.setUpdatedBy(actorUserId);
        groupRepository.save(group);
        logger.info("Student group deactivated: id={} by user={}", groupId, actorUserId);
    }

    @Transactional(readOnly = true)
    public StudentGroup require(Long groupId) {
        if (groupId == null) {
            throw new GroupException(400, "groupId is required");
        }
        return groupRepository.findById(groupId)
                .orElseThrow(() -> new GroupException(404, "Student group not found: " + groupId));
    }

    @Transactional(readOnly = true)
    public List<StudentGroup> listByInstitute(Integer instituteCode, boolean includeInactive) {
        if (instituteCode == null) {
            throw new GroupException(400, "instituteCode is required");
        }
        return includeInactive
                ? groupRepository.findByInstitute_InstituteCodeOrderByNameAsc(instituteCode)
                : groupRepository.findByInstitute_InstituteCodeAndActiveTrueOrderByNameAsc(instituteCode);
    }

    // ═══════════════════════════ MEMBERS ════════════════════════════

    /**
     * Adds students, skipping any already in the group. Every id is validated
     * against the group's institute first and the <em>whole batch</em> is
     * rejected on any mismatch — silently dropping the offenders would read as
     * success to the caller.
     */
    @Transactional
    public BulkResult addMembers(Long groupId, List<Long> userStudentIds, Long actorUserId) {
        StudentGroup group = require(groupId);
        Set<Long> requested = cleanIds(userStudentIds, "userStudentIds");

        for (Long id : requested) {
            UserStudent student = userStudentRepository.findById(id)
                    .orElseThrow(() -> new GroupException(404, "Student not found: " + id));
            Integer studentInstitute = student.getInstitute() == null
                    ? null : student.getInstitute().getInstituteCode();
            assertSameInstitute(group, studentInstitute, "Student " + id);
        }

        Set<Long> existing = new LinkedHashSet<>(memberRepository.findUserStudentIdsByGroupId(groupId));
        List<StudentGroupMember> toSave = new ArrayList<>();
        for (Long id : requested) {
            if (!existing.contains(id)) {
                toSave.add(new StudentGroupMember(group, id, actorUserId));
            }
        }
        if (!toSave.isEmpty()) {
            memberRepository.saveAll(toSave);
        }

        BulkResult result = new BulkResult();
        result.added = toSave.size();
        result.alreadyPresent = requested.size() - toSave.size();
        result.total = existing.size() + toSave.size();
        logger.info("Student group {}: +{} members ({} already present), now {}",
                groupId, result.added, result.alreadyPresent, result.total);
        return result;
    }

    @Transactional
    public BulkResult removeMembers(Long groupId, List<Long> userStudentIds) {
        require(groupId);
        Set<Long> requested = cleanIds(userStudentIds, "userStudentIds");

        Set<Long> existing = new LinkedHashSet<>(memberRepository.findUserStudentIdsByGroupId(groupId));
        List<Long> present = new ArrayList<>();
        for (Long id : requested) {
            if (existing.contains(id)) {
                present.add(id);
            }
        }
        if (!present.isEmpty()) {
            memberRepository.deleteByStudentGroup_IdAndUserStudentIdIn(groupId, present);
        }

        BulkResult result = new BulkResult();
        result.removed = present.size();
        result.notPresent = requested.size() - present.size();
        result.total = existing.size() - present.size();
        return result;
    }

    @Transactional(readOnly = true)
    public List<Long> memberIds(Long groupId) {
        return memberRepository.findUserStudentIdsByGroupId(groupId);
    }

    @Transactional(readOnly = true)
    public List<StudentGroup> groupsOfStudent(Long userStudentId) {
        if (userStudentId == null) {
            throw new GroupException(400, "userStudentId is required");
        }
        List<StudentGroupMember> rows = memberRepository.findByUserStudentId(userStudentId);
        List<StudentGroup> groups = new ArrayList<>(rows.size());
        for (StudentGroupMember m : rows) {
            groups.add(m.getStudentGroup());
        }
        return groups;
    }

    // ═══════════════════════ CONTACT PERSONS ════════════════════════

    /**
     * The mirror of {@link #addMembers} — same idempotency, same all-or-nothing
     * institute guard. A cross-tenant admin would inherit access to another
     * school's students once the group ABAC dimension is live, so this check is
     * every bit as load-bearing as the student one.
     */
    @Transactional
    public BulkResult addContacts(Long groupId, List<Long> contactPersonIds, Long actorUserId) {
        StudentGroup group = require(groupId);
        Set<Long> requested = cleanIds(contactPersonIds, "contactPersonIds");

        for (Long id : requested) {
            ContactPerson cp = contactPersonRepository.findById(id)
                    .orElseThrow(() -> new GroupException(404, "Contact person not found: " + id));
            Integer cpInstitute = cp.getInstitute() == null
                    ? null : cp.getInstitute().getInstituteCode();
            assertSameInstitute(group, cpInstitute, "Contact person " + id);
        }

        Set<Long> existing = new LinkedHashSet<>(contactRepository.findContactPersonIdsByGroupId(groupId));
        List<StudentGroupContact> toSave = new ArrayList<>();
        for (Long id : requested) {
            if (!existing.contains(id)) {
                toSave.add(new StudentGroupContact(group, id, actorUserId));
            }
        }
        if (!toSave.isEmpty()) {
            contactRepository.saveAll(toSave);
        }

        BulkResult result = new BulkResult();
        result.added = toSave.size();
        result.alreadyPresent = requested.size() - toSave.size();
        result.total = existing.size() + toSave.size();
        return result;
    }

    /**
     * Removing the last contact person is allowed — a group with no admin is a
     * valid state (freshly created, or between staff changes) and simply grants
     * nobody group-scoped access. A "must keep one admin" rule would make staff
     * turnover a deadlock.
     */
    @Transactional
    public BulkResult removeContacts(Long groupId, List<Long> contactPersonIds) {
        require(groupId);
        Set<Long> requested = cleanIds(contactPersonIds, "contactPersonIds");

        Set<Long> existing = new LinkedHashSet<>(contactRepository.findContactPersonIdsByGroupId(groupId));
        List<Long> present = new ArrayList<>();
        for (Long id : requested) {
            if (existing.contains(id)) {
                present.add(id);
            }
        }
        if (!present.isEmpty()) {
            contactRepository.deleteByStudentGroup_IdAndContactPersonIdIn(groupId, present);
        }

        BulkResult result = new BulkResult();
        result.removed = present.size();
        result.notPresent = requested.size() - present.size();
        result.total = existing.size() - present.size();
        return result;
    }

    @Transactional(readOnly = true)
    public List<ContactPerson> contactsOfGroup(Long groupId) {
        List<Long> ids = contactRepository.findContactPersonIdsByGroupId(groupId);
        return ids.isEmpty() ? Collections.emptyList() : contactPersonRepository.findAllById(ids);
    }

    @Transactional(readOnly = true)
    public List<StudentGroup> groupsOfContactPerson(Long contactPersonId) {
        if (contactPersonId == null) {
            throw new GroupException(400, "contactPersonId is required");
        }
        return groupRepository.findActiveByContactPersonId(contactPersonId);
    }

    // ═══════════════════════════ COUNTS ═════════════════════════════

    /** Member and contact counts for a page of groups — one query each, not N. */
    @Transactional(readOnly = true)
    public Map<Long, long[]> countsFor(List<Long> groupIds) {
        Map<Long, long[]> counts = new HashMap<>();
        if (groupIds == null || groupIds.isEmpty()) {
            return counts;
        }
        for (Long id : groupIds) {
            counts.put(id, new long[] { 0L, 0L });
        }
        for (Object[] row : memberRepository.countByGroupIds(groupIds)) {
            long[] pair = counts.get((Long) row[0]);
            if (pair != null) pair[0] = ((Number) row[1]).longValue();
        }
        for (Object[] row : contactRepository.countByGroupIds(groupIds)) {
            long[] pair = counts.get((Long) row[0]);
            if (pair != null) pair[1] = ((Number) row[1]).longValue();
        }
        return counts;
    }

    // ═══════════════════════════ HELPERS ════════════════════════════

    /**
     * The tenant boundary. A null institute on the target is treated as a
     * mismatch rather than a wildcard — an institute-less student (B2C) has no
     * business in a school's group.
     */
    private void assertSameInstitute(StudentGroup group, Integer targetInstituteCode, String what) {
        Integer groupInstitute = group.getInstituteCode();
        if (targetInstituteCode == null || !targetInstituteCode.equals(groupInstitute)) {
            throw new GroupException(400, what + " belongs to institute "
                    + targetInstituteCode + " but the group belongs to institute " + groupInstitute
                    + ". A group can only hold members from its own school.");
        }
    }

    private static String requireName(String name) {
        String clean = trimToNull(name);
        if (clean == null) {
            throw new GroupException(400, "name is required");
        }
        if (clean.length() > 150) {
            throw new GroupException(400, "name must be 150 characters or fewer");
        }
        return clean;
    }

    /** De-duplicates while preserving caller order, and rejects an empty list. */
    private static Set<Long> cleanIds(List<Long> ids, String field) {
        if (ids == null || ids.isEmpty()) {
            throw new GroupException(400, field + " is required and must not be empty");
        }
        Set<Long> clean = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id != null) {
                clean.add(id);
            }
        }
        if (clean.isEmpty()) {
            throw new GroupException(400, field + " contained no usable ids");
        }
        return clean;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
