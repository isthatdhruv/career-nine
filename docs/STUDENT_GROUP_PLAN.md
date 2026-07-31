# Student Groups — implementation plan

**Goal.** A named, institute-owned group of hand-picked students, administered by
one or more contact persons. Queryable every direction (group → students,
group → contact persons, student → groups, contact person → groups). Group
becomes a fifth ABAC dimension, so a scope grant can be narrowed to
"these students" rather than "this whole school".

**Cardinality (confirmed).** Both attachments are many-to-many:
a group holds many students and a student belongs to many groups; a group has
many contact persons and a contact person administers many groups.

**Explicitly independent of session / class / section.** A group carries no FK
to `school_session`, `school_classes` or `school_sections`, and membership is
never derived from them. A group may freely mix Class 6 and Class 12 students.

---

## 1. Where this sits in what already exists

| Existing thing | Why it is not this |
|---|---|
| `Group` / `group_data` + `GroupController` | Legacy KCC table. Joins to `User`, not `UserStudent`; no institute column; controller has no create/update, and its "delete" re-saves the row unchanged. Dead end — leave alone. |
| `RoleGroup` + `UserRoleGroupMapping` + `StudentRoleGroupController` | RBAC. Role groups resolve to *permissions*, are global rather than per-institute, and are assigned one student per PUT. Different axis entirely. |
| `StudentContactAssignment` | The closest: `POST /contact-person/assign-students` writes `(userStudentId, contactPersonId, instituteId)`. But the "group" is identified by a contact person, has no name, no unassign endpoint wired, no dedup, and emails on every write. See §8. |
| `SchoolClasses` / `SchoolSections` | The structural hierarchy we are deliberately orthogonal to. |

---

## 2. Schema

Three new tables: the group itself plus two symmetric join tables, one for
students and one for contact persons. `institute_detail.institute_code` is the
institute key everywhere in this codebase (an `Integer`), and
`user_student.user_student_id` is the student key — match both exactly.

```
institute_detail (existing)
  │
  └─< student_group                      NEW
        id                BIGINT PK AUTO_INCREMENT
        institute_code    INT      NOT NULL  FK → institute_detail(institute_code)
        name              VARCHAR(150) NOT NULL
        description       VARCHAR(500) NULL
        active            BOOLEAN  NOT NULL DEFAULT TRUE
        created_at        DATETIME NOT NULL
        created_by        BIGINT   NULL
        updated_at        DATETIME NULL
        updated_by        BIGINT   NULL
        UNIQUE KEY uk_group_institute_name (institute_code, name)

        ├─< student_group_member          NEW   (students in the group)
        │     id                BIGINT PK AUTO_INCREMENT
        │     student_group_id  BIGINT   NOT NULL  FK → student_group(id) ON DELETE CASCADE
        │     user_student_id   BIGINT   NOT NULL  FK → user_student(user_student_id)
        │     added_at          DATETIME NOT NULL
        │     added_by          BIGINT   NULL
        │     UNIQUE KEY uk_group_student (student_group_id, user_student_id)
        │     KEY idx_member_student (user_student_id)
        │
        └─< student_group_contact         NEW   (admins of the group)
              id                BIGINT PK AUTO_INCREMENT
              student_group_id  BIGINT   NOT NULL  FK → student_group(id) ON DELETE CASCADE
              contact_person_id BIGINT   NOT NULL  FK → contact_person(id)
              assigned_at       DATETIME NOT NULL
              assigned_by       BIGINT   NULL
              UNIQUE KEY uk_group_contact (student_group_id, contact_person_id)
              KEY idx_contact_group (contact_person_id)
```

### Decisions baked in

- **Contact persons are a join table, not a column.** A group has many admins
  and an admin runs many groups, so `student_group_contact` mirrors
  `student_group_member` exactly — same shape, same idempotency key, same bulk
  add/remove endpoints. Nothing in the plan special-cases "the" contact person.
