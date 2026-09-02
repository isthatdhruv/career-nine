# "Audience is 18+" toggle on cohort mappings → adult consent + field labels

## Context

All four student registration pages assume the registrant is a minor: the shared DPDP consent
checkbox carries parental-consent wording and the contact fields are headed "Parent's Email" /
"Parent's Phone". Campaigns and links now also target 18+ cohorts (college years, adult sessions),
where parental wording is wrong. The fix: a per-class/cohort-row **18+ toggle** in the admin
mapping config. When the registrant's cohort is 18+, every registration page switches to
self-consent wording and "Your Email" / "Your Phone" headers. Default (null/false) keeps today's
minor flow — legacy rows unaffected.

User-approved decisions:
- Granularity: **per class/cohort row** (campaign class routes, school per-class config, B2B mapping row).
- Labels: minor → "Parent's Email/Phone"; adult → "Your Email/Your Phone".
- Adult checkbox copy (approved draft): *"I confirm that I am above 18 years of age; I have read and understood the above; I consent to Career-9 collecting and processing my personal data for the Navigator360™ assessment and report; and I understand I may withdraw this consent at any time."*
- Consent stamping (`dpdp_consent_at`, `payment_transaction.dpdp_consent`) is unchanged — only displayed copy changes. Register endpoints untouched.

Naming everywhere: Java `audience18Plus` · column `audience_18_plus` · JSON `audience18Plus`.
Render rule everywhere: `Boolean.TRUE.equals(...)` / `!!flag` — null means minor.

## 1. DB migration

New: `spring-social/src/main/resources/db/migration/V20260901001__audience_18_plus.sql`
(latest existing is V20260831002). Doc-header comment + the idempotent guarded pattern from
`V20260825001__dpdp_consent_capture.sql` — four blocks of:

```sql
SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '<t>' AND COLUMN_NAME = 'audience_18_plus'),
  'SELECT 1', 'ALTER TABLE <t> ADD COLUMN audience_18_plus BOOLEAN DEFAULT FALSE');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
```

for `campaign_class_assessment`, `campaign_assessment_mapping`, `assessment_institute_mapping`,
`school_assessment_config`.

## 2. Entity fields (4 files, same pattern)

`@Column(name = "audience_18_plus", columnDefinition = "BOOLEAN DEFAULT FALSE") private Boolean audience18Plus = false;`
+ getter/setter + null-coalesce in `@PrePersist` (append to existing method where present, e.g.
AssessmentInstituteMapping ~L107; add the method where absent):

- `spring-social/.../model/career9/b2c/CampaignClassAssessment.java` (B2C class routes)
- `spring-social/.../model/career9/b2c/CampaignAssessmentMapping.java` (B2C non-class deep links)
- `spring-social/.../model/career9/AssessmentInstituteMapping.java` (B2B link + invite; the mapping row IS the cohort row)
- `spring-social/.../model/career9/SchoolAssessmentConfig.java` (school per-class rows)

## 3. Backend write paths

`spring-social/.../controller/career9/b2c/CampaignController.java` — containsKey-guarded
`toBool` writes (mirrors `isActive` at ~L495), in:
- `attachAssessment` POST `/{campaignId}/assessment` (~L296) — guard keeps prior value on soft-delete revive
- `updateMapping` PUT `/assessment/{mappingId}` (~L339)
- `upsertClassRoute` POST `/{campaignId}/class` (~L467) — set on both create and update-existing branches

`spring-social/.../controller/career9/AssessmentInstituteMappingController.java`:
- `POST /create` binds the entity — no change needed
- `PUT /update/{id}` (~L305) copies only `isActive`/`amount` today → add
  `if (updated.getAudience18Plus() != null) existing.setAudience18Plus(updated.getAudience18Plus());`

`spring-social/.../controller/career9/SchoolRegistrationController.java`:
- `POST /config/create` (~L105), `POST /config/batch-save` (~L141: set on both upsert branches;
  B4 deactivation sweep untouched), `PUT /config/update/{configId}` (~L206, containsKey-guarded)

## 4. Backend emit paths (public info JSON)

- `CampaignPublicController.buildInfo` (~L144-284): `assessments[]` entries get
  `audience18Plus` from CampaignAssessmentMapping; `classes[]` entries get it from the route row.
  Both emitted; the SPA picks class-route flag in class-mode, mapping flag in deep-link mode.
- `AssessmentInstituteMappingController` `GET /public/info/{token}` (~L690, next to `isSchool`)
  and `GET /public/student-invite/info/{token}` (~L2113): top-level `audience18Plus` from the mapping.
- `SchoolRegistrationController` `GET /public/info/{token}` (~L465-508): per `classes[]` entry.
- Admin reads serialize entities → flag flows automatically; verify the campaign detail endpoint
  (CampaignEditPage reads `res.data.classRoutes`) serializes rows, add the key if it hand-builds maps.

## 5. Admin UI (react-social)

- `react-social/.../B2C/Campaign/CampaignEditPage.tsx`:
  per-row "18+" switch in the assessments table (~L477-556) → `updateAssessmentMapping(mappingId, {audience18Plus})`;
  per-row switch in the class-routes table (`classRoutes.map` ~L658) → `upsertClassRoute` resending the
  row's `classId/sessionId/assessmentId` + `audience18Plus` (mirror `handleChangeRouteAssessment` ~L325).
