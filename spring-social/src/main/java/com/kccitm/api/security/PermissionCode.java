package com.kccitm.api.security;

/**
 * Canonical catalog of permission verbs used by the hybrid RBAC + ABAC
 * authorization model defined in docs/AUTH_REDESIGN_PLAN.md §3.
 *
 * <p>This enum is the single source of truth for permission strings. The
 * {@code permission} database table is seeded from this enum via Flyway
 * migrations {@code V20260511002__seed_permissions.sql} (initial 28 codes)
 * and {@code V20260512001__seed_phase15_permissions.sql} (Phase 15 extension
 * covering controller annotation needs across plans 15-03 / 15-04 / 15-05).
 * Any change to this enum requires a follow-up forward-only migration to
 * keep the DB in sync.
 *
 * <p>String codes follow the {@code resource.verb[.qualifier]} convention
 * and are case-sensitive. Frontend permission checks must use the exact
 * same strings (a TS type will be generated from this enum in a later
 * phase per AUTH_REDESIGN_PLAN.md §7).
 *
 * <p>Phase 14 catalogued the foundational 28 verbs (9 resource families).
 * The Phase 15 preflight extension adds resource-grained codes for the
 * ~265 distinct permission literals required by the controller-annotation
 * sweep (plans 15-03 / 15-04 / 15-05). The {@code write} verb from Phase
 * 14 implicitly covered create+update on the foundational resources; the
 * Phase 15 extension uses explicit {@code create / update / delete}
 * suffixes for the new resource-grained codes (finer-grained audit).
 */
public enum PermissionCode {

    // ── Institute (Phase 14 foundation) ─────────────────────────────────
    INSTITUTE_READ   ("institute.read",   "View institute details"),
    INSTITUTE_WRITE  ("institute.write",  "Create or update institutes"),
    INSTITUTE_DELETE ("institute.delete", "Delete institutes"),

    // ── School cohort insights dashboard (Dashboard 2) ──────────────────
    DASHBOARD_SCHOOL_INSIGHTS_GENERATE("dashboard.school.insights.generate", "Generate/refresh school cohort insight payloads (superadmin)"),
    DASHBOARD_SCHOOL_INSIGHTS_READ("dashboard.school.insights.read", "View the school cohort insights dashboard"),

    // ── Session (Phase 14 foundation) ───────────────────────────────────
    SESSION_READ  ("session.read",  "View academic sessions"),
    SESSION_WRITE ("session.write", "Create or update sessions"),

    // ── Class / course (Phase 14 foundation) ────────────────────────────
    CLASS_READ  ("class.read",  "View classes / courses"),
    CLASS_WRITE ("class.write", "Create or update classes / courses"),

    // ── Section (Phase 14 foundation) ───────────────────────────────────
    SECTION_READ  ("section.read",  "View sections"),
    SECTION_WRITE ("section.write", "Create or update sections"),

    // ── Student (Phase 14 foundation) ───────────────────────────────────
    STUDENT_READ        ("student.read",        "View students"),
    STUDENT_WRITE       ("student.write",       "Create or update students"),
    STUDENT_IMPORT_BULK ("student.import_bulk", "Bulk-import students from CSV/Excel"),

    // ── Assessment (Phase 14 foundation) ────────────────────────────────
    ASSESSMENT_READ    ("assessment.read",    "View assessments"),
    ASSESSMENT_CREATE  ("assessment.create",  "Create assessments"),
    ASSESSMENT_PUBLISH ("assessment.publish", "Publish assessments to students"),
    ASSESSMENT_DELETE  ("assessment.delete",  "Delete assessments"),

    // ── Campaign (Phase 14 foundation) ──────────────────────────────────
    CAMPAIGN_READ    ("campaign.read",    "View marketing/payment campaigns"),
    CAMPAIGN_WRITE   ("campaign.write",   "Create or update campaigns"),
    CAMPAIGN_PUBLISH ("campaign.publish", "Publish/activate campaigns"),

    // ── Report (Phase 14 foundation) ────────────────────────────────────
    REPORT_READ   ("report.read",   "View generated reports"),
    REPORT_EXPORT ("report.export", "Export reports (PDF/Excel)"),

    // ── User (Phase 14 foundation) ──────────────────────────────────────
    USER_READ          ("user.read",          "View user accounts"),
    USER_WRITE         ("user.write",         "Create or update user accounts"),
    USER_TOGGLE_ACTIVE ("user.toggle_active", "Activate or deactivate users"),

    // ── Payment (Phase 14 foundation) ───────────────────────────────────
    PAYMENT_REFUND         ("payment.refund",         "Issue payment refunds"),
    PAYMENT_WEBHOOK_HANDLE ("payment.webhook.handle", "Handle Razorpay webhook (system role)"),

    // ── Role / Permission admin (Phase 14 foundation) ───────────────────
    ROLE_ASSIGN      ("role.assign",      "Assign roles to users"),
    PERMISSION_GRANT ("permission.grant", "Grant/revoke individual permissions"),

    // ════════════════════════════════════════════════════════════════════
    // Phase 15 PREFLIGHT EXTENSION (V20260512001)
    // Codes required by plans 15-03 / 15-04 / 15-05 controller annotations.
    // ════════════════════════════════════════════════════════════════════

    // ── Assessment (additional verbs) ───────────────────────────────────
    ASSESSMENT_READ_ALL ("assessment.read.all", "View assessments across all scopes"),
    ASSESSMENT_UPDATE   ("assessment.update",   "Update assessment definitions"),
    ASSESSMENT_START    ("assessment.start",    "Start an assessment session"),
    ASSESSMENT_SUBMIT   ("assessment.submit",   "Submit an assessment session"),
    ASSESSMENT_PREFETCH ("assessment.prefetch", "Prefetch assessment payload for student app"),

    // ── Student (additional verbs) ──────────────────────────────────────
    STUDENT_CREATE   ("student.create",   "Create individual students"),
    STUDENT_UPDATE   ("student.update",   "Update individual students"),
    STUDENT_DELETE   ("student.delete",   "Delete individual students"),
    STUDENT_READ_ALL ("student.read.all", "View students across all scopes"),
    STUDENT_IMPORT   ("student.import",   "Import students (single-row CSV/Excel)"),
    STUDENT_EXPORT   ("student.export",   "Export student lists (CSV/Excel/PDF)"),

