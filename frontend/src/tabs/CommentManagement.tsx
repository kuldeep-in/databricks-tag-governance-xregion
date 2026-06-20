import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import apiClient, { ColumnInfo, TableInfo } from '../api/client';
import CommentSidePanel, { CommentTarget } from '../components/CommentSidePanel';

function CoverageBadge({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((100 * done) / total) : 0;
  return (
    <span className="ml-2 text-xs rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
      {done}/{total} · {pct}%
    </span>
  );
}

function ColumnRows({
  table,
  onEdit,
}: {
  table: TableInfo;
  onEdit: (t: CommentTarget) => void;
}) {
  const ws = table.workspace_url || 'primary';
  const { data, isLoading } = useQuery<ColumnInfo[]>({
    queryKey: ['columns', ws, table.full_name],
    queryFn: () => apiClient.getColumns(table.full_name, ws),
  });

  if (isLoading)
    return (
      <div className="pl-12 py-1.5 text-xs text-gray-400">Loading columns…</div>
    );

  return (
    <div>
      {(data ?? []).map((c) => (
        <div
          key={c.name}
          className={`flex items-center gap-3 pl-12 pr-4 py-1.5 border-t border-gray-100 ${
            !c.has_comment ? 'bg-amber-50' : 'bg-white'
          }`}
        >
          <span className="font-mono text-sm text-gray-800 shrink-0">{c.name}</span>
          <span className="text-xs text-gray-400 shrink-0">{c.type_text}</span>
          {c.comment ? (
            <span className="text-xs text-gray-500 truncate flex-1">
              {c.comment}
            </span>
          ) : (
            <span className="text-xs text-amber-600 flex-1">no description</span>
          )}
          <button
            className="text-xs text-brand hover:underline shrink-0"
            onClick={() =>
              onEdit({
                type: 'column',
                full_name: table.full_name,
                column_name: c.name,
                label: `${table.name}.${c.name}`,
                comment: c.comment,
              })
            }
          >
            Edit
          </button>
        </div>
      ))}
    </div>
  );
}

function TableNode({
  table,
  onEdit,
}: {
  table: TableInfo;
  onEdit: (t: CommentTarget) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div
        className={`flex items-center gap-3 pl-6 pr-4 py-2 border-t border-gray-100 ${
          !table.has_comment ? 'bg-amber-50' : 'bg-white'
        }`}
      >
        <button
          className="w-4 text-gray-400 shrink-0"
          onClick={() => setOpen((o) => !o)}
          title="Expand columns"
        >
          {open ? '▾' : '▸'}
        </button>
        <span className="font-medium text-sm shrink-0">{table.name}</span>
        {table.comment ? (
          <span className="text-xs text-gray-500 truncate flex-1">
            {table.comment}
          </span>
        ) : (
          <span className="text-xs text-amber-600 flex-1">no description</span>
        )}
        <button
          className="text-xs text-brand hover:underline shrink-0"
          onClick={() =>
            onEdit({
              type: 'table',
              full_name: table.full_name,
              label: table.full_name,
              comment: table.comment,
            })
          }
        >
          Edit
        </button>
      </div>
      {open && <ColumnRows table={table} onEdit={onEdit} />}
    </div>
  );
}

function SchemaNode({
  catalog,
  schema,
  workspace_url,
  onEdit,
}: {
  catalog: string;
  schema: string;
  workspace_url: string;
  onEdit: (t: CommentTarget) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery<TableInfo[]>({
    queryKey: ['tables', workspace_url, catalog, schema],
    queryFn: () => apiClient.getTables(catalog, schema, workspace_url),
  });

  const commented = (data ?? []).filter((t) => t.has_comment).length;

  return (
    <div className="border-t border-gray-100 first:border-t-0">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50">
        <button
          className="w-4 text-gray-500 shrink-0"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? '▾' : '▸'}
        </button>
        <span className="font-semibold text-sm">
          {catalog}.{schema}
        </span>
        {data && <CoverageBadge done={commented} total={data.length} />}
      </div>
      {open && (
        <div>
          {isLoading && (
            <div className="pl-6 py-2 text-xs text-gray-400">Loading tables…</div>
          )}
          {(data ?? []).map((t) => (
            <TableNode key={t.full_name} table={t} onEdit={onEdit} />
          ))}
          {data && data.length === 0 && (
            <div className="pl-6 py-2 text-xs text-gray-400">No tables.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CommentManagement({ workspace }: { workspace: string }) {
  const [panel, setPanel] = useState<CommentTarget | null>(null);
  const [catalogFilter, setCatalogFilter] = useState('');
  const [schemaFilter, setSchemaFilter] = useState('');

  const scopeQuery = useQuery({
    queryKey: ['scope'],
    queryFn: apiClient.getScope,
  });
  const activeScope = useMemo(
    () => (scopeQuery.data ?? []).filter((s) => s.is_active && s.workspace_url === workspace),
    [scopeQuery.data, workspace]
  );

  const catalogs = useMemo(
    () => Array.from(new Set(activeScope.map((s) => s.catalog_name))).sort(),
    [activeScope]
  );
  const schemas = useMemo(
    () =>
      Array.from(
        new Set(
          activeScope
            .filter((s) => !catalogFilter || s.catalog_name === catalogFilter)
            .map((s) => s.schema_name)
        )
      ).sort(),
    [activeScope, catalogFilter]
  );

  const visibleScope = useMemo(
    () =>
      activeScope.filter(
        (s) =>
          (!catalogFilter || s.catalog_name === catalogFilter) &&
          (!schemaFilter || s.schema_name === schemaFilter)
      ),
    [activeScope, catalogFilter, schemaFilter]
  );

  // Pre-warm table caches so coverage badges populate before the user expands.
  useQueries({
    queries: activeScope.map((s) => ({
      queryKey: ['tables', s.workspace_url, s.catalog_name, s.schema_name],
      queryFn: () => apiClient.getTables(s.catalog_name, s.schema_name, s.workspace_url),
    })),
  });

  if (scopeQuery.isLoading)
    return <div className="text-gray-500">Loading scope…</div>;
  if (activeScope.length === 0)
    return (
      <div className="text-gray-500">
        No active scope. Add catalogs/schemas in the Configuration tab.
      </div>
    );

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Catalog</label>
          <select
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            value={catalogFilter}
            onChange={(e) => {
              setCatalogFilter(e.target.value);
              setSchemaFilter('');
            }}
          >
            <option value="">All</option>
            {catalogs.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Schema</label>
          <select
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            value={schemaFilter}
            onChange={(e) => setSchemaFilter(e.target.value)}
          >
            <option value="">All</option>
            {schemas.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 ml-auto">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-amber-50 border border-amber-200" />
            missing description
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-white border border-gray-200" />
            described
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {visibleScope.map((s) => (
          <SchemaNode
            key={`${s.workspace_url}.${s.catalog_name}.${s.schema_name}`}
            catalog={s.catalog_name}
            schema={s.schema_name}
            workspace_url={s.workspace_url}
            onEdit={setPanel}
          />
        ))}
        {visibleScope.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-400 text-center">
            No schemas match the selected filters.
          </div>
        )}
      </div>

      {panel && (
        <CommentSidePanel target={panel} onClose={() => setPanel(null)} />
      )}
    </div>
  );
}
