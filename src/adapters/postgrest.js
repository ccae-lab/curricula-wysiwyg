/**
 * PostgREST adapter — for projects using raw fetch against Supabase REST.
 *
 * Used by engage.curricula.dev which talks to content_blocks via PostgREST
 * with custom auth token extraction.
 *
 * @param {Object} config
 * @param {string} config.supabaseUrl — e.g. 'https://xxx.supabase.co'
 * @param {string} config.supabaseAnonKey — public anon key
 * @param {string} config.tableName — e.g. 'content_blocks'
 * @param {() => string} config.getAccessToken — returns JWT or anon key
 * @param {string} config.scopeColumn — e.g. 'page_slug'
 * @param {(scope: Object) => string} config.scopeValue — extracts the scope value
 * @param {string} [config.blockKeyColumn='block_key']
 * @param {string} [config.onConflictColumns] — e.g. 'page_slug,block_key'
 *
 * @returns {import('../core/types').PersistenceAdapter}
 */
export function createPostgRESTAdapter(config) {
  const {
    supabaseUrl,
    supabaseAnonKey,
    tableName,
    getAccessToken,
    scopeColumn,
    scopeValue,
    blockKeyColumn = 'block_key',
    onConflictColumns,
  } = config;

  const REST_BASE = `${supabaseUrl}/rest/v1`;

  function headers(extra = {}) {
    const token = getAccessToken ? getAccessToken() : supabaseAnonKey;
    return {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  return {
    async fetchBlocks(scope) {
      const sv = scopeValue(scope);
      if (!sv) return {};
      const params = new URLSearchParams();
      params.set('select', `${blockKeyColumn},block_type,value`);
      params.set(scopeColumn, `eq.${sv}`);
      try {
        const res = await fetch(`${REST_BASE}/${tableName}?${params}`, { headers: headers() });
        if (!res.ok) return {};
        const rows = await res.json();
        const out = {};
        for (const r of rows) {
          out[r[blockKeyColumn]] = { type: r.block_type, value: r.value };
        }
        return out;
      } catch {
        return {};
      }
    },

    async upsertBlocks(scope, editorEmail, blocks) {
      const sv = scopeValue(scope);
      const rows = Object.entries(blocks).map(([key, entry]) => ({
        [scopeColumn]: sv,
        [blockKeyColumn]: key,
        block_type: entry.type,
        value: entry.value,
        updated_by_email: editorEmail || null,
      }));
      if (rows.length === 0) return;
      const conflict = onConflictColumns || `${scopeColumn},${blockKeyColumn}`;
      const res = await fetch(`${REST_BASE}/${tableName}?on_conflict=${conflict}`, {
        method: 'POST',
        headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(rows),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Upsert failed (${res.status})`);
      }
    },

    async deleteBlock(scope, blockKey) {
      const sv = scopeValue(scope);
      const params = new URLSearchParams();
      params.set(scopeColumn, `eq.${sv}`);
      params.set(blockKeyColumn, `eq.${blockKey}`);
      const res = await fetch(`${REST_BASE}/${tableName}?${params}`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Delete failed (${res.status})`);
      }
    },
  };
}