    // ── Student Management (clone of Data Download without any export paths) ──
    // Gates the /student-management SPA page: roster view, allot, reset, edit
    // basic info, demographics view. Separate from STUDENT_READ so admins can
    // grant management without granting answer/proctoring/report downloads.
    STUDENT_MANAGEMENT_READ   ("student_management.read",   "View Student Management page (no data downloads)"),
    STUDENT_MANAGEMENT_UPDATE ("student_management.update", "Allot / reset / edit students from Student Management"),

    // ── User (additional verbs) ─────────────────────────────────────────
    USER_ME       ("user.me",       "View own user profile"),
    USER_READ_ALL ("user.read.all", "View user accounts across all scopes"),
    USER_CREATE   ("user.create",   "Create user accounts"),
    USER_UPDATE   ("user.update",   "Update user accounts"),
    USER_DELETE   ("user.delete",   "Delete user accounts"),

    // ── Role / RoleGroup admin ──────────────────────────────────────────
    ROLE_READ                              ("role.read",                              "View roles"),
    ROLE_READ_ALL                          ("role.read.all",                          "View all roles across scopes"),
    ROLE_CREATE                            ("role.create",                            "Create roles"),
    ROLE_UPDATE                            ("role.update",                            "Update roles"),
    ROLE_DELETE                            ("role.delete",                            "Delete roles"),
    ROLE_GROUP_READ                        ("role_group.read",                        "View role groups"),
    ROLE_GROUP_READ_ALL                    ("role_group.read.all",                    "View all role groups across scopes"),
    ROLE_GROUP_CREATE                      ("role_group.create",                      "Create role groups"),
    ROLE_GROUP_UPDATE                      ("role_group.update",                      "Update role groups"),
    ROLE_GROUP_DELETE                      ("role_group.delete",                      "Delete role groups"),
    ROLE_ROLE_GROUP_MAPPING_READ           ("role_role_group_mapping.read",           "View role-to-role-group mappings"),
    ROLE_ROLE_GROUP_MAPPING_READ_ALL       ("role_role_group_mapping.read.all",       "View all role-to-role-group mappings across scopes"),
    ROLE_ROLE_GROUP_MAPPING_CREATE         ("role_role_group_mapping.create",         "Create role-to-role-group mappings"),
    ROLE_ROLE_GROUP_MAPPING_UPDATE         ("role_role_group_mapping.update",         "Update role-to-role-group mappings"),
    ROLE_ROLE_GROUP_MAPPING_DELETE         ("role_role_group_mapping.delete",         "Delete role-to-role-group mappings"),
    USER_ROLE_GROUP_MAPPING_READ           ("user_role_group_mapping.read",           "View user-to-role-group mappings"),
    USER_ROLE_GROUP_MAPPING_READ_ALL       ("user_role_group_mapping.read.all",       "View all user-to-role-group mappings across scopes"),
    USER_ROLE_GROUP_MAPPING_CREATE         ("user_role_group_mapping.create",         "Create user-to-role-group mappings"),
    USER_ROLE_GROUP_MAPPING_UPDATE         ("user_role_group_mapping.update",         "Update user-to-role-group mappings"),
    USER_ROLE_GROUP_MAPPING_DELETE         ("user_role_group_mapping.delete",         "Delete user-to-role-group mappings"),

    // ── Groups / Google admin ───────────────────────────────────────────
    GROUP_READ          ("group.read",          "View groups"),
    GROUP_READ_ALL      ("group.read.all",      "View all groups across scopes"),
    GROUP_CREATE        ("group.create",        "Create groups"),
    GROUP_UPDATE        ("group.update",        "Update groups"),
    GROUP_DELETE        ("group.delete",        "Delete groups"),
    GOOGLE_ADMIN_READ   ("google_admin.read",   "View Google Workspace admin data"),
    GOOGLE_ADMIN_CREATE ("google_admin.create", "Create Google Workspace admin entities"),
    GOOGLE_ADMIN_UPDATE ("google_admin.update", "Update Google Workspace admin entities"),
    GOOGLE_ADMIN_DELETE ("google_admin.delete", "Delete Google Workspace admin entities"),
    GOOGLE_GROUPS_READ   ("google_groups.read",   "View Google Workspace groups"),
    GOOGLE_GROUPS_CREATE ("google_groups.create", "Create Google Workspace groups"),
    GOOGLE_GROUPS_UPDATE ("google_groups.update", "Update Google Workspace groups"),
    GOOGLE_GROUPS_DELETE ("google_groups.delete", "Delete Google Workspace groups"),

    // ── Misc utility surfaces ───────────────────────────────────────────
    DATA_READ    ("data.read",    "View bulk data dumps"),
    LIST_READ    ("list.read",    "View list endpoints"),
    UTIL_READ    ("util.read",    "View utility endpoint output"),
    UTIL_EXECUTE ("util.execute", "Execute utility operations"),