- **Both join tables carry `UNIQUE (student_group_id, <fk>)`.** That is what
  makes bulk add idempotent, and it is precisely what
  `StudentContactAssignment` lacks today (re-assigning the same students
  duplicates rows there).
- **`KEY idx_contact_group (contact_person_id)`** exists for the
  "groups I administer" lookup, which is a first-class query here rather than
  an afterthought.
- **No "primary" or "owner" admin.** All contact persons on a group are equal.
  If a lead-admin distinction is ever needed, add a `role` column to
  `student_group_contact` rather than reintroducing a column on `student_group`.
- **Soft delete via `active`**, plus `ON DELETE CASCADE` on members for the hard
  case. Groups get referenced from reports and scope grants; hard-deleting one
  out from under a `user_role_scope` row would orphan the grant.
- **`UNIQUE (institute_code, name)`** — a school cannot have two "Batch A"s.
  Compare case-insensitively in the service before hitting the constraint so
  the caller gets a 409 with a message rather than a driver exception.

### ⚠️ `ddl-auto: update` is on in every profile

`application.yml` sets `spring.jpa.hibernate.ddl-auto: update` in **dev,
sandbox and production**. The moment these `@Entity` classes deploy, Hibernate
will create these tables itself, on whatever column types it infers — before or
instead of the Flyway migration. Two consequences:

1. Write the Flyway migration so it is **idempotent** (`CREATE TABLE IF NOT
   EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` where the MySQL version
   allows, otherwise guarded by `information_schema` checks).
2. Make the migration's column types match what Hibernate would generate, or
   the two will fight across environments. Verify by booting dev with the
   migration applied and diffing `SHOW CREATE TABLE` against sandbox.

This is pre-existing project-wide behaviour, not something this feature
introduces — but it is the most likely source of "works on dev, broken on prod".

---

## 3. Entities & repositories

```
model/career9/group/StudentGroup.java
model/career9/group/StudentGroupMember.java
model/career9/group/StudentGroupContact.java
repository/Career9/StudentGroupRepository.java
repository/Career9/StudentGroupMemberRepository.java
repository/Career9/StudentGroupContactRepository.java
```

`StudentGroup`
- `@ManyToOne InstituteDetail institute` with
  `@JoinColumn(name="institute_code", referencedColumnName="institute_code")`
  — mirrors `UserStudent.institute`.
- Do **not** map `members` as an eager `@OneToMany`. A group can hold hundreds
  of students; loading a list of groups would N+1 into the whole cohort. Read
  members through the member repository with an explicit query.
- `contacts` may be a `@OneToMany` if wanted — a group's admin list is a
  handful of rows, not a cohort — but keeping it symmetric with members (read
  via repository) avoids two different idioms in the same service.

`StudentGroupRepository`
```java
List<StudentGroup> findByInstitute_InstituteCodeAndActiveTrue(Integer instituteCode);
Optional<StudentGroup> findByInstitute_InstituteCodeAndNameIgnoreCase(Integer code, String name);

// "Groups I administer" — through the join table now, not a column.
@Query("SELECT c.studentGroup FROM StudentGroupContact c "
     + "WHERE c.contactPersonId = :cpId AND c.studentGroup.active = true")
List<StudentGroup> findActiveByContactPersonId(@Param("cpId") Long contactPersonId);
```

`StudentGroupMemberRepository`
```java
List<StudentGroupMember> findByStudentGroup_Id(Long groupId);
List<StudentGroupMember> findByUserStudentId(Long userStudentId);
long countByStudentGroup_Id(Long groupId);
void deleteByStudentGroup_IdAndUserStudentIdIn(Long groupId, List<Long> ids);

// Existing membership for the idempotent-add diff.
@Query("SELECT m.userStudentId FROM StudentGroupMember m WHERE m.studentGroup.id = :gid")
List<Long> findUserStudentIdsByGroupId(@Param("gid") Long groupId);

// Group ids a student belongs to — the ABAC row filter and the reverse
// lookup both need this. A student may appear in many.
@Query("SELECT m.studentGroup.id FROM StudentGroupMember m WHERE m.userStudentId = :id")
List<Long> findGroupIdsByUserStudentId(@Param("id") Long userStudentId);

// Member counts for a list page, in one query instead of N.
@Query("SELECT m.studentGroup.id, COUNT(m) FROM StudentGroupMember m "
     + "WHERE m.studentGroup.id IN :ids GROUP BY m.studentGroup.id")
List<Object[]> countByGroupIds(@Param("ids") List<Long> groupIds);
```

