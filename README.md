# Databricks Tag Governance — Cross-Region

A Databricks App for managing Unity Catalog table/column comments and table tags across a cross-region setup. The app runs in **West Europe** and manages metadata in a **Qatar Central** Unity Catalog.

---

## Overview

This app provides a centralised UI for data stewards and catalog admins to:

- Apply and manage **tags** on tables across configured catalogs and schemas
- Write and update **table and column comments** (descriptions)
- Track **comment and tag coverage** across the catalog
- Configure **which catalogs and schemas** are in scope
- Define a **tag dictionary** — the allowed tag keys and their permitted values

All operations are **metadata-only**. The Service Principal used by the app is never granted `SELECT` and cannot read table data.

---

## Architecture

```
┌─────────────────────────────────────────┐
│         Databricks App                  │
│         West Europe workspace           │
│                                         │
│  React Frontend  ←→  FastAPI Backend    │
│                         │               │
│              Databricks SDK             │
└─────────────────────────┼───────────────┘
                          │  HTTPS (UC REST API + SQL)
          ┌───────────────┴───────────────┐
          │                               │
┌─────────▼──────────┐     ┌──────────────▼──────────────┐
│  West Europe UC    │     │   Qatar Central Workspace    │
│                    │     │                              │
│  metadata_manager  │     │   Target Catalogs            │
│  _config schema    │     │   & Schemas                  │
│  (tag dictionary,  │     │   (tables, columns,          │
│   scope config)    │     │    tags, comments)           │
└────────────────────┘     └──────────────────────────────┘
```

Cross-region latency is not a concern — all operations are metadata only (no data reads), so API call overhead (~80–150ms) is acceptable.

---

## App Tabs

### Overview
High-level coverage dashboard:
- % tables with at least one tag applied
- % tables with a table-level comment
- % columns with a comment
- Per-schema breakdown of comment and tag coverage

### Tag Management
Tabular view of all tables across configured schemas. Columns are dynamically generated from the tag dictionary.

| Catalog | Schema | Table | sensitivity | domain | pii | |
|---|---|---|---|---|---|---|
| qatar_cat | sales | orders | high | sales | yes | Edit |
| qatar_cat | sales | customers | — | — | — | Edit |

Clicking **Edit** opens a form pre-populated with the table's current tags. All configured tag keys are shown as dropdowns (or free-text inputs where allowed). Save commits changes via the UC Tags API.

### Comment Management
Tree-structured view of the catalog hierarchy:

```
▼ qatar_catalog
  ▼ sales_schema  [12/20 tables · 45/130 columns commented]
    ▼ orders_table  ✓ "Stores all confirmed customer orders"
        order_id      ✗ No comment
        customer_id   ✓ "FK → customers.id"
    ▶ customers_table  ✗ No comment
```

- ✓ / ✗ indicators at every node
- Click any node to open a side panel for inline editing
- Checkboxes for multi-select — bulk apply the same description to many tables or columns at once

### Configuration
Global settings shared across all app users:

**Scope** — select which catalogs and schemas the app manages. Saved to the `scope_config` Delta table in West Europe.

**Tag Dictionary** — define allowed tag keys and their values:

| Tag Key | Allowed Values | Free Text |
|---|---|---|
| sensitivity | high, medium, low | No |
| domain | sales, finance, hr | Yes |
| pii | yes, no | No |

Saved to the `tag_dictionary` Delta table in West Europe. Changes take immediate effect in the Tag Management tab.

---

## Permission Model

The app uses a dedicated Service Principal. Permissions are minimal and data-safe:

### Qatar Central
| Grant | Purpose |
|---|---|
| `USE CATALOG` on target catalog | Navigate the catalog |
| `USE SCHEMA` on target schemas | Navigate schemas |
| `APPLY TAG` on target schemas | Write and remove tags |
| Schema **OWNER** on target schemas | Write table and column comments without `MODIFY` |

`SELECT` is **never granted** — the SP cannot read table data.

### West Europe
| Grant | Purpose |
|---|---|
| `USE CATALOG` on config catalog | Navigate the catalog |
| `USE SCHEMA` on config schema | Navigate the config schema |
| `SELECT` + `MODIFY` on config tables | Read and write tag dictionary and scope config |

---

## Repository Structure

```
databricks-tag-governance-xregion/
│
├── README.md                        # This file
├── INSTRUCTIONS.md                  # Step-by-step setup guide
│
├── setup/
│   ├── grants_qatar_central.sql     # UC grants for Qatar Central workspace
│   └── grants_west_europe.sql       # UC grants for West Europe config tables
│
├── app/
│   ├── app.yaml                     # Databricks App manifest
│   ├── backend/                     # FastAPI backend
│   │   ├── main.py
│   │   ├── routers/
│   │   │   ├── catalogs.py
│   │   │   ├── tables.py
│   │   │   ├── comments.py
│   │   │   ├── tags.py
│   │   │   └── config.py
│   │   └── services/
│   │       ├── unity_catalog.py     # UC REST API client
│   │       └── delta_config.py      # Config table read/write
│   └── frontend/                    # React frontend
│       ├── src/
│       │   ├── tabs/
│       │   │   ├── Overview.jsx
│       │   │   ├── TagManagement.jsx
│       │   │   ├── CommentManagement.jsx
│       │   │   └── Configuration.jsx
│       │   └── components/
│       │       ├── TagEditModal.jsx
│       │       ├── CommentSidePanel.jsx
│       │       └── BulkCommentBar.jsx
│       └── package.json
│
└── terraform/                       # Optional: Terraform alternative to SQL scripts
    └── README.md
```

---

## Setup

See [INSTRUCTIONS.md](INSTRUCTIONS.md) for the full step-by-step setup guide.

**Quick summary:**
1. Create a Service Principal and add it to both workspaces
2. Manually create config tables in West Europe (one-time SQL)
3. Run `setup/grants_qatar_central.sql` against Qatar Central
4. Run `setup/grants_west_europe.sql` against West Europe
5. Set environment variables in the Databricks App config
6. Deploy the app

---

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| App region | West Europe | App infrastructure requirement |
| Metadata target | Qatar Central | Where business catalogs reside |
| Cross-region access | Direct UC REST API | Only viable approach for metadata write-back; UC Federation and Delta Sharing are read-only |
| Config storage | Delta tables in West Europe | Persistent, queryable, low-latency from app |
| Permission management | SQL scripts in repo | Simple, version-controlled, reproducible without Terraform overhead |
| Data access | None (SP has no SELECT) | App is metadata-only; no risk of data exposure |
| Comment write mechanism | Schema ownership (SP is schema owner) | Avoids granting MODIFY which would also enable DML |
| Tag write mechanism | APPLY TAG privilege | Dedicated metadata-only privilege, no data access implied |
