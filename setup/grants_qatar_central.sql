-- ============================================================
-- Qatar Central Workspace — UC Permission Grants
-- Run this script in the Qatar Central workspace as a
-- metastore admin or catalog owner.
--
-- Replace all <placeholder> values before executing.
--
-- Service Principal: <sp_application_id>
-- Target Catalog:    <qatar_catalog>
-- Target Schemas:    add one block per schema in scope
-- ============================================================

-- Step 1: Catalog-level navigation (required for all schemas)
GRANT USE CATALOG ON CATALOG <qatar_catalog>
  TO `<sp_application_id>`;

-- ============================================================
-- Repeat the block below for each schema you want the app
-- to manage. Add new blocks as schemas are added to scope.
-- ============================================================

-- Schema: <schema_name_1>
GRANT USE SCHEMA ON SCHEMA <qatar_catalog>.<schema_name_1>
  TO `<sp_application_id>`;

GRANT APPLY TAG ON SCHEMA <qatar_catalog>.<schema_name_1>
  TO `<sp_application_id>`;

-- Transfer schema ownership to the SP so it can write
-- table and column comments without needing MODIFY (which
-- would also grant INSERT/UPDATE/DELETE on table data).
ALTER SCHEMA <qatar_catalog>.<schema_name_1>
  OWNER TO `<sp_application_id>`;

-- ============================================================
-- Add additional schema blocks below as needed:
-- ============================================================

-- Schema: <schema_name_2>
-- GRANT USE SCHEMA ON SCHEMA <qatar_catalog>.<schema_name_2>
--   TO `<sp_application_id>`;
-- GRANT APPLY TAG ON SCHEMA <qatar_catalog>.<schema_name_2>
--   TO `<sp_application_id>`;
-- ALTER SCHEMA <qatar_catalog>.<schema_name_2>
--   OWNER TO `<sp_application_id>`;
