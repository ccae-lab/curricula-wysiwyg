/**
 * Supabase SDK adapter — for projects using supabase.from() calls.
 *
 * Used by learn.curricula.dev (Solving for Zero) which stores content
 * overrides in a table with composite key columns.
 *
 * @param {Object} supabase — initialised Supabase client
 * @param {Object} config
 * @param {string} config.tableName — e.g. 'content_overrides'
 * @param {(scope: Object) => Object} config.scopeFilter
 *   — converts scope to a filter object, e.g.:
 *     (scope) => ({ project_id: 'solving-for-zero', module_id: scope.moduleId })
 * @param {string} config.blockKeyColumn — column name for the block key (e.g. 'field' or 'block_key')
 * @param {string} config.valueColumn — column name for the value (e.g. 'value')
 * @param {string} [config.typeColumn] — column for block type (optional, not all tables have it)
 * @param {string} [config.editorColumn] — column for editor identity (e.g. 'edited_by')
 * @param {string} [config.previousValueColumn] — column for audit trail (e.g. 'previous_value')
 * @param {string} [config.onConflict] — upsert conflict columns (e.g. 'project_id,module_id,content_type,content_key,field')
 * @param {(scope: Object, blockKey: string, entry: Object) => Object} [config.buildRow]
 *   — custom row builder for upsert; if omitted, uses scopeFilter + blockKeyColumn + valueColumn
 *
 * @returns {import('../core/types').PersistenceAdapter}
 */
export function createSupabaseSDKAdapter(supabase, config) {
  const {
    tableName,
    scopeFilter,
    blockKeyColumn = 'block_key',
    valueColumn = 'value',
    typeColumn,
    editorColumn,
    previousValueColumn,
    onConflict,
    buildRow,
  } = config;

  return {
    async fetchBlocks(scope) {
      const filter = scopeFilter(scope);
      let query = supabase.from(tableName).select('*');
      for (const [col, val] of Object.entries(filter)) {
        query = query.eq(col, val);
      }
      const { data, error } = await query;
      if (error || !data) return {};

      const out = {};
      for (const row of data) {
        const key = row[blockKeyColumn];
        out[key] = {
          type: typeColumn ? row[typeColumn] : 'text',
          value: row[valueColumn],
        };
      }
      return out;
    },

    async upsertBlocks(scope, editorEmail, blocks) {
      const filter = scopeFilter(scope);
      const rows = Object.entries(blocks).map(([blockKey, entry]) => {
        if (buildRow) return buildRow(scope, blockKey, entry);
        const row = { ...filter, [blockKeyColumn]: blockKey, [valueColumn]: entry.value };
        if (typeColumn) row[typeColumn] = entry.type;
        if (editorColumn) row[editorColumn] = editorEmail;
        return row;
      });
      if (rows.length === 0) return;
      const opts = onConflict ? { onConflict } : {};
      const { error } = await supabase.from(tableName).upsert(rows, opts);
      if (error) throw new Error(error.message);
    },

    async deleteBlock(scope, blockKey) {
      const filter = scopeFilter(scope);
      let query = supabase.from(tableName).delete();
      for (const [col, val] of Object.entries(filter)) {
        query = query.eq(col, val);
      }
      query = query.eq(blockKeyColumn, blockKey);
      const { error } = await query;
      if (error) throw new Error(error.message);
    },
  };
}
