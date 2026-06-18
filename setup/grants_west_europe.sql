-- ============================================================
-- West Europe Workspace — UC Permission Grants
-- Run this script in the West Europe workspace as a
-- metastore admin or catalog owner, AFTER the config tables
-- have been created manually (see INSTRUCTIONS.md Step 2).
--
-- Replace all <placeholder> values before executing.
--
-- Service Principal: <sp_application_id>
-- Config Catalog:    <west_europe_catalog>
-- Config Schema:     metadata_manager_config
-- ============================================================

-- Step 1: Catalog-level navigation
GRANT USE CATALOG ON CATALOG <west_europe_catalog>
  TO `<sp_application_id>`;

-- Step 2: Schema-level navigation
GRANT USE SCHEMA ON SCHEMA <west_europe_catalog>.metadata_manager_config
  TO `<sp_application_id>`;

-- Step 3: Read and write access to config tables
-- SELECT: read tag dictionary and scope config on app load
-- MODIFY: save changes made in the Configuration tab
GRANT SELECT, MODIFY ON TABLE <west_europe_catalog>.metadata_manager_config.tag_dictionary
  TO `<sp_application_id>`;

GRANT SELECT, MODIFY ON TABLE <west_europe_catalog>.metadata_manager_config.scope_config
  TO `<sp_application_id>`;
