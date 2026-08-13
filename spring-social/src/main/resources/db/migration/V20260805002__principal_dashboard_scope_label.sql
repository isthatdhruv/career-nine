-- The display name of a scope, resolved once at release time.
--
-- The dimension columns hold ids: a section is 7, a group is 100. Naming them needs the
-- school's lookup tables, and the dashboard's filter rail needs the names on every read.
-- Resolving them per read means joining three lookup tables to draw a dropdown; the label
-- is already computed while planning a release, so it is stored alongside the row.
--
-- It is also the honest record of what a scope was called when it was generated: renaming
-- a group later should not retitle a report that already went out.

ALTER TABLE principal_dashboard_data
    ADD COLUMN scope_label VARCHAR(255) NULL AFTER scope_level;