`StudentGroupContactRepository` — deliberately the mirror image:
```java
List<StudentGroupContact> findByStudentGroup_Id(Long groupId);
List<StudentGroupContact> findByContactPersonId(Long contactPersonId);
void deleteByStudentGroup_IdAndContactPersonIdIn(Long groupId, List<Long> ids);

@Query("SELECT c.contactPersonId FROM StudentGroupContact c WHERE c.studentGroup.id = :gid")
List<Long> findContactPersonIdsByGroupId(@Param("gid") Long groupId);

@Query("SELECT c.studentGroup.id, COUNT(c) FROM StudentGroupContact c "
     + "WHERE c.studentGroup.id IN :ids GROUP BY c.studentGroup.id")
List<Object[]> countByGroupIds(@Param("ids") List<Long> groupIds);
```

---

## 4. Service — `StudentGroupService`

All the invariants live here, not in the controller.

1. **Cross-tenant membership guard (the important one).** Adding a student
   whose `UserStudent.institute.instituteCode` differs from the group's
   institute is rejected with 400. Without this, group membership becomes a
   hole straight through institute isolation — someone with
   `student_group.member.manage` on School A could pull School B's students
   into an A-owned group and then read them through the group endpoints.
   Validate **every** id in a bulk add; reject the whole batch on any mismatch
   rather than silently dropping (a silent drop reads as success).
2. **Contact person guard — same rule, same code path.** Every
   `contactPersonId` must belong to the group's institute
   (`ContactPerson.institute.instituteCode`), else 400 for the whole batch.
   With many-to-many admins this matters as much as the student guard: an admin
   attached across tenants would read another school's students through
   "groups I administer".
3. **Idempotent add, both sides.** Compute `requested − existing` and insert
   only the difference; return `{added, alreadyPresent, total}` so the caller
   can show an honest toast. One shared helper serves members and contacts —
   they differ only in the id column.
4. **Removing the last contact person is allowed.** A group with no admin is a
   valid state (freshly created, or between staff changes); it simply grants
   nobody group-scoped access. Do not invent a "must have ≥1 admin" rule — it
   makes staff turnover a deadlock.
5. **Name uniqueness** per institute, case-insensitive, 409 on clash.
6. **Never touch** session/class/section. Stated in the class javadoc so nobody
   "helpfully" adds a section filter later.

---

## 5. ABAC — group as the fifth dimension

Today's tuple is `(i, s, c, x)` = institute / session / course / section,
defined in `CurrentScopes.ScopeRow`, persisted in `user_role_scope`, carried in
the JWT `scopes[]` claim under those short keys. Adding `g` means touching
every point that tuple flows through:

| # | File | Change |
|---|---|---|
| 1 | `user_role_scope` (migration) | `ADD COLUMN group_id BIGINT NULL` |
| 2 | `model/UserRoleScope.java` | `groupId` field + accessors |
| 3 | `security/CurrentScopes.java` | `ScopeRow.g`; `matches(...)` gains `(g == null \|\| Objects.equals(g, tg))`; `anyMatch` gains the arg |
| 4 | `security/AuthorizationService.java` | new `allows(perm, i, s, c, x, g)`; existing 4 overloads delegate with `g = null` |
| 5 | `security/TokenProvider.java` (~177, ~411) | write `g` into the claim; parse it back, **defaulting to null when absent** |
| 6 | `security/CustomUserDetailsService.java` (~89) | hydrate `g` from `UserRoleScope` |
| 7 | `controller/AuthController.java` `serializeScopes` | emit `g` in `MeResponse` |
| 8 | `react-social` `Scope` type | `g?: number \| null` |
| 9 | `security/ScopeFilterInterceptor.java` | aggregate `groupIds`, wildcard flag, sentinel |
| 10 | `@FilterDef` on `StudentInfo` | `@ParamDef(name="groupIds", type="long")` |