    // ── Institute family (resource-grained extension) ───────────────────
    INSTITUTE_BATCH_READ                       ("institute_batch.read",                       "View institute batches"),
    INSTITUTE_BATCH_READ_ALL                   ("institute_batch.read.all",                   "View all institute batches across scopes"),
    INSTITUTE_BATCH_CREATE                     ("institute_batch.create",                     "Create institute batches"),
    INSTITUTE_BATCH_UPDATE                     ("institute_batch.update",                     "Update institute batches"),
    INSTITUTE_BATCH_DELETE                     ("institute_batch.delete",                     "Delete institute batches"),
    INSTITUTE_BRANCH_READ                      ("institute_branch.read",                      "View institute branches"),
    INSTITUTE_BRANCH_READ_ALL                  ("institute_branch.read.all",                  "View all institute branches across scopes"),
    INSTITUTE_BRANCH_CREATE                    ("institute_branch.create",                    "Create institute branches"),
    INSTITUTE_BRANCH_UPDATE                    ("institute_branch.update",                    "Update institute branches"),
    INSTITUTE_BRANCH_DELETE                    ("institute_branch.delete",                    "Delete institute branches"),
    INSTITUTE_BRANCH_BATCH_MAPPING_READ        ("institute_branch_batch_mapping.read",        "View institute branch-batch mappings"),
    INSTITUTE_BRANCH_BATCH_MAPPING_READ_ALL    ("institute_branch_batch_mapping.read.all",    "View all institute branch-batch mappings across scopes"),
    INSTITUTE_BRANCH_BATCH_MAPPING_CREATE      ("institute_branch_batch_mapping.create",      "Create institute branch-batch mappings"),
    INSTITUTE_BRANCH_BATCH_MAPPING_UPDATE      ("institute_branch_batch_mapping.update",      "Update institute branch-batch mappings"),
    INSTITUTE_BRANCH_BATCH_MAPPING_DELETE      ("institute_branch_batch_mapping.delete",      "Delete institute branch-batch mappings"),
    INSTITUTE_COURSE_READ                      ("institute_course.read",                      "View institute courses"),
    INSTITUTE_COURSE_READ_ALL                  ("institute_course.read.all",                  "View all institute courses across scopes"),
    INSTITUTE_COURSE_CREATE                    ("institute_course.create",                    "Create institute courses"),
    INSTITUTE_COURSE_UPDATE                    ("institute_course.update",                    "Update institute courses"),
    INSTITUTE_COURSE_DELETE                    ("institute_course.delete",                    "Delete institute courses"),
    INSTITUTE_SESSION_READ                     ("institute_session.read",                     "View institute sessions"),
    INSTITUTE_SESSION_READ_ALL                 ("institute_session.read.all",                 "View all institute sessions across scopes"),
    INSTITUTE_SESSION_CREATE                   ("institute_session.create",                   "Create institute sessions"),
    INSTITUTE_SESSION_UPDATE                   ("institute_session.update",                   "Update institute sessions"),
    INSTITUTE_SESSION_DELETE                   ("institute_session.delete",                   "Delete institute sessions"),
    INSTITUTE_DETAIL_READ                      ("institute_detail.read",                      "View institute detail records"),
    INSTITUTE_DETAIL_READ_ALL                  ("institute_detail.read.all",                  "View all institute detail records across scopes"),
    INSTITUTE_DETAIL_CREATE                    ("institute_detail.create",                    "Create institute detail records"),
    INSTITUTE_DETAIL_UPDATE                    ("institute_detail.update",                    "Update institute detail records"),
    INSTITUTE_DETAIL_DELETE                    ("institute_detail.delete",                    "Delete institute detail records"),

    // ── Report / Dashboard / SchoolSession ──────────────────────────────
    REPORT_GENERATION_READ      ("report_generation.read",      "View report-generation jobs"),
    REPORT_GENERATION_READ_ALL  ("report_generation.read.all",  "View all report-generation jobs across scopes"),
    REPORT_GENERATION_CREATE    ("report_generation.create",    "Create report-generation jobs"),
    REPORT_GENERATION_UPDATE    ("report_generation.update",    "Update report-generation jobs"),
    REPORT_GENERATION_DELETE    ("report_generation.delete",    "Delete report-generation jobs"),
    SCHOOL_SESSION_READ         ("school_session.read",         "View school sessions"),
    SCHOOL_SESSION_READ_ALL     ("school_session.read.all",     "View all school sessions across scopes"),
    SCHOOL_SESSION_CREATE       ("school_session.create",       "Create school sessions"),
    SCHOOL_SESSION_UPDATE       ("school_session.update",       "Update school sessions"),
    SCHOOL_SESSION_DELETE       ("school_session.delete",       "Delete school sessions"),
    DASHBOARD_ADMIN             ("dashboard.admin",             "Access admin dashboard"),
    DASHBOARD_ADMIN_READ        ("dashboard.admin.read",        "Read admin dashboard data"),
    // Phase 0 (Task 0.3): write/recompute permission for POST /dashboard/admin/snapshot/refresh,
    // separated from the read so the heavier on-demand recompute can be granted independently.
    DASHBOARD_ADMIN_REFRESH     ("dashboard.admin.refresh",     "Force-recompute the admin dashboard snapshot"),
    DASHBOARD_PRINCIPAL         ("dashboard.principal",         "Access principal dashboard"),
    DASHBOARD_PRINCIPAL_READ    ("dashboard.principal.read",    "Read principal dashboard data"),
    DASHBOARD_TEACHER           ("dashboard.teacher",           "Access teacher dashboard"),
    DASHBOARD_TEACHER_READ      ("dashboard.teacher.read",      "Read teacher dashboard data"),

    // ── Payments + b2c ──────────────────────────────────────────────────
    PAYMENT_CREATE         ("payment.create",         "Create payments"),
    PAYMENT_UPDATE         ("payment.update",         "Update payment state and send nudge / link-resend communications"),
    PAYMENT_VERIFY         ("payment.verify",         "Verify payments"),
    PAYMENT_READ           ("payment.read",           "View payments"),
    PAYMENT_READ_ALL       ("payment.read.all",       "View all payments across scopes"),
    PAYMENT_WEBHOOK_READ   ("payment_webhook.read",   "View payment webhook records"),
    PAYMENT_WEBHOOK_LIST   ("payment_webhook.list",   "List payment webhook records"),
    PROMO_CODE_READ        ("promo_code.read",        "View promo codes"),
    PROMO_CODE_READ_ALL    ("promo_code.read.all",    "View all promo codes across scopes"),
    PROMO_CODE_CREATE      ("promo_code.create",      "Create promo codes"),
    PROMO_CODE_UPDATE      ("promo_code.update",      "Update promo codes"),
    PROMO_CODE_DELETE      ("promo_code.delete",      "Delete promo codes"),
    REFERRAL_CODE_READ     ("referral_code.read",     "View referral codes"),
    REFERRAL_CODE_READ_ALL ("referral_code.read.all", "View all referral codes across scopes"),
    REFERRAL_CODE_CREATE   ("referral_code.create",   "Create referral codes"),
    REFERRAL_CODE_UPDATE   ("referral_code.update",   "Update referral codes"),
    REFERRAL_CODE_DELETE   ("referral_code.delete",   "Delete referral codes"),
    CAMPAIGN_PUBLIC        ("campaign.public",        "Access public-facing campaign endpoints"),
    CAMPAIGN_CREATE        ("campaign.create",        "Create campaigns"),
    CAMPAIGN_UPDATE        ("campaign.update",        "Update campaigns"),
    CAMPAIGN_DELETE        ("campaign.delete",        "Delete campaigns"),
    CAMPAIGN_READ_ALL      ("campaign.read.all",      "View all campaigns across scopes"),
    ENTITLEMENT_READ       ("entitlement.read",       "View entitlements"),
    ENTITLEMENT_READ_ALL   ("entitlement.read.all",   "View all entitlements across scopes"),
    ENTITLEMENT_CREATE     ("entitlement.create",     "Create entitlements"),
    ENTITLEMENT_UPDATE     ("entitlement.update",     "Update entitlements"),
    ENTITLEMENT_DELETE     ("entitlement.delete",     "Delete entitlements"),
    PRICING_TIER_READ      ("pricing_tier.read",      "View pricing tiers"),
    PRICING_TIER_READ_ALL  ("pricing_tier.read.all",  "View all pricing tiers across scopes"),
    PRICING_TIER_CREATE    ("pricing_tier.create",    "Create pricing tiers"),
    PRICING_TIER_UPDATE    ("pricing_tier.update",    "Update pricing tiers"),
    PRICING_TIER_DELETE    ("pricing_tier.delete",    "Delete pricing tiers"),
    REPORT_PREPARATION_READ   ("report_preparation.read",   "View report-preparation records"),
    REPORT_PREPARATION_CREATE ("report_preparation.create", "Create report-preparation records"),
    REPORT_PREPARATION_UPDATE ("report_preparation.update", "Update report-preparation records"),
    REPORT_PREPARATION_DELETE ("report_preparation.delete", "Delete report-preparation records"),
    TRACKER_READ           ("tracker.read",           "View trackers"),
    TRACKER_READ_ALL       ("tracker.read.all",       "View all trackers across scopes"),
    TRACKER_CREATE         ("tracker.create",         "Create trackers"),
    TRACKER_UPDATE         ("tracker.update",         "Update trackers"),
    TRACKER_DELETE         ("tracker.delete",         "Delete trackers"),

