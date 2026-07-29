package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.ContactPerson;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.model.career9.group.StudentGroup;
import com.kccitm.api.model.career9.school.SchoolSections;
import com.kccitm.api.repository.Career9.School.SchoolSectionsRepository;
import com.kccitm.api.repository.Career9.UserStudentRepository;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.schoolgroup.StudentGroupService;
import com.kccitm.api.service.schoolgroup.StudentGroupService.BulkResult;
import com.kccitm.api.service.schoolgroup.StudentGroupService.GroupException;

/**
 * Named student groups inside an institute, their students, and the contact
 * persons who administer them.
 *
 * <p>Both attachments are many-to-many, so the member and contact-person
 * surfaces are deliberately identical: bulk {@code POST} / {@code DELETE} with
 * an id list, idempotent on both sides. They differ only in which id column
 * they carry.
 *
 * <p>Every method scopes on the group's <strong>persisted</strong> institute,
 * re-read from the group rather than trusted from the request body — the IDOR
 * guard {@code StudentRoleGroupController} already models. Note that with
 * {@code auth.enforce-mode: log-only} (the setting in every profile today)
 * {@code @PreAuthorize} does not actually block; see
 * {@code docs/STUDENT_GROUP_PLAN.md} §5.3.
 */
@RestController
@RequestMapping("/student-groups")
public class StudentGroupController {

    private static final Logger logger = LoggerFactory.getLogger(StudentGroupController.class);

    @Autowired private StudentGroupService groupService;
    @Autowired private UserStudentRepository userStudentRepository;
    @Autowired private SchoolSectionsRepository schoolSectionsRepository;

    // ═══════════════════════════ GROUP CRUD ═══════════════════════════

    /** Body: {@code {instituteCode, name, description?}}. */
    @PostMapping
    @PreAuthorize("@auth.allows('student_group.create')")
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        Integer instituteCode = asInt(body.get("instituteCode"));
        StudentGroup group = groupService.create(
                instituteCode, asString(body.get("name")), asString(body.get("description")),
                currentUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(toSummary(group, 0L, 0L));
    }

    /** Groups in one institute, each with its member and contact counts. */
    @GetMapping
    @PreAuthorize("@auth.allows('student_group.read', #instituteCode)")
    public ResponseEntity<?> list(
            @RequestParam Integer instituteCode,
            @RequestParam(required = false, defaultValue = "false") boolean includeInactive) {

        List<StudentGroup> groups = groupService.listByInstitute(instituteCode, includeInactive);
        List<Long> ids = new ArrayList<>(groups.size());
        for (StudentGroup g : groups) {
            ids.add(g.getId());
        }
        Map<Long, long[]> counts = groupService.countsFor(ids);

        List<Map<String, Object>> out = new ArrayList<>(groups.size());
        for (StudentGroup g : groups) {
            long[] pair = counts.getOrDefault(g.getId(), new long[] { 0L, 0L });
            out.add(toSummary(g, pair[0], pair[1]));
        }
        return ResponseEntity.ok(out);
    }

    /** One group with its full member list and admin list. */
    @GetMapping("/{groupId}")
    @PreAuthorize("@auth.allows('student_group.read')")
    public ResponseEntity<?> get(@PathVariable Long groupId) {
        StudentGroup group = groupService.require(groupId);
        List<Long> memberIds = groupService.memberIds(groupId);
        List<ContactPerson> contacts = groupService.contactsOfGroup(groupId);

        Map<String, Object> out = toSummary(group, memberIds.size(), contacts.size());
        out.put("students", studentRows(memberIds));
        out.put("contactPersons", contactRows(contacts));
        return ResponseEntity.ok(out);
    }

    /** Body: any of {@code {name, description, active}}. */
    @PutMapping("/{groupId}")
    @PreAuthorize("@auth.allows('student_group.update')")
    public ResponseEntity<?> update(@PathVariable Long groupId, @RequestBody Map<String, Object> body) {
        StudentGroup group = groupService.update(groupId,
                asString(body.get("name")), asString(body.get("description")),
                asBoolean(body.get("active")), currentUserId());
        return ResponseEntity.ok(toSummary(group, null, null));
    }