**JWT compatibility is safe in both directions.** An old token has no `g` → parses
to null → wildcard → behaves exactly as today. A new token read by an old
server → unknown key ignored. So step 5 can ship before or after the rest
without a forced logout.

### 5.0 Two ways a user ends up scoped to a group

`ContactPerson` carries a nullable `userId`, so a group admin is usually also a
`User` — which means there are two plausible sources for "which groups may this
caller see", and with many-to-many admins both are wanted:

| Source | Covers | Cost |
|---|---|---|
| **Explicit grant** — `user_role_scope.group_id` | any staff user, no contact-person record needed; consistent with how institute/session/course/section already work | needs a user-management UI to set, and can drift from the admin list |
| **Derived** — groups where `student_group_contact.contact_person_id` maps to a `contact_person` whose `user_id` is me | zero admin overhead; can never drift, because alloting the admin *is* the grant | a lookup per request (cache it on the principal at login) |

**Recommendation: union the two.** Effective group scope =
explicit scope rows ∪ groups I am a contact person for. The explicit path keeps
the new dimension consistent with the existing four; the derived path means
"allot a contact person to a group" does the obviously-expected thing without a
second trip through user-management.

Resolve the derived set in `CustomUserDetailsService` alongside the existing
scope hydration (it already loads `user_role_scope` there) and fold it into the
same `ScopeRow` list, so everything downstream — JWT, filter, `anyMatch` — stays
unaware of where a row came from.

The tempting alternative — have the allot endpoint *write* a `user_role_scope`
row as a side effect — is worse: `user_role_scope` hangs off
`user_role_group_mapping`, so the service would have to pick *which* of the
user's role-group assignments to attach the grant to, and unpick it correctly on
removal. Deriving avoids that question entirely.

### 5.1 The row-level filter is the hard part

The existing four dims are all plain **columns** on the filtered entity, which
is why `@Filter` conditions are simple `IN (...) OR IS NULL`. Group membership
is a **join table**, so it needs a correlated subquery.

**Group is strict — no wildcard carve-out.** Unlike the other four dims, an
ungrouped student is *not* visible to a group-scoped admin. There is no
`OR ... IS NULL` equivalent and no `NOT EXISTS` arm: a group grant means
"exactly these students, nobody else".

```sql
-- on UserStudent (table user_student, PK user_student_id)
AND EXISTS (SELECT 1 FROM student_group_member m
             WHERE m.user_student_id = user_student.user_student_id
               AND m.student_group_id IN (:groupIds))
```

On `StudentInfo` the hop is one longer — note `user_student.id` is the FK to
`student_info.id` while `user_student_id` is its own PK:

```sql
AND EXISTS (SELECT 1 FROM student_group_member m
              JOIN user_student us ON us.user_student_id = m.user_student_id
             WHERE us.id = student_info.id
               AND m.student_group_id IN (:groupIds))
```

#### The clause must only apply when the caller is actually group-scoped

Strictness makes the enable/disable rule load-bearing. Scope rows are OR'd, so
the group clause is added **only when every one of the caller's scope rows binds
a group**. If any row leaves `group_id` NULL — which is every user today, and
every institute-level admin forever — that row is a group wildcard and the
clause is omitted entirely.

Get this backwards and an institute admin with no group grants sees **zero
students**, because no row of theirs would satisfy the `EXISTS`. This is the
single highest-risk line in the feature.

`ScopeFilterInterceptor` already tracks a per-dim `anyWildcard*` flag for
exactly this; the group dim reuses it (`if (r.g == null) anyWildcardGroup = true`),
and the clause is bound only when `!anyWildcardGroup`.

