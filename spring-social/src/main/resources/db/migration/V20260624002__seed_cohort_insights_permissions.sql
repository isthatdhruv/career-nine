INSERT INTO permission (code, description) VALUES
  ('dashboard.school.insights.generate', 'Generate/refresh school cohort insight payloads (superadmin)'),
  ('dashboard.school.insights.read',     'View the school cohort insights dashboard')
ON DUPLICATE KEY UPDATE description = VALUES(description);