    /** Soft delete — the group stays so scope grants referencing it do not dangle. */
    @DeleteMapping("/{groupId}")
    @PreAuthorize("@auth.allows('student_group.delete')")
    public ResponseEntity<?> delete(@PathVariable Long groupId) {
        groupService.deactivate(groupId, currentUserId());
        return ResponseEntity.ok(Map.of("deactivated", true, "groupId", groupId));
    }

    // ════════════════════════════ MEMBERS ═════════════════════════════

    /** Body: {@code {userStudentIds: [...]}}. Idempotent. */
    @PostMapping("/{groupId}/members")
    @PreAuthorize("@auth.allows('student_group.member.manage')")
    public ResponseEntity<?> addMembers(@PathVariable Long groupId, @RequestBody Map<String, Object> body) {
        BulkResult result = groupService.addMembers(groupId, asLongList(body.get("userStudentIds")),
                currentUserId());
        return ResponseEntity.ok(toBulk(result));
    }

    /** Body: {@code {userStudentIds: [...]}}. */
    @DeleteMapping("/{groupId}/members")
    @PreAuthorize("@auth.allows('student_group.member.manage')")
    public ResponseEntity<?> removeMembers(@PathVariable Long groupId, @RequestBody Map<String, Object> body) {
        BulkResult result = groupService.removeMembers(groupId, asLongList(body.get("userStudentIds")));
        return ResponseEntity.ok(toBulk(result));
    }

    /** Group → its students, in the shape the Reports Hub and School Dashboard consume. */
    @GetMapping("/{groupId}/students")
    @PreAuthorize("@auth.allows('student_group.read')")
    public ResponseEntity<?> students(@PathVariable Long groupId) {
        groupService.require(groupId);
        return ResponseEntity.ok(studentRows(groupService.memberIds(groupId)));
    }

    /** Student → the groups they belong to. A student may be in many. */
    @GetMapping("/by-student/{userStudentId}")
    @PreAuthorize("@auth.allows('student_group.read', @auth.instituteOfStudent(#userStudentId))")
    public ResponseEntity<?> byStudent(@PathVariable Long userStudentId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (StudentGroup g : groupService.groupsOfStudent(userStudentId)) {
            out.add(toSummary(g, null, null));
        }
        return ResponseEntity.ok(out);
    }

    // ════════════════════════ CONTACT PERSONS ═════════════════════════

    /** Body: {@code {contactPersonIds: [...]}}. Idempotent. */
    @PostMapping("/{groupId}/contact-persons")
    @PreAuthorize("@auth.allows('student_group.contact.assign')")
    public ResponseEntity<?> addContacts(@PathVariable Long groupId, @RequestBody Map<String, Object> body) {
        BulkResult result = groupService.addContacts(groupId, asLongList(body.get("contactPersonIds")),
                currentUserId());
        return ResponseEntity.ok(toBulk(result));
    }

    /** Body: {@code {contactPersonIds: [...]}}. Removing the last admin is allowed. */
    @DeleteMapping("/{groupId}/contact-persons")
    @PreAuthorize("@auth.allows('student_group.contact.assign')")
    public ResponseEntity<?> removeContacts(@PathVariable Long groupId, @RequestBody Map<String, Object> body) {
        BulkResult result = groupService.removeContacts(groupId, asLongList(body.get("contactPersonIds")));
        return ResponseEntity.ok(toBulk(result));
    }

    /** Group → its admins. */
    @GetMapping("/{groupId}/contact-persons")
    @PreAuthorize("@auth.allows('student_group.read')")
    public ResponseEntity<?> contacts(@PathVariable Long groupId) {
        groupService.require(groupId);
        return ResponseEntity.ok(contactRows(groupService.contactsOfGroup(groupId)));
    }

    /** Contact person → the groups they administer. */
    @GetMapping("/by-contact-person/{contactPersonId}")
    @PreAuthorize("@auth.allows('student_group.read')")
    public ResponseEntity<?> byContactPerson(@PathVariable Long contactPersonId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (StudentGroup g : groupService.groupsOfContactPerson(contactPersonId)) {
            out.add(toSummary(g, null, null));
        }
        return ResponseEntity.ok(out);
    }

    // ═════════════════════════ ERROR MAPPING ══════════════════════════