`ScopeRow.matches()` needs no special case — the existing rule ("a null target
dim against a non-null row dim does not match, the row is more specific than the
request") already gives strict behaviour for free.

The other four filtered entities — `AssessmentTable`, `Campaign`,
`InstituteDetail`, `InstituteBranch` — have no group concept, so they simply
omit the clause. The `@FilterDef` javadoc already documents that pattern
("missing dimensions are silently omitted").

**Cost and risk.** This subquery lands on the hottest read path in the app
(every student list). Before enabling it: `EXPLAIN` it against a cohort-sized
dataset, confirm `idx_member_student` is used, and be ready to fall back to
§5.2 if the plan degrades. The `NOT EXISTS` arm in particular is a full
anti-join per row.

### 5.2 Alternative if the filter proves too costly

Keep the tuple at four dims and add an explicit
`@auth.allowsGroup('perm', #groupId)` helper that resolves membership per
request. Cheaper and lower-risk, but it gives **no automatic row-level
narrowing** — a group admin listing students still sees the whole institute
unless every query is changed by hand. Recommend committing to §5.1 but
landing it as its own phase so it can be reverted independently.

### 5.3 ⚠️ None of this enforces anything today

`auth.enforce-mode: log-only` is set in **all four** profile documents, and
`AuthorizationService.recordAndReturn` collapses every deny to `true` outside
enforce mode. So `@PreAuthorize` is a no-op app-wide, and — importantly — so is
the in-method `authorizationService.allows(...)` pattern that
`StudentRoleGroupController` uses, because it routes through the same service.

If these group endpoints must actually enforce before the global flip, they
need a check that does **not** go through `AuthorizationService` — a direct
comparison of the caller's scope rows against the group's institute, returning
403 itself. Same conclusion the admin-impersonation work reached. Decide this
explicitly; do not assume `@PreAuthorize` is protecting the new surface.

---

## 6. Permissions

New `PermissionCode` enum values **and** a seed migration — the
`PermissionCatalogSeedCoverageTest` arch test fails if an enum value is not in
an `INSERT INTO permission` migration:

| Code | For |
|---|---|
| `student_group.read` | list / detail / members / reverse lookups |
| `student_group.create` | create |
| `student_group.update` | rename, describe, activate/deactivate |
| `student_group.delete` | soft delete |
| `student_group.member.manage` | add / remove students |
| `student_group.contact.assign` | allot / unallot the group admin |

Every mapping method needs `@PreAuthorize` or
`ControllerPreAuthorizeCoverageTest` fails. (Both arch tests already fail on a
clean baseline — 7 methods and 12 codes, all pre-existing and unrelated — so
check the failure *lists* rather than the pass/fail bit.)

---

## 7. Controller — `StudentGroupController`, base `/student-groups`

| Verb & path | Permission | Notes |
|---|---|---|
| `POST /student-groups` | `student_group.create` | `{instituteCode, name, description}` |
| `GET /student-groups?instituteCode=` | `student_group.read` | list + `memberCount`, `contactCount` (batch-counted, not N+1) |
| `GET /student-groups/{id}` | `student_group.read` | group + contact persons + members |
| `PUT /student-groups/{id}` | `student_group.update` | name / description / active |
| `DELETE /student-groups/{id}` | `student_group.delete` | soft delete |
| `POST /student-groups/{id}/contact-persons` | `student_group.contact.assign` | `{contactPersonIds:[…]}` bulk, idempotent |
| `DELETE /student-groups/{id}/contact-persons` | `student_group.contact.assign` | `{contactPersonIds:[…]}` bulk |
| `GET /student-groups/{id}/contact-persons` | `student_group.read` | **group → its admins** |
| `POST /student-groups/{id}/members` | `student_group.member.manage` | `{userStudentIds:[…]}` bulk, idempotent |
| `DELETE /student-groups/{id}/members` | `student_group.member.manage` | `{userStudentIds:[…]}` bulk |
| `GET /student-groups/{id}/students` | `student_group.read` | **group → its students**, full student rows |
| `GET /student-groups/by-student/{userStudentId}` | `student_group.read` | student → groups |
| `GET /student-groups/by-contact-person/{contactPersonId}` | `student_group.read` | contact person → groups ("groups I administer") |

Both attachment surfaces are plural and bulk (`POST`/`DELETE` with an id list)
rather than the singular `PUT`/`DELETE` a one-admin model would have used — the
contact endpoints are the member endpoints with a different id column.

Scope every method on the group's **persisted** institute (re-read it from the
group, never trust a body field) — the IDOR guard
`StudentRoleGroupController` already models.

