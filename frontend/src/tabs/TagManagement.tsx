import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import apiClient, { TableInfo, TagDictEntry } from '../api/client';
import TagEditModal from '../components/TagEditModal';

export default function TagManagement({ workspace }: { workspace: string }) {
  const [editing, setEditing] = useState<TableInfo | null>(null);
  const [catalogFilter, setCatalogFilter] = useState('');
  const [schemaFilter, setSchemaFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [untaggedOnly, setUntaggedOnly] = useState(false);

  const tagDictQuery = useQuery<TagDictEntry[]>({
    queryKey: ['tagdictionary'],
    queryFn: apiClient.getTagDictionary,
  });

  const scopeQuery = useQuery({
    queryKey: ['scope'],
    queryFn: apiClient.getScope,
  });

  const activeScope = useMemo(
    () => (scopeQuery.data ?? []).filter((s) => s.is_active && s.workspace_url === workspace),
    [scopeQuery.data, workspace]
  );

  const tableQueries = useQueries({
    queries: activeScope.map((s) => ({
      queryKey: ['tables', s.workspace_url, s.catalog_name, s.schema_name],
      queryFn: () => apiClient.getTables(s.catalog_name, s.schema_name, s.workspace_url),
    })),
  });

  const loadingTables = tableQueries.some((q) => q.isLoading);
  const allTables: TableInfo[] = useMemo(
    () => tableQueries.flatMap((q) => q.data ?? []),
    [tableQueries]
  );

  const tagKeys = (tagDictQuery.data ?? []).map((t) => t.tag_key);

  const filtered = allTables.filter((t) => {
    if (catalogFilter && t.catalog_name !== catalogFilter) return false;
    if (schemaFilter && t.schema_name !== schemaFilter) return false;
    if (nameFilter && !t.name.toLowerCase().includes(nameFilter.toLowerCase()))
      return false;
    if (untaggedOnly && t.tag_count > 0) return false;
    return true;
  });

  const catalogs = Array.from(new Set(allTables.map((t) => t.catalog_name)));
  const schemas = Array.from(
    new Set(
      allTables
        .filter((t) => !catalogFilter || t.catalog_name === catalogFilter)
        .map((t) => t.schema_name)
    )
  );

  if (scopeQuery.isLoading) return <div className="text-gray-500">Loading scope…</div>;
  if (activeScope.length === 0)
    return (
      <div className="text-gray-500">
        No active scope. Add catalogs/schemas in the Configuration tab.
      </div>
    );

  return (
    <div className="space-y-4">
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
              <option key={c} value={c}>
                {c}
              </option>
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
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Table name</label>
          <input
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="filter…"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={untaggedOnly}
            onChange={(e) => setUntaggedOnly(e.target.checked)}
          />
          Untagged only
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-2">Catalog</th>
              <th className="px-4 py-2">Schema</th>
              <th className="px-4 py-2">Table</th>
              {tagKeys.map((k) => (
                <th key={k} className="px-4 py-2">
                  {k}
                </th>
              ))}
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingTables && (
              <tr>
                <td
                  colSpan={4 + tagKeys.length}
                  className="px-4 py-6 text-center text-gray-400"
                >
                  Loading tables…
                </td>
              </tr>
            )}
            {!loadingTables &&
              filtered.map((t) => (
                <tr key={t.full_name} className="border-t border-gray-100">
                  <td className="px-4 py-2">{t.catalog_name}</td>
                  <td className="px-4 py-2">{t.schema_name}</td>
                  <td className="px-4 py-2 font-medium">{t.name}</td>
                  {tagKeys.map((k) => (
                    <td key={k} className="px-4 py-2">
                      {t.tags[k] ? (
                        <span className="inline-block bg-gray-100 rounded px-2 py-0.5 text-xs">
                          {t.tags[k]}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => setEditing(t)}
                      className="text-brand hover:underline text-sm"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            {!loadingTables && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={4 + tagKeys.length}
                  className="px-4 py-6 text-center text-gray-400"
                >
                  No tables match the filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <TagEditModal
          table={editing}
          tagDict={tagDictQuery.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