- `react-social/.../B2C/API/Campaign_APIs.ts`: add `audience18Plus?: boolean` to `attachAssessment`,
  `updateAssessmentMapping`, `upsertClassRoute` bodies and row interfaces.
- `react-social/.../College/components/AssessmentMappingPanel.tsx`: "Audience is 18+" checkbox in the
  create form (~L329-447, pushed into `handleCreate`'s payload ~L139) + per-row toggle in the mappings
  table next to free/paid toggles (~L578).
- `react-social/.../AssessmentMapping/API/AssessmentMapping_APIs.ts`: type additions on the interface,
  `createAssessmentMapping`, `updateAssessmentMapping`.
- `react-social/.../College/components/SchoolAssessmentMappingPanel.tsx`: extend `classConfigs` state
  value with `audience18Plus?`, hydrate from fetched configs, per-class checkbox next to the assessment
  select (~L374), include in batch-save rows (~L152).
- `react-social/.../SchoolRegistration/API/SchoolRegistration_APIs.ts`: type additions on
  `createSchoolConfig`, `batchSaveSchoolConfigs` rows, `updateSchoolConfig`.

## 6. Student SPA (career-nine-assessment)

**Consent component** `src/components/ParentalConsent.tsx`:
- `export const ADULT_CONSENT_LABEL = <approved draft>`; add `adult?: boolean` prop to
  `ParentalConsentSection` and `ConsentModal`.
- Checkbox label: `adult ? ADULT_CONSENT_LABEL : PARENTAL_CONSENT_LABEL`; link text adult →
  "Read the full consent notice".
- Adult modal variant inside the existing layout (title "Consent — Navigator360™ Career Assessment";
  first-person copy; data list "Your name/class/age, your mobile & email, your responses"; report
  "shared only with you"; keep grievance-officer block).

**Label helper** `src/utils/instituteTerms.ts`: `contactTerms(adult)` →
`{emailLabel, phoneLabel}` = adult ? Your Email/Your Phone : Parent's Email/Parent's Phone.

**Gate toast**: adult → "Please confirm the consent to continue." (minor keeps current wording).

**Pages** (`src/pages/`):
- `CampaignRegisterPage.tsx`: flag types on page-local `CampaignClass` + assessment entry;
  `adult = classMode ? selectedClassRoute.audience18Plus : selectedAssessmentEntry.audience18Plus`;
  labels ~L578/L613 via `contactTerms`; consent ~L737 `adult={adult}`; gate ~L248; **reset the consent
  checkbox in a useEffect when `adult` flips** (class re-selection must re-attest under the new wording).
- `AssessmentRegisterPage.tsx`: `audience18Plus?` on `MappingInfo`
  (`src/api-clients/assessmentMappingAPI.ts` ~L41, next to `isSchool`); whole page switches; labels
  ~L607/L642, consent ~L1000, gate ~L173.
- `SchoolAssessmentRegisterPage.tsx`: flag on class entries in `src/api-clients/schoolRegistrationAPI.ts`;
  `adult` from `selectedClassConfig` (reactive, with the same consent-reset effect); labels ~L495/L515,
  consent ~L656, gate ~L204.
- `AssessmentInviteRegisterPage.tsx`: `audience18Plus?` on `InviteInfo` (~L190-209); read-only `Field`
  labels ~L196/L199 conditional; consent ~L233.
- `DemographicDetailsPage.tsx`: untouched (already the student's own Email/Phone labels).

## Edge cases

- No class selected yet → `adult=false` → minor copy; flips reactively on selection; consent unchecks on flip.
- Legacy/null rows → minor flow everywhere (`TRUE.equals` / `!!`).
- Mixed audiences in one campaign/school: per-row flags, no aggregate.
- School batch-save B4 sweep only flips `isActive` — flag survives deactivation.

## Verification

Note: the working tree also carries the (already-approved, separate) campaign-mail changes; the
builds below compile those too.

- Backend: `cd spring-social && mvn -q -DskipTests compile`; boot once against dev DB → Flyway applies
  V20260901001; boot again → no-op (guard).
- Admin: `cd react-social && npm run typecheck` (61-error baseline — compare counts, don't trust plain tsc).
- SPA: `cd career-nine-assessment && npm run build` (tsc -b).
- End-to-end, each page with the flag ON then OFF:
  1. Campaign class-mode: toggle one class route in CampaignEditPage → `GET /campaign/public/info/{slug}`
     shows `classes[].audience18Plus` → selecting that class flips labels+consent; a minor class flips back
     and unchecks consent.
  2. Campaign deep-link `/c/slug/{assessmentId}/{tierId}`: mapping switch → `assessments[].audience18Plus` → adult rendering.
  3. B2B link: AssessmentMappingPanel create + edit paths persist the flag → top-level flag in
     `GET /assessment-mapping/public/info/{token}` → whole page adult.
  4. Invite: same mapping → `GET .../student-invite/info/{token}` → read-only labels + consent adult.
  5. School: per-class checkbox + batch-save, reload panel (persists) → per-class flag in
     `GET /school-registration/public/info/{token}` → only that class renders adult.
  6. Regression: one adult + one minor registration both stamp `student_info.dpdp_consent_at`.