`GET /student-groups/{id}/students` should return the same student shape the
Reports Hub and School Dashboard already consume (name, roll number, class,
section, username, assessment statuses) so those pages can filter by group
without a second call.

---

## 8. Reconciling with `StudentContactAssignment`

Once groups exist, `student_contact_assignment` is a second, weaker way to say
"these students belong to this contact person". Do **not** dual-write. Options:

- **Leave it** for the existing ad-hoc email flows and treat groups as the new
  canonical thing (recommended for phase 1 — zero regression risk).
- **Backfill and retire**: for each contact person with assignments, create one
  group named after them, insert the distinct students as members and the
  contact person into `student_group_contact`, then repoint
  `/contact-person/{id}/assigned-students` at the group read. Note the backfill
  must **de-duplicate** — `student_contact_assignment` has no unique key, so the
  same student may appear several times per contact person, and
  `uk_group_student` will reject the second insert. Cleaner end state, but it
  changes a live email path — its own phase.

Many-to-many admins make the second option strictly better long-term: two
contact persons who today each hold overlapping assignment rows for the same
students collapse into one group with two admins.

Note the existing assign endpoint **emails the contact person on every write**.
The new group endpoints should not; make notification a separate explicit call
so grouping stays silent.

---

## 9. Phasing

| Phase | Scope | Risk |
|---|---|---|
| **1** | Migration, entities, repositories | Low — additive; watch `ddl-auto` (§2) |
| **2** | Service + controller + permissions + seed migration | Low |
| **3** | ABAC tuple: `g` through scope row, JWT, principal, `MeResponse`, FE type | Medium — touches auth; JWT is back/forward compatible |
| **4** | Row-level `@Filter` subquery | **High** — hottest read path; `EXPLAIN` first, revertable alone |
| **5** | Frontend: group management UI + group filter on Reports Hub / School Dashboard | Low |
| **6** | Decide `StudentContactAssignment` fate (§8) | Medium — touches a live email path |

Phases 1–2 deliver everything asked for except the ABAC dimension, and are
independently shippable. Phase 4 is the one to be ready to back out.

---

## 10. Open questions

**Settled.** Many-to-many on both attachments: a group has many contact persons,
a contact person has many groups, a group has many students, a student has many
groups. The schema in §2, the mirrored join tables in §3, and the bulk endpoints
in §7 all reflect this.

**Settled.** Group scope is **strict**: an ungrouped student is not visible to a
group-scoped admin. No `NOT EXISTS` arm, no `OR IS NULL` — see §5.1, including
the enable/disable rule that keeps non-group-scoped admins from seeing nothing.

Still to decide:

1. **Union or explicit-only for group scope?** §5.0 recommends unioning explicit
   `user_role_scope.group_id` rows with derived contact-person groups. Picking
   explicit-only is simpler but means every group admin needs a manual scope
   grant; picking derived-only means non-contact-person staff can never be
   group-scoped.
3. **Enforce now or wait for the global flip?** See §5.3 — `log-only` in every
   profile makes both `@PreAuthorize` and the in-method
   `authorizationService.allows(...)` pattern no-ops today.
4. **Does a student have to be in the group's institute?** Planned yes, hard
   400 (§4.1). Confirm there is no cross-school group use case (shared district
   cohorts, multi-branch trusts) before this is locked in.