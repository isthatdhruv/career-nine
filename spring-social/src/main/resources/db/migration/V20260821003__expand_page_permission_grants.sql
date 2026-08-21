-- ---------------------------------------------------------------------------
-- V20260821003__expand_page_permission_grants.sql
--
-- The admin SPA's page gates move from 33 coarse permission codes to the
-- resource-grained codes the Phase-15 catalog already defines (each page now
-- requires its own resource's code, matching the codes its backend APIs use).
-- Without this data migration, every role that unlocked a page through a
-- coarse code (e.g. assessment.create unlocked /measured-qualities) would
-- lose that page the moment the frontend ships, because the FE can() gate is
-- live even while auth.enforce-mode stays log-only.
--
-- For each role holding an old coarse code, grant the resource-grained codes
-- now gating the pages that coarse code previously unlocked. Coarse codes are
-- NOT revoked: backend endpoints still reference them, and revocation is an
-- admin decision to make in the Roles & Permissions UI, not a migration's.
--
-- Note: the old FE codes career.write and group.write were orphans (never in
-- the permission catalog), so no role holds them and no expansion is needed for
-- the pages they used to gate.
--
-- Idempotent: INSERT IGNORE on the (role_id, permission_id) primary key;
-- unknown codes simply produce no rows (permission lookup returns nothing).
-- ---------------------------------------------------------------------------

-- roles holding assessment.read
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'assessment.read'
JOIN permission p_new ON p_new.code IN ('assessment_question.read', 'demographic_field.read', 'list.read', 'measured_quality.read', 'measured_quality_type.read', 'question_section.read', 'questionnaire.read', 'tool.read');

-- roles holding assessment.create
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'assessment.create'
JOIN permission p_new ON p_new.code IN ('assessment_answer.update', 'assessment_institute_mapping.read', 'assessment_question.create', 'assessment_question.read', 'assessment_question.update', 'assessment.update', 'demographic_field.create', 'demographic_field.update', 'list.read', 'measured_quality.create', 'measured_quality.update', 'measured_quality_type.create', 'measured_quality_type.update', 'assessment_answer.create', 'firebase_data_mapping.read', 'omr_column_mapping.read', 'question_section.create', 'question_section.update', 'questionnaire.create', 'questionnaire.update', 'intermediary_scores.read', 'tool.create', 'tool.update');

-- roles holding user.write
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'user.write'
JOIN permission p_new ON p_new.code IN ('counselling.appointment.read', 'counselling.notification.read', 'counselling.slot.read', 'counselling.student_management.read', 'counsellor.read', 'counselling.availability_template.update', 'counselling.session_notes.update', 'faculty.create', 'faculty.update', 'user.read.all');

-- roles holding user.read
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'user.read'
JOIN permission p_new ON p_new.code IN ('faculty.read', 'lead.read');

-- roles holding permission.grant
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'permission.grant'
JOIN permission p_new ON p_new.code IN ('user_activity_log.read', 'communication_log.read');

-- roles holding campaign.write
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'campaign.write'
JOIN permission p_new ON p_new.code IN ('campaign.create', 'campaign.update', 'pricing_tier.read');

-- roles holding campaign.read
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'campaign.read'
JOIN permission p_new ON p_new.code IN ('tracker.read');

-- roles holding institute.read
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'institute.read'
JOIN permission p_new ON p_new.code IN ('institute_batch.read', 'institute_branch.read', 'institute_course.read', 'institute_session.read', 'section.read', 'contact_person.read', 'dashboard.principal.read');

-- roles holding institute.write
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'institute.write'
JOIN permission p_new ON p_new.code IN ('contact_person.create');

-- roles holding group.read
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'group.read'
JOIN permission p_new ON p_new.code IN ('google_groups.read');

-- roles holding report.read
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'report.read'
JOIN permission p_new ON p_new.code IN ('bet_report_data.read', 'navigator_report_data.read', 'report_generation.read');

-- roles holding payment.refund
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'payment.refund'
JOIN permission p_new ON p_new.code IN ('payment.read', 'promo_code.read');

-- roles holding referral_code.read.all
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'referral_code.read.all'
JOIN permission p_new ON p_new.code IN ('referral_code.read');

-- roles holding student.read
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'student.read'
JOIN permission p_new ON p_new.code IN ('student_group.read', 'live_tracking.read', 'university_mark.read', 'dashboard.teacher.read');

-- roles holding student.write
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'student.write'
JOIN permission p_new ON p_new.code IN ('student.update', 'student.create', 'student.import_bulk');

-- roles holding career.read
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'career.read'
JOIN permission p_new ON p_new.code IN ('career_suggestion.read');

-- roles holding role.assign
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permission rp
JOIN permission p_old ON p_old.id = rp.permission_id AND p_old.code = 'role.assign'
JOIN permission p_new ON p_new.code IN ('role.read');
