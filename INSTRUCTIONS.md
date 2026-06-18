# Setup Instructions

## Prerequisites

- Databricks CLI installed and configured
- Access to both workspaces:
  - **West Europe** — where the Databricks App is deployed
  - **Qatar Central** — where the target catalogs and schemas reside
- Admin or metastore admin rights on both workspaces
- A Service Principal (SP) created in your Azure Entra ID tenant
- The SP registered in both workspaces

---

## Step 1 — Create the Service Principal

1. Create a Service Principal in Azure Entra ID (or reuse an existing one).
2. Note the **Client ID** and generate a **Client Secret**.
3. Add the SP to both Databricks workspaces:
   - West Europe workspace → Admin Settings → Service Principals → Add
   - Qatar Central workspace → Admin Settings → Service Principals → Add
4. Store the Client Secret in Databricks Secrets (recommended):
   ```
   databricks secrets create-scope --scope metadata-manager
   databricks secrets put-secret --scope metadata-manager --key sp-client-id
   databricks secrets put-secret --scope metadata-manager --key sp-client-secret
   ```

---

## Step 2 — Create Config Tables (West Europe — Manual, One-Time)

Run the following in a West Europe notebook or SQL editor as an admin:

```sql
-- Create a dedicated schema for app configuration
CREATE SCHEMA IF NOT EXISTS <west_europe_catalog>.metadata_manager_config
  COMMENT 'Configuration tables for the Tag Governance app';

-- Tag dictionary: defines allowed tag keys and their permitted values
CREATE TABLE IF NOT EXISTS <west_europe_catalog>.metadata_manager_config.tag_dictionary (
  tag_key        STRING NOT NULL,
  allowed_values ARRAY<STRING>,
  free_text      BOOLEAN DEFAULT false,
  created_at     TIMESTAMP DEFAULT current_timestamp(),
  updated_at     TIMESTAMP DEFAULT current_timestamp()
);

-- Scope config: defines which catalogs and schemas the app manages
CREATE TABLE IF NOT EXISTS <west_europe_catalog>.metadata_manager_config.scope_config (
  catalog_name   STRING NOT NULL,
  schema_name    STRING NOT NULL,
  is_active      BOOLEAN DEFAULT true,
  added_at       TIMESTAMP DEFAULT current_timestamp()
);
```

Replace `<west_europe_catalog>` with the actual catalog name in your West Europe workspace.

---

## Step 3 — Apply Permission Grants

Two SQL scripts are provided in `setup/`:

### 3a. West Europe — Config Table Access

Open `setup/grants_west_europe.sql`, replace the placeholder values, then run in the West Europe workspace SQL editor or via Databricks CLI:

```bash
databricks sql execute --warehouse-id <warehouse-id> \
  --file setup/grants_west_europe.sql
```

This grants the SP read/write access to the config tables created in Step 2.

### 3b. Qatar Central — Catalog and Schema Access

Open `setup/grants_qatar_central.sql`, replace the placeholder values, then run in the Qatar Central workspace:

```bash
databricks sql execute --warehouse-id <warehouse-id> \
  --file setup/grants_qatar_central.sql
```

This grants the SP ownership of target schemas (for comment writes) and APPLY TAG privilege for tag management. No SELECT is granted — the SP cannot read table data.

> **Adding a new schema later:** Add the relevant GRANT lines to `setup/grants_qatar_central.sql`, commit, and re-run only the new statements against Qatar Central.

---

## Step 4 — Configure the App

Set the following environment variables in the Databricks App configuration (West Europe workspace → Apps → your app → Environment):

| Variable | Description |
|---|---|
| `QATAR_WORKSPACE_URL` | e.g. `https://<adb-id>.azuredatabricks.net` |
| `SP_CLIENT_ID` | Service Principal client ID |
| `SP_CLIENT_SECRET` | Service Principal client secret (use Secrets reference) |
| `CONFIG_CATALOG` | West Europe catalog name holding config tables |
| `CONFIG_SCHEMA` | e.g. `metadata_manager_config` |

---

## Step 5 — Deploy the App

```bash
# From repo root
databricks apps deploy --app-name tag-governance-app
```

---

## Step 6 — First Launch Verification

1. Open the app URL in a browser.
2. Navigate to the **Configuration** tab.
3. Verify catalogs from Qatar Central are listed.
4. Select the target catalogs and schemas, then save scope.
5. Add at least one tag key in the Tag Dictionary section.
6. Navigate to **Tag Management** and **Comment Management** to confirm tables load correctly.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Catalogs not loading | SP missing `USE CATALOG` on Qatar Central | Re-run `grants_qatar_central.sql` |
| Tags not saving | SP missing `APPLY TAG` on schema | Check grants, re-run script |
| Comments not saving | SP is not schema owner on Qatar Central | Run `ALTER SCHEMA ... OWNER TO` |
| Config not persisting | SP missing `MODIFY` on West Europe config tables | Re-run `grants_west_europe.sql` |
| App fails to start | Missing environment variable | Check all vars in Step 4 are set |