    @ExceptionHandler(GroupException.class)
    public ResponseEntity<?> handleGroupException(GroupException e) {
        logger.warn("Student group request rejected ({}): {}", e.getStatus(), e.getMessage());
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getMessage()));
    }

    // ════════════════════════════ SHAPING ═════════════════════════════

    private Map<String, Object> toSummary(StudentGroup g, Long memberCount, Long contactCount) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", g.getId());
        row.put("instituteCode", g.getInstituteCode());
        row.put("instituteName", g.getInstitute() == null ? null : g.getInstitute().getInstituteName());
        row.put("name", g.getName());
        row.put("description", g.getDescription());
        row.put("active", Boolean.TRUE.equals(g.getActive()));
        row.put("createdAt", g.getCreatedAt());
        if (memberCount != null) row.put("memberCount", memberCount);
        if (contactCount != null) row.put("contactCount", contactCount);
        return row;
    }

    private Map<String, Object> toSummary(StudentGroup g, long memberCount, long contactCount) {
        return toSummary(g, Long.valueOf(memberCount), Long.valueOf(contactCount));
    }

    private Map<String, Object> toBulk(BulkResult r) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("added", r.added);
        out.put("alreadyPresent", r.alreadyPresent);
        out.put("removed", r.removed);
        out.put("notPresent", r.notPresent);
        out.put("total", r.total);
        return out;
    }

    /**
     * Hydrates student rows for a member list. Sections are resolved through a
     * per-request cache because a group's students commonly share a handful of
     * sections between them.
     */
    private List<Map<String, Object>> studentRows(List<Long> userStudentIds) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (userStudentIds == null || userStudentIds.isEmpty()) {
            return out;
        }
        Map<Integer, String[]> sectionCache = new LinkedHashMap<>();
        for (UserStudent us : userStudentRepository.findAllById(userStudentIds)) {
            StudentInfo si = us.getStudentInfo();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("userStudentId", us.getUserStudentId());
            row.put("instituteCode", us.getInstitute() == null ? null : us.getInstitute().getInstituteCode());
            if (si != null) {
                row.put("name", si.getName());
                row.put("schoolRollNumber", si.getSchoolRollNumber());
                row.put("email", si.getEmail());
                row.put("phoneNumber", si.getPhoneNumber());
                row.put("studentClass", si.getStudentClass());
                row.put("gender", si.getGender());
                row.put("username", si.getUser() == null ? null : si.getUser().getUsername());
                Integer sectionId = si.getSchoolSectionId();
                if (sectionId != null) {
                    String[] names = sectionCache.computeIfAbsent(sectionId, id ->
                            schoolSectionsRepository.findById(id)
                                    .map(this::sectionAndClass)
                                    .orElse(new String[] { null, null }));
                    row.put("sectionName", names[0]);
                    row.put("className", names[1]);
                }
            }
            out.add(row);
        }
        return out;
    }

    private String[] sectionAndClass(SchoolSections section) {
        return new String[] {
                section.getSectionName(),
                section.getSchoolClasses() == null ? null : section.getSchoolClasses().getClassName()
        };
    }

    private List<Map<String, Object>> contactRows(List<ContactPerson> contacts) {
        List<Map<String, Object>> out = new ArrayList<>(contacts.size());
        for (ContactPerson cp : contacts) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", cp.getId());
            row.put("name", cp.getName());
            row.put("email", cp.getEmail());
            row.put("phoneNumber", cp.getPhoneNumber());
            row.put("designation", cp.getDesignation());
            row.put("userId", cp.getUserId());
            out.add(row);
        }
        return out;
    }

    // ═════════════════════════ BODY PARSING ═══════════════════════════

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal) {
            return ((UserPrincipal) auth.getPrincipal()).getId();
        }
        return null;
    }

    private static Integer asInt(Object value) {
        return value instanceof Number ? ((Number) value).intValue() : null;
    }

    private static String asString(Object value) {
        return value instanceof String ? (String) value : null;
    }

    private static Boolean asBoolean(Object value) {
        return value instanceof Boolean ? (Boolean) value : null;
    }

    private static List<Long> asLongList(Object value) {
        if (!(value instanceof List)) {
            return null;
        }
        List<Long> out = new ArrayList<>();
        for (Object item : (List<?>) value) {
            if (item instanceof Number) {
                out.add(((Number) item).longValue());
            }
        }
        return out;
    }
}
