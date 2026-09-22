-- Release the slugs held by soft-deleted campaigns.
--
-- campaigns.slug carries a UNIQUE index, but the create check
-- (CampaignController#create) looks the slug up WITHOUT the is_deleted filter,
-- so a deleted campaign kept its slug reserved for ever. The admin UI cannot
-- undo that either: getAll hides deleted campaigns, and get/{id} and update/{id}
-- both 404 on them — the row is invisible, uneditable and still blocking.
-- "Slug already in use" with nothing on screen to explain it.
--
-- Deleted campaigns are already unreachable by slug (every public lookup uses
-- findBySlugIgnoreCaseAndIsDeletedFalse) and nothing references a campaign by
-- slug — entitlements and mappings key on campaign_id — so renaming costs
-- nothing and keeps the row as the audit trail of what was sold.
UPDATE campaigns
SET slug = CONCAT(LEFT(slug, 80), '-deleted-', campaign_id),
    updated_at = NOW()
WHERE is_deleted = 1
  AND slug NOT LIKE CONCAT('%-deleted-', campaign_id);