    // ── Assessment-core resource-grained (Task 1 of 15-04) ──────────────
    ASSESSMENT_ANSWER_READ      ("assessment_answer.read",      "View assessment answers"),
    ASSESSMENT_ANSWER_READ_ALL  ("assessment_answer.read.all",  "View all assessment answers across scopes"),
    ASSESSMENT_ANSWER_CREATE    ("assessment_answer.create",    "Create assessment answers"),
    ASSESSMENT_ANSWER_UPDATE    ("assessment_answer.update",    "Update assessment answers"),
    ASSESSMENT_ANSWER_DELETE    ("assessment_answer.delete",    "Delete assessment answers"),
    ASSESSMENT_ANSWER_SUBMIT    ("assessment_answer.submit",    "Submit assessment answers"),
    ASSESSMENT_DEMOGRAPHIC_MAPPING_READ   ("assessment_demographic_mapping.read",   "View assessment-demographic mappings"),
    ASSESSMENT_DEMOGRAPHIC_MAPPING_CREATE ("assessment_demographic_mapping.create", "Create assessment-demographic mappings"),
    ASSESSMENT_DEMOGRAPHIC_MAPPING_UPDATE ("assessment_demographic_mapping.update", "Update assessment-demographic mappings"),
    ASSESSMENT_DEMOGRAPHIC_MAPPING_DELETE ("assessment_demographic_mapping.delete", "Delete assessment-demographic mappings"),
    ASSESSMENT_INSTITUTE_MAPPING_READ     ("assessment_institute_mapping.read",     "View assessment-institute mappings"),
    ASSESSMENT_INSTITUTE_MAPPING_CREATE   ("assessment_institute_mapping.create",   "Create assessment-institute mappings"),
    ASSESSMENT_INSTITUTE_MAPPING_UPDATE   ("assessment_institute_mapping.update",   "Update assessment-institute mappings"),
    ASSESSMENT_INSTITUTE_MAPPING_DELETE   ("assessment_institute_mapping.delete",   "Delete assessment-institute mappings"),
    ASSESSMENT_PROCTORING_READ   ("assessment_proctoring.read",   "View assessment proctoring data"),
    ASSESSMENT_PROCTORING_CREATE ("assessment_proctoring.create", "Create assessment proctoring records"),
    ASSESSMENT_PROCTORING_UPDATE ("assessment_proctoring.update", "Update assessment proctoring records"),
    ASSESSMENT_PROCTORING_DELETE ("assessment_proctoring.delete", "Delete assessment proctoring records"),
    ASSESSMENT_QUESTION_READ      ("assessment_question.read",      "View assessment questions"),
    ASSESSMENT_QUESTION_READ_ALL  ("assessment_question.read.all",  "View all assessment questions across scopes"),
    ASSESSMENT_QUESTION_CREATE    ("assessment_question.create",    "Create assessment questions"),
    ASSESSMENT_QUESTION_UPDATE    ("assessment_question.update",    "Update assessment questions"),
    ASSESSMENT_QUESTION_DELETE    ("assessment_question.delete",    "Delete assessment questions"),
    ASSESSMENT_QUESTION_IMPORT    ("assessment_question.import",    "Import assessment questions from Excel"),
    ASSESSMENT_QUESTION_EXPORT    ("assessment_question.export",    "Export assessment questions to Excel"),
    ASSESSMENT_QUESTION_OPTION_READ   ("assessment_question_option.read",   "View assessment-question options"),
    ASSESSMENT_QUESTION_OPTION_CREATE ("assessment_question_option.create", "Create assessment-question options"),
    ASSESSMENT_QUESTION_OPTION_UPDATE ("assessment_question_option.update", "Update assessment-question options"),
    ASSESSMENT_QUESTION_OPTION_DELETE ("assessment_question_option.delete", "Delete assessment-question options"),
    BET_REPORT_DATA_READ      ("bet_report_data.read",      "View BET report data"),
    BET_REPORT_DATA_READ_ALL  ("bet_report_data.read.all",  "View all BET report data across scopes"),
    BET_REPORT_DATA_CREATE    ("bet_report_data.create",    "Create BET report data"),
    BET_REPORT_DATA_UPDATE    ("bet_report_data.update",    "Update BET report data"),
    BET_REPORT_DATA_DELETE    ("bet_report_data.delete",    "Delete BET report data"),
    DASHBOARD_SNAPSHOT_READ   ("dashboard_snapshot.read",   "View dashboard snapshots"),
    DASHBOARD_SNAPSHOT_CREATE ("dashboard_snapshot.create", "Create dashboard snapshots"),
    DASHBOARD_SNAPSHOT_UPDATE ("dashboard_snapshot.update", "Update dashboard snapshots"),
    FOUR_PAGER_TEMPLATE_READ   ("four_pager_template.read",   "View 4-pager report templates"),
    FOUR_PAGER_TEMPLATE_UPDATE ("four_pager_template.update", "Update 4-pager report templates"),
    GAME_RESULTS_READ   ("game_results.read",   "View game results"),
    GAME_RESULTS_CREATE ("game_results.create", "Create game results"),
    GAME_RESULTS_UPDATE ("game_results.update", "Update game results"),
    GAME_RESULTS_DELETE ("game_results.delete", "Delete game results"),
    GAME_TABLE_READ   ("game_table.read",   "View game-table definitions"),
    GAME_TABLE_CREATE ("game_table.create", "Create game-table definitions"),
    GAME_TABLE_UPDATE ("game_table.update", "Update game-table definitions"),
    GAME_TABLE_DELETE ("game_table.delete", "Delete game-table definitions"),
    GENERAL_ASSESSMENT_READ   ("general_assessment.read",   "View general assessments"),
    GENERAL_ASSESSMENT_CREATE ("general_assessment.create", "Create general assessments"),
    GENERAL_ASSESSMENT_UPDATE ("general_assessment.update", "Update general assessments"),
    GENERAL_ASSESSMENT_DELETE ("general_assessment.delete", "Delete general assessments"),
    GENERATED_REPORT_READ      ("generated_report.read",      "View generated reports"),
    GENERATED_REPORT_READ_ALL  ("generated_report.read.all",  "View all generated reports across scopes"),
    GENERATED_REPORT_CREATE    ("generated_report.create",    "Create generated reports"),
    GENERATED_REPORT_UPDATE    ("generated_report.update",    "Update generated reports"),
    GENERATED_REPORT_DELETE    ("generated_report.delete",    "Delete generated reports"),
    NAVIGATOR_REPORT_DATA_READ      ("navigator_report_data.read",      "View Navigator report data"),
    NAVIGATOR_REPORT_DATA_READ_ALL  ("navigator_report_data.read.all",  "View all Navigator report data across scopes"),
    NAVIGATOR_REPORT_DATA_CREATE    ("navigator_report_data.create",    "Create Navigator report data"),
    NAVIGATOR_REPORT_DATA_UPDATE    ("navigator_report_data.update",    "Update Navigator report data"),
    NAVIGATOR_REPORT_DATA_DELETE    ("navigator_report_data.delete",    "Delete Navigator report data"),

