# Named Student Groups with Multiple Contact Persons — Design

**Date:** 2026-06-24
**Status:** Draft (awaiting review)
**Area:** spring-social (backend) + react-social (frontend)

## Problem

Today, "grouping" students under a school contact person is transient. The
[`assignStudents`](../../../spring-social/src/main/java/com/kccitm/api/controller/ContactPersonController.java)
endpoint writes one bare `StudentContactAssignment` row per (student, contact
person) and forgets the selection. There is no named, persisted group, so a
school user cannot:

1. Give the group a name when creating it.
2. See how many groups exist in an institute (and how many they personally made).
3. See which contact person(s) each group belongs to.

## Goals

- A **named, persisted group** of students scoped to one institute (school).
- A group can be assigned to **multiple contact persons** of that institute.
- **Full CRUD**: create, list/view, rename, edit members, edit contact persons, delete.
- A **listing view** per institute showing each group's name, member count,
  contact person(s), creator, and creation date — with counts for "all groups in
  the institute" and "groups I created".
- Reuse the existing contact-person email notification on assignment.

## Non-goals / Out of scope

- No changes to the legacy `Group` (`group_data`) social entity — left untouched.
- No changes to the separate `StudentCounsellorMapping` counselling flow.
- No group-to-group nesting, no group templates, no scheduled/auto grouping.
- No new permission domain (we reuse `contact_person.*` — see Permissions).

## Decisions (resolved during brainstorming)

| Decision | Choice |
|----------|--------|
| Data model | New dedicated `StudentGroup` entity (not the legacy `Group`) |
| Contact persons per group | Multiple |
| Management scope | Full CRUD |
| Membership storage | Reuse `student_contact_assignment`, add `group_id` (see below) |
| Permissions | Reuse `contact_person.*` with institute scoping |
| Creator tracking | Add `created_by` to power "groups I made" |

## Data model

### New entity: `StudentGroup` (table `student_group`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGINT PK, identity | |
| `name` | VARCHAR, not null | e.g. "Class 10-A — Batch 1" |
| `institute_id` | INT, not null | scopes members & contacts to one school |
| `created_by` | BIGINT, nullable | `user.id` of the admin who created it |
| `created_at` | TIMESTAMP | set on create |
| `updated_at` | TIMESTAMP | bumped on edit |

`name` is unique per institute: unique constraint on `(institute_id, name)`.

JPA: `institute_id` maps to `InstituteDetail` consistent with existing usage
(`ContactPerson.institute` joins on `institute_code`; `UserStudent.institute`
joins on `institute_id`). To stay aligned with `StudentContactAssignment` (which
stores `instituteId` as a plain `Integer`), `StudentGroup.instituteId` is also a
plain column, validated in application code.

### Membership & contacts: extend `student_contact_assignment`

Add one nullable column to the existing
[`StudentContactAssignment`](../../../spring-social/src/main/java/com/kccitm/api/model/StudentContactAssignment.java):

```
student_contact_assignment
  id                PK
  user_student_id   (existing)
  contact_person_id (existing)
  institute_id      (existing)
  assigned_at       (existing)
  group_id          FK -> student_group   <-- NEW, nullable
```

A group's links are all assignment rows sharing its `group_id`:

- **members(group)** = `DISTINCT user_student_id WHERE group_id = ?`
- **contacts(group)** = `DISTINCT contact_person_id WHERE group_id = ?`

Assigning M students to N contacts creates M×N rows, all sharing the `group_id`.

Add a unique constraint on `(group_id, user_student_id, contact_person_id)` to
prevent duplicate rows (this also fixes the pre-existing duplicate-assignment bug
for grouped assignments). Rows with `group_id IS NULL` are legacy/ungrouped
assignments and are unaffected.

**Why this storage (vs. normalized join tables):** every existing feature that
reads `student_contact_assignment` — the per-contact "assigned students" view
([`getAssignedStudents`](../../../spring-social/src/main/java/com/kccitm/api/controller/ContactPersonController.java)),
email-recipient resolution (`getEmailRecipients`), and report sending — keeps
working unchanged. The group layer is purely additive. The trade-off (a member
cannot exist in a group with zero contacts) is acceptable: the feature's purpose
is assigning students to contacts.

### Schema application

Per the codebase audit, `contact_person`, `student_contact_assignment`, and
related tables are created by Hibernate `ddl-auto:update` (not Flyway). The new
`student_group` table and `group_id` column follow the same mechanism (derived
from annotations). If/when Flyway is adopted for this area, a versioned migration
should capture these definitions and the unique constraints explicitly.

## CRUD semantics

- **Create** `{ name, instituteId, userStudentIds[], contactPersonIds[] }`:
  validate all students and contacts belong to `instituteId`; create
  `StudentGroup`; insert M×N assignment rows tagged with the new `group_id`;
  email each contact person the member list.
- **Edit members**: diff requested vs. current member set. For added students,
  insert rows for each current contact; for removed students, delete that group's
  rows for those students.
