-- ---------------------------------------------------------------------------
-- V20260729003__user_role_scope_group.sql
--
-- Adds the fifth ABAC dimension: group. A scope row may now be narrowed to a
-- student group, so a grant can mean "these students" rather than "this whole
-- school".
--
-- Group is DELIBERATELY STRICTER than the other four dimensions. For institute
-- / session / course / section, a NULL on the row is a wildcard and data with a
-- NULL column stays visible ("OR col IS NULL" in the row filter). For group
-- there is no such carve-out: a caller with a group grant sees ONLY students in
-- those groups, never ungrouped ones.
--
-- NULL here still means wildcard on the CALLER's side — a row that does not
-- bind a group places no group restriction at all. That is what keeps every
-- existing scope row, and every institute-level admin, working unchanged: the
-- row filter only applies the group clause when EVERY one of the caller's rows
-- binds a group.
--
-- Idempotent: guarded with an information_schema check. MySQL has no
-- `ADD COLUMN IF NOT EXISTS`, and `ddl-auto: update` (enabled in every profile)
-- may already have added this entity-mapped column before Flyway runs.
-- ---------------------------------------------------------------------------

SET @add_group_id := IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'user_role_scope'
           AND COLUMN_NAME = 'group_id'),
  'SELECT 1',
  'ALTER TABLE user_role_scope ADD COLUMN group_id BIGINT NULL');
PREPARE s1 FROM @add_group_id; EXECUTE s1; DEALLOCATE PREPARE s1;

-- Index so "which scope rows bind this group" stays cheap when a group is
-- deactivated or deleted and grants have to be reviewed.
SET @add_group_idx := IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'user_role_scope'
           AND INDEX_NAME = 'idx_user_role_scope_group'),
  'SELECT 1',
  'CREATE INDEX idx_user_role_scope_group ON user_role_scope (group_id)');
PREPARE s2 FROM @add_group_idx; EXECUTE s2; DEALLOCATE PREPARE s2;