    // ── Question-bank + scoring + tooling (Task 2 of 15-04) ─────────────
    LANGUAGE_OPTION_READ   ("language_option.read",   "View language options"),
    LANGUAGE_OPTION_CREATE ("language_option.create", "Create language options"),
    LANGUAGE_OPTION_UPDATE ("language_option.update", "Update language options"),
    LANGUAGE_OPTION_DELETE ("language_option.delete", "Delete language options"),
    LANGUAGE_QUESTION_READ   ("language_question.read",   "View language questions"),
    LANGUAGE_QUESTION_CREATE ("language_question.create", "Create language questions"),
    LANGUAGE_QUESTION_UPDATE ("language_question.update", "Update language questions"),
    LANGUAGE_QUESTION_DELETE ("language_question.delete", "Delete language questions"),
    LANGUAGE_SUPPORTED_READ   ("language_supported.read",   "View supported languages"),
    LANGUAGE_SUPPORTED_CREATE ("language_supported.create", "Create supported languages"),
    LANGUAGE_SUPPORTED_UPDATE ("language_supported.update", "Update supported languages"),
    LANGUAGE_SUPPORTED_DELETE ("language_supported.delete", "Delete supported languages"),
    MEASURED_QUALITY_READ   ("measured_quality.read",   "View measured qualities"),
    MEASURED_QUALITY_CREATE ("measured_quality.create", "Create measured qualities"),
    MEASURED_QUALITY_UPDATE ("measured_quality.update", "Update measured qualities"),
    MEASURED_QUALITY_DELETE ("measured_quality.delete", "Delete measured qualities"),
    MEASURED_QUALITY_TYPE_READ   ("measured_quality_type.read",   "View measured-quality types"),
    MEASURED_QUALITY_TYPE_CREATE ("measured_quality_type.create", "Create measured-quality types"),
    MEASURED_QUALITY_TYPE_UPDATE ("measured_quality_type.update", "Update measured-quality types"),
    MEASURED_QUALITY_TYPE_DELETE ("measured_quality_type.delete", "Delete measured-quality types"),
    OMR_COLUMN_MAPPING_READ   ("omr_column_mapping.read",   "View OMR column mappings"),
    OMR_COLUMN_MAPPING_CREATE ("omr_column_mapping.create", "Create OMR column mappings"),
    OMR_COLUMN_MAPPING_UPDATE ("omr_column_mapping.update", "Update OMR column mappings"),
    OMR_COLUMN_MAPPING_DELETE ("omr_column_mapping.delete", "Delete OMR column mappings"),
    OPTION_SCORE_READ   ("option_score.read",   "View option scores"),
    OPTION_SCORE_CREATE ("option_score.create", "Create option scores"),
    OPTION_SCORE_UPDATE ("option_score.update", "Update option scores"),
    OPTION_SCORE_DELETE ("option_score.delete", "Delete option scores"),
    QUESTION_MEDIA_READ   ("question_media.read",   "View question media"),
    QUESTION_MEDIA_CREATE ("question_media.create", "Create question media"),
    QUESTION_MEDIA_DELETE ("question_media.delete", "Delete question media"),
    QUESTION_SECTION_READ   ("question_section.read",   "View question sections"),
    QUESTION_SECTION_CREATE ("question_section.create", "Create question sections"),
    QUESTION_SECTION_UPDATE ("question_section.update", "Update question sections"),
    QUESTION_SECTION_DELETE ("question_section.delete", "Delete question sections"),
    QUESTIONNAIRE_READ      ("questionnaire.read",      "View questionnaires"),
    QUESTIONNAIRE_READ_ALL  ("questionnaire.read.all",  "View all questionnaires across scopes"),
    QUESTIONNAIRE_CREATE    ("questionnaire.create",    "Create questionnaires"),
    QUESTIONNAIRE_UPDATE    ("questionnaire.update",    "Update questionnaires"),
    QUESTIONNAIRE_DELETE    ("questionnaire.delete",    "Delete questionnaires"),
    QUESTIONNAIRE_LANGUAGE_READ   ("questionnaire_language.read",   "View questionnaire languages"),
    QUESTIONNAIRE_LANGUAGE_CREATE ("questionnaire_language.create", "Create questionnaire languages"),
    QUESTIONNAIRE_LANGUAGE_UPDATE ("questionnaire_language.update", "Update questionnaire languages"),
    QUESTIONNAIRE_LANGUAGE_DELETE ("questionnaire_language.delete", "Delete questionnaire languages"),
    REPORT_TEMPLATE_READ   ("report_template.read",   "View report templates"),
    REPORT_TEMPLATE_CREATE ("report_template.create", "Create report templates"),
    REPORT_TEMPLATE_UPDATE ("report_template.update", "Update report templates"),
    REPORT_TEMPLATE_DELETE ("report_template.delete", "Delete report templates"),
    REPORT_ZIP_READ   ("report_zip.read",   "View report ZIP bundles"),
    REPORT_ZIP_CREATE ("report_zip.create", "Create report ZIP bundles"),
    REPORT_ZIP_UPDATE ("report_zip.update", "Update report ZIP bundles"),
    TOOL_READ   ("tool.read",   "View psychometric tools"),
    TOOL_CREATE ("tool.create", "Create psychometric tools"),
    TOOL_UPDATE ("tool.update", "Update psychometric tools"),
    TOOL_DELETE ("tool.delete", "Delete psychometric tools"),