- **Edit contacts**: diff requested vs. current contact set. For added contacts,
  insert rows for each current member (and email the new contact); for removed
  contacts, delete that group's rows for those contacts.
- **Rename**: update `StudentGroup.name` (+ `updated_at`).
- **Delete**: delete all `student_contact_assignment` rows with that `group_id`,
  then delete the `StudentGroup`. Done in a `@Transactional` service method.

A dedicated `StudentGroupService` owns this logic (the current code does
assignment inline in the controller; this design moves group logic into a service
for transactional integrity and testability).

## API surface

New endpoints under `/contact-person/groups`:

| Method & path | Body / params | Purpose | Permission |
|---|---|---|---|
| `POST /contact-person/groups` | `{ name, instituteId, userStudentIds[], contactPersonIds[] }` | Create group + assignments + emails | `contact_person.update` |
| `GET /contact-person/groups/by-institute/{instituteCode}` | `?createdByMe=true` optional | List groups with member count, contact-person names, creator, date | `contact_person.read` |
| `GET /contact-person/groups/{groupId}` | — | Group detail: members + contacts (hydrated like `getAssignedStudents`) | `contact_person.read` |
| `PUT /contact-person/groups/{groupId}` | `{ name?, userStudentIds?, contactPersonIds? }` | Rename and/or replace members/contacts | `contact_person.update` |
| `DELETE /contact-person/groups/{groupId}` | — | Delete group + its assignment rows | `contact_person.update` |

The existing `POST /contact-person/assign-students` is retained unchanged for
backward compatibility (creates ungrouped assignments).

List response per group: `{ id, name, instituteId, memberCount,
contactPersons: [{ id, name }], createdBy, createdByName, createdAt }`.

## Permissions & validation

- Reuse `contact_person.*` permissions (the controller already gates assignment
  on `contact_person.update`/`read`), keeping authorization consistent and
  avoiding a new permission domain to seed. Institute scoping is enforced via the
  existing `@auth.allows(...)` scope-filter mechanism.
- Server-side validation: `name` non-empty and unique within the institute; every
  `userStudentId` resolves to a `UserStudent` in `instituteId`; every
  `contactPersonId` resolves to a `ContactPerson` whose `institute` matches
  `instituteId`. Reject the whole request on any mismatch (no partial writes).

## Frontend

- **Group Together modal**
  ([`GroupStudentSchoolPage.tsx`](../../../react-social/src/app/pages/GroupStudent/GroupStudentSchoolPage.tsx)):
  add a required **group name** field; change the contact-person picker to allow
  selecting **multiple** contact persons; submit to `POST /contact-person/groups`.
- **New "Student Groups" page** (route under `/school/...`): a table of the
  institute's groups — name, # students, contact person(s), created by, created
  date — with a count header ("12 groups · 4 created by you"), a "created by me"
  filter, and View / Edit / Delete actions.
- **Edit drawer/modal**: rename, add/remove students, add/remove contact persons
  → `PUT /contact-person/groups/{groupId}`.
- API client functions added alongside the existing
  [`assignStudentsToContactPerson`](../../../react-social/src/app/pages/StudentInformation/StudentInfo_APIs.ts)
  for create/list/detail/update/delete.

## Email behavior

On create and on adding contacts, each affected contact person receives the
existing HTML notification listing the group's students (reuse the current
`smtpEmailService.sendHtmlEmail` + `communicationLogService.logEmail` logic from
`assignStudents`). The group name is included in the subject/body.

## Backward compatibility

- Existing ungrouped assignments (`group_id IS NULL`) are untouched and still
  surface in all per-contact-person views.
- `getAssignedStudents`, `getEmailRecipients`, and report-sending read
  `student_contact_assignment` and therefore include grouped rows automatically.
- No existing endpoint signature changes.

## Testing

- **Service unit tests** (`StudentGroupService`): create (M×N rows + group),
  rename, add/remove members, add/remove contacts (row deltas), delete (cascade),
  duplicate-name rejection, cross-institute student/contact rejection.
- **Repository tests**: derive members/contacts from `group_id`; unique
  constraint blocks duplicate (group, student, contact).
- **Controller/web-layer tests**: each endpoint's happy path + auth denial +
  validation failures.
- **Frontend**: modal requires name + ≥1 contact; listing renders counts;
  edit/delete call the right endpoints.

## Key files to touch

- `spring-social/.../model/StudentGroup.java` (new)
- `spring-social/.../model/StudentContactAssignment.java` (add `group_id`)
- `spring-social/.../repository/StudentGroupRepository.java` (new)
- `spring-social/.../repository/StudentContactAssignmentRepository.java` (group-aware queries)
- `spring-social/.../service/.../StudentGroupService.java` (new)
- `spring-social/.../controller/ContactPersonController.java` (new group endpoints)
- `react-social/.../pages/GroupStudent/GroupStudentSchoolPage.tsx` (name + multi-contact)
- `react-social/.../pages/GroupStudent/StudentGroupsPage.tsx` (new listing/edit)
- `react-social/.../pages/StudentInformation/StudentInfo_APIs.ts` (new API clients)
