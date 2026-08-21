-- Counsellor-released reports.
--
-- With this tier flag ON, nothing about the finished report is mailed out automatically:
-- the student's report link and the counsellor's "report ready" notice are both held back.
-- The report only reaches the student when the counsellor presses "Send report" on the
-- session in their appointments list, which is what report_released_at records.
--
-- The flag lives on the tier the student bought (pricing_tiers, and the per-level
-- assessment_mapping_tier that the student-invite tool copies a pricing tier into), and is
-- snapshotted onto the entitlement at grant time so a later tier edit cannot retrospectively
-- release — or re-hold — a report that has already been decided.

ALTER TABLE pricing_tiers
    ADD COLUMN counsellor_release_report TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE assessment_mapping_tier
    ADD COLUMN counsellor_release_report TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE student_entitlements
    ADD COLUMN counsellor_release_report TINYINT(1) NOT NULL DEFAULT 0;

-- When the counsellor actually released it, and to whom. NULL = not released yet.
ALTER TABLE counselling_appointment
    ADD COLUMN report_released_at DATETIME NULL;