    // ── Student / counselling / b2c student-side (15-03 scope) ──────────
    STUDENT_INFO_READ      ("student_info.read",      "View student info records"),
    STUDENT_INFO_READ_ALL  ("student_info.read.all",  "View all student info records across scopes"),
    STUDENT_INFO_CREATE    ("student_info.create",    "Create student info records"),
    STUDENT_INFO_UPDATE    ("student_info.update",    "Update student info records"),
    STUDENT_INFO_DELETE    ("student_info.delete",    "Delete student info records"),
    STUDENT_INFO_IMPORT    ("student_info.import",    "Import student info records"),
    TEMPORARY_STUDENT_READ   ("temporary_student.read",   "View temporary students"),
    TEMPORARY_STUDENT_CREATE ("temporary_student.create", "Create temporary students"),
    TEMPORARY_STUDENT_UPDATE ("temporary_student.update", "Update temporary students"),
    TEMPORARY_STUDENT_DELETE ("temporary_student.delete", "Delete temporary students"),
    CONTACT_PERSON_READ   ("contact_person.read",   "View contact persons"),
    CONTACT_PERSON_CREATE ("contact_person.create", "Create contact persons"),
    CONTACT_PERSON_UPDATE ("contact_person.update", "Update contact persons"),
    CONTACT_PERSON_DELETE ("contact_person.delete", "Delete contact persons"),
    FACULTY_READ   ("faculty.read",   "View faculty"),
    FACULTY_CREATE ("faculty.create", "Create faculty"),
    FACULTY_UPDATE ("faculty.update", "Update faculty"),
    FACULTY_DELETE ("faculty.delete", "Delete faculty"),
    TOPIC_READ   ("topic.read",   "View topics"),
    TOPIC_CREATE ("topic.create", "Create topics"),
    TOPIC_UPDATE ("topic.update", "Update topics"),
    TOPIC_DELETE ("topic.delete", "Delete topics"),
    UNIVERSITY_MARK_READ   ("university_mark.read",   "View university marks"),
    UNIVERSITY_MARK_CREATE ("university_mark.create", "Create university marks"),
    UNIVERSITY_MARK_UPDATE ("university_mark.update", "Update university marks"),
    UNIVERSITY_MARK_DELETE ("university_mark.delete", "Delete university marks"),
    CODING_QUESTION_READ   ("coding_question.read",   "View coding questions"),
    CODING_QUESTION_CREATE ("coding_question.create", "Create coding questions"),
    CODING_QUESTION_UPDATE ("coding_question.update", "Update coding questions"),
    CODING_QUESTION_DELETE ("coding_question.delete", "Delete coding questions"),
    COMPILER_READ   ("compiler.read",   "View compiler endpoints"),
    COMPILER_SUBMIT ("compiler.submit", "Submit code to compiler"),
    COMPILER_QUESTION_LOG_READ   ("compiler_question_log.read",   "View compiler-question logs"),
    COMPILER_QUESTION_LOG_CREATE ("compiler_question_log.create", "Create compiler-question log entries"),
    EMAIL_SEND     ("email.send",     "Send transactional email"),
    EMAIL_VALIDATE ("email.validate", "Validate email addresses (OTP flow)"),
    STUDENT_INSTITUTE_MEMBERSHIP_READ   ("student_institute_membership.read",   "View student-institute memberships"),
    STUDENT_INSTITUTE_MEMBERSHIP_CREATE ("student_institute_membership.create", "Create student-institute memberships"),
    STUDENT_INSTITUTE_MEMBERSHIP_UPDATE ("student_institute_membership.update", "Update student-institute memberships"),
    STUDENT_INSTITUTE_MEMBERSHIP_DELETE ("student_institute_membership.delete", "Delete student-institute memberships"),
    STUDENT_DEMOGRAPHIC_RESPONSE_READ   ("student_demographic_response.read",   "View student demographic responses"),
    STUDENT_DEMOGRAPHIC_RESPONSE_CREATE ("student_demographic_response.create", "Create student demographic responses"),
    STUDENT_DEMOGRAPHIC_RESPONSE_UPDATE ("student_demographic_response.update", "Update student demographic responses"),
    STUDENT_DEMOGRAPHIC_RESPONSE_DELETE ("student_demographic_response.delete", "Delete student demographic responses"),
    DEMOGRAPHIC_FIELD_READ   ("demographic_field.read",   "View demographic fields"),
    DEMOGRAPHIC_FIELD_CREATE ("demographic_field.create", "Create demographic fields"),
    DEMOGRAPHIC_FIELD_UPDATE ("demographic_field.update", "Update demographic fields"),
    DEMOGRAPHIC_FIELD_DELETE ("demographic_field.delete", "Delete demographic fields"),
    LEAD_READ   ("lead.read",   "View leads"),
    LEAD_CREATE ("lead.create", "Create leads"),
    LEAD_UPDATE ("lead.update", "Update leads"),
    LEAD_DELETE ("lead.delete", "Delete leads"),
    LIVE_TRACKING_READ   ("live_tracking.read",   "View live-tracking events"),
    LIVE_TRACKING_CREATE ("live_tracking.create", "Create live-tracking events"),
    HEARTBEAT_PING ("heartbeat.ping", "Heartbeat ping (anonymous health probe)"),
    SCHOOL_REGISTRATION_READ   ("school_registration.read",   "View school registrations"),
    SCHOOL_REGISTRATION_CREATE ("school_registration.create", "Create school registrations"),
    SCHOOL_REGISTRATION_UPDATE ("school_registration.update", "Update school registrations"),
    SCHOOL_REGISTRATION_DELETE ("school_registration.delete", "Delete school registrations"),
    CAREER_READ   ("career.read",   "View careers"),
    CAREER_CREATE ("career.create", "Create careers"),
    CAREER_UPDATE ("career.update", "Update careers"),
    CAREER_DELETE ("career.delete", "Delete careers"),
    CAREER_SUGGESTION_READ   ("career_suggestion.read",   "View career suggestions"),
    CAREER_SUGGESTION_CREATE ("career_suggestion.create", "Create career suggestions"),
    CAREER_SUGGESTION_UPDATE ("career_suggestion.update", "Update career suggestions"),
    CAREER_SUGGESTION_DELETE ("career_suggestion.delete", "Delete career suggestions"),
    COMMUNICATION_LOG_READ   ("communication_log.read",   "View communication logs"),
    COMMUNICATION_LOG_CREATE ("communication_log.create", "Create communication-log entries"),
    USER_ACTIVITY_LOG_READ   ("user_activity_log.read",   "View user activity logs"),
    USER_ACTIVITY_LOG_CREATE ("user_activity_log.create", "Create user activity log entries"),
    FIREBASE_DATA_MAPPING_READ   ("firebase_data_mapping.read",   "View Firebase data mappings"),
    FIREBASE_DATA_MAPPING_CREATE ("firebase_data_mapping.create", "Create Firebase data mappings"),
    FIREBASE_DATA_MAPPING_UPDATE ("firebase_data_mapping.update", "Update Firebase data mappings"),
    FIREBASE_DATA_MAPPING_DELETE ("firebase_data_mapping.delete", "Delete Firebase data mappings"),

