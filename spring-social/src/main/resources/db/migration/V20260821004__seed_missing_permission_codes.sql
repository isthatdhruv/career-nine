-- ---------------------------------------------------------------------------
-- V20260821004__seed_missing_permission_codes.sql
--
-- Seeds 12 PermissionCode entries that never made it into a seed migration
-- (found by PermissionCatalogSeedCoverageTest). Their enum comments name
-- V20260525002 / V20260526008 / V20260601007 as their seeds, but those files
-- never inserted them — so the codes were absent from the permission table
-- and could not be allotted to any role from the Roles & Permissions UI
-- (the "Permission needed: X but there is no such permission to allot" bug).
-- Environments where an admin ran the runtime "Refresh Permissions" action
-- already have the rows; ON DUPLICATE KEY UPDATE keeps this re-runnable.
-- ---------------------------------------------------------------------------

INSERT INTO permission (code, description) VALUES
  ('calculated_report_data.read',    'View persisted calculated report payloads'),
  ('intermediary_scores.read',       'View persisted intermediary score payloads'),
  ('reminders.view',                 'Open the Reminder Management page'),
  ('reminders.config.read',          'Read reminder system configuration'),
  ('reminders.config.edit',          'Edit reminder enable/cron/lead-time/cap'),
  ('reminders.template.edit',        'Edit reminder subject/body templates'),
  ('reminders.logs.view',            'View reminder delivery logs and analytics'),
  ('reminders.suppressions.manage',  'Manage per-student reminder opt-outs'),
  ('reminders.send.manual',          'Trigger a manual reminder send'),
  ('reminders.send.test',            'Send a test reminder from the template editor'),
  ('report_template.upload_template','Upload / replace a report template HTML'),
  ('report_template.map',            'Map templates to questionnaires and set the default')
ON DUPLICATE KEY UPDATE description = VALUES(description);