    // ── Counselling subdomain ───────────────────────────────────────────
    COUNSELLING_AVAILABILITY_TEMPLATE_READ   ("counselling.availability_template.read",   "View counselling availability templates"),
    COUNSELLING_AVAILABILITY_TEMPLATE_CREATE ("counselling.availability_template.create", "Create counselling availability templates"),
    COUNSELLING_AVAILABILITY_TEMPLATE_UPDATE ("counselling.availability_template.update", "Update counselling availability templates"),
    COUNSELLING_AVAILABILITY_TEMPLATE_DELETE ("counselling.availability_template.delete", "Delete counselling availability templates"),
    COUNSELLING_BLOCK_DATE_READ   ("counselling.block_date.read",   "View counselling block-date requests"),
    COUNSELLING_BLOCK_DATE_CREATE ("counselling.block_date.create", "Create counselling block-date requests"),
    COUNSELLING_BLOCK_DATE_UPDATE ("counselling.block_date.update", "Update counselling block-date requests"),
    COUNSELLING_BLOCK_DATE_DELETE ("counselling.block_date.delete", "Delete counselling block-date requests"),
    COUNSELLING_ACTIVITY_LOG_READ   ("counselling.activity_log.read",   "View counselling activity logs"),
    COUNSELLING_ACTIVITY_LOG_CREATE ("counselling.activity_log.create", "Create counselling activity log entries"),
    COUNSELLING_APPOINTMENT_READ   ("counselling.appointment.read",   "View counselling appointments"),
    COUNSELLING_APPOINTMENT_CREATE ("counselling.appointment.create", "Create counselling appointments"),
    COUNSELLING_APPOINTMENT_UPDATE ("counselling.appointment.update", "Update counselling appointments"),
    COUNSELLING_APPOINTMENT_DELETE ("counselling.appointment.delete", "Delete counselling appointments"),
    COUNSELLING_ELIGIBILITY_READ   ("counselling.eligibility.read",   "View counselling eligibility records"),
    COUNSELLING_ELIGIBILITY_CREATE ("counselling.eligibility.create", "Create counselling eligibility records"),
    COUNSELLING_ELIGIBILITY_UPDATE ("counselling.eligibility.update", "Update counselling eligibility records"),
    COUNSELLING_ELIGIBILITY_DELETE ("counselling.eligibility.delete", "Delete counselling eligibility records"),
    COUNSELLING_RATING_READ   ("counselling.rating.read",   "View counselling ratings"),
    COUNSELLING_RATING_CREATE ("counselling.rating.create", "Create counselling ratings"),
    COUNSELLING_RATING_UPDATE ("counselling.rating.update", "Update counselling ratings"),
    COUNSELLING_RATING_DELETE ("counselling.rating.delete", "Delete counselling ratings"),
    COUNSELLING_SLOT_READ   ("counselling.slot.read",   "View counselling slots"),
    COUNSELLING_SLOT_CREATE ("counselling.slot.create", "Create counselling slots"),
    COUNSELLING_SLOT_UPDATE ("counselling.slot.update", "Update counselling slots"),
    COUNSELLING_SLOT_DELETE ("counselling.slot.delete", "Delete counselling slots"),
    COUNSELLOR_READ   ("counsellor.read",   "View counsellors"),
    COUNSELLOR_CREATE ("counsellor.create", "Create counsellors"),
    COUNSELLOR_UPDATE ("counsellor.update", "Update counsellors"),
    COUNSELLOR_DELETE ("counsellor.delete", "Delete counsellors"),
    COUNSELLOR_INSTITUTE_MAPPING_READ   ("counsellor_institute_mapping.read",   "View counsellor-institute mappings"),
    COUNSELLOR_INSTITUTE_MAPPING_CREATE ("counsellor_institute_mapping.create", "Create counsellor-institute mappings"),
    COUNSELLOR_INSTITUTE_MAPPING_UPDATE ("counsellor_institute_mapping.update", "Update counsellor-institute mappings"),
    COUNSELLOR_INSTITUTE_MAPPING_DELETE ("counsellor_institute_mapping.delete", "Delete counsellor-institute mappings"),
    COUNSELLOR_MEDIA_READ   ("counsellor_media.read",   "View counsellor media"),
    COUNSELLOR_MEDIA_CREATE ("counsellor_media.create", "Create counsellor media"),
    COUNSELLOR_MEDIA_UPDATE ("counsellor_media.update", "Update counsellor media"),
    COUNSELLOR_MEDIA_DELETE ("counsellor_media.delete", "Delete counsellor media"),
    COUNSELLING_NOTIFICATION_READ   ("counselling.notification.read",   "View counselling notifications"),
    COUNSELLING_NOTIFICATION_CREATE ("counselling.notification.create", "Create counselling notifications"),
    COUNSELLING_NOTIFICATION_UPDATE ("counselling.notification.update", "Update counselling notifications"),
    COUNSELLING_NOTIFICATION_DELETE ("counselling.notification.delete", "Delete counselling notifications"),
    COUNSELLING_SESSION_NOTES_READ   ("counselling.session_notes.read",   "View counselling session notes"),
    COUNSELLING_SESSION_NOTES_CREATE ("counselling.session_notes.create", "Create counselling session notes"),
    COUNSELLING_SESSION_NOTES_UPDATE ("counselling.session_notes.update", "Update counselling session notes"),
    COUNSELLING_SESSION_NOTES_DELETE ("counselling.session_notes.delete", "Delete counselling session notes"),
    COUNSELLING_SLOT_CONFIGURATION_READ   ("counselling.slot_configuration.read",   "View counselling slot configurations"),
    COUNSELLING_SLOT_CONFIGURATION_CREATE ("counselling.slot_configuration.create", "Create counselling slot configurations"),
    COUNSELLING_SLOT_CONFIGURATION_UPDATE ("counselling.slot_configuration.update", "Update counselling slot configurations"),
    COUNSELLING_SLOT_CONFIGURATION_DELETE ("counselling.slot_configuration.delete", "Delete counselling slot configurations"),
    COUNSELLING_STUDENT_COUNSELLOR_MAPPING_READ   ("counselling.student_counsellor_mapping.read",   "View student-counsellor mappings"),
    COUNSELLING_STUDENT_COUNSELLOR_MAPPING_CREATE ("counselling.student_counsellor_mapping.create", "Create student-counsellor mappings"),
    COUNSELLING_STUDENT_COUNSELLOR_MAPPING_UPDATE ("counselling.student_counsellor_mapping.update", "Update student-counsellor mappings"),
    COUNSELLING_STUDENT_COUNSELLOR_MAPPING_DELETE ("counselling.student_counsellor_mapping.delete", "Delete student-counsellor mappings"),
    COUNSELLING_STUDENT_MANAGEMENT_READ   ("counselling.student_management.read",   "View counselling student management"),
    COUNSELLING_STUDENT_MANAGEMENT_CREATE ("counselling.student_management.create", "Create counselling student-management records"),
    COUNSELLING_STUDENT_MANAGEMENT_UPDATE ("counselling.student_management.update", "Update counselling student-management records"),
    COUNSELLING_STUDENT_MANAGEMENT_DELETE ("counselling.student_management.delete", "Delete counselling student-management records"),

    /**
     * Permission gating the "Refresh Permissions" admin action that scans
     * controllers for new {@code @auth.allows(...)} literals and seeds the
     * catalog from {@link PermissionCode} into the permission DB table.
     *
     * <p>Required for: {@code POST /permission/refresh}.
     * <br>FE: button on RolesAndPermissionsPage toolbar ("Refresh Permissions").
     */
    PERMISSION_REFRESH ("permission.refresh", "Run the permission catalog refresh"),

    /**
     * Permission gating the "URL Access" admin action for editing the
     * per-role list of allowed React route paths.
     *
     * <p>Required for: {@code PUT /role/{id}/urls}.
     * <br>FE: 🌐 icon on each Role row in RolesPanel ("Manage URL access").
     */
    ROLE_URL_UPDATE ("role.url.update", "Manage which React URLs a role grants access to"),

    /**
     * Reminder Management — central admin page for scheduled reminders
     * (B2C invite nudges, counselling 24h/1h, assessment-mapping). Seeded by
     * V20260525002__reminder_permissions.sql. Each code maps 1:1 to a
     * controller {@code @PreAuthorize("@auth.allows('...')")} guard.
     */
    REMINDERS_VIEW                ("reminders.view",                "Open the Reminder Management page"),
    REMINDERS_CONFIG_READ         ("reminders.config.read",         "Read reminder system configuration"),
    REMINDERS_CONFIG_EDIT         ("reminders.config.edit",         "Edit reminder enable/cron/lead-time/cap"),
    REMINDERS_TEMPLATE_EDIT       ("reminders.template.edit",       "Edit reminder subject/body templates"),
    REMINDERS_LOGS_VIEW           ("reminders.logs.view",           "View reminder delivery logs and analytics"),
    REMINDERS_SUPPRESSIONS_MANAGE ("reminders.suppressions.manage", "Manage per-student reminder opt-outs"),
    REMINDERS_SEND_MANUAL         ("reminders.send.manual",         "Trigger a manual reminder send"),
    REMINDERS_SEND_TEST           ("reminders.send.test",           "Send a test reminder from the template editor"),

    // ── Unified report pipeline (V20260526008 seed) ─────────────────────
    CALCULATED_REPORT_DATA_READ       ("calculated_report_data.read",     "View persisted calculated report payloads"),
    INTERMEDIARY_SCORES_READ          ("intermediary_scores.read",        "View persisted intermediary score payloads"),

    // ── Collapsed report_template system (V20260601007 seed) ────────────
    // report_template.{read,create,update,delete} already exist above (~L356).
    REPORT_TEMPLATE_UPLOAD_TEMPLATE   ("report_template.upload_template", "Upload / replace a report template HTML"),
    REPORT_TEMPLATE_MAP               ("report_template.map",             "Map templates to questionnaires and set the default");

    private final String code;
    private final String description;

    PermissionCode(String code, String description) {
        this.code        = code;
        this.description = description;
    }

    /** Canonical string used in JWT claims, DB rows, and SpEL expressions. */
    public String code() {
        return code;
    }

    /** Human-readable description (also stored in the permission table). */
    public String description() {
        return description;
    }

    /** Look up a code -> enum, returning null if unknown. Useful in filters. */
    public static PermissionCode fromCode(String code) {
        if (code == null) return null;
        for (PermissionCode pc : values()) {
            if (pc.code.equals(code)) return pc;
        }
        return null;
    }
}
