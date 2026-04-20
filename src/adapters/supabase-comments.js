/**
 * createSupabaseCommentsAdapter (0.4.0)
 *
 * Adapter factory for CommentsPanel backed by the shared `comments`
 * table (or any schema-compatible clone). Hides project-specific scope
 * mappings behind a config so the same component works across sites.
 *
 * @param {Object} supabase                 @supabase/supabase-js client
 * @param {Object} config
 * @param {string}   [config.tableName='comments']
 * @param {string}   [config.profilesJoin='*,profiles(display_name)']
 *                     Select clause; defaults to joining author display name.
 * @param {(scope) => Object} config.scopeFilter
 *   Returns the filter object PostgREST should eq-match on list + insert.
 *   Example (Learn): (s) => ({ project_id: 'solving-for-zero',
 *                              module_id: String(s.moduleId),
 *                              section: s.section })
 * @param {(scope, { user, comment_type, content }) => Object} [config.buildRow]
 *   Optional row shaper for insert. Default merges scopeFilter with
 *   { user_id: user.id, comment_type, content }.
 * @param {string}   [config.orderBy='created_at']
 * @param {boolean}  [config.descending=true]
 * @param {number}   [config.limit=50]
 */
export function createSupabaseCommentsAdapter(supabase, config) {
  const {
    tableName = 'comments',
    profilesJoin = '*,profiles(display_name)',
    scopeFilter,
    buildRow,
    orderBy = 'created_at',
    descending = true,
    limit = 50,
  } = config || {};

  if (typeof scopeFilter !== 'function') {
    throw new Error('createSupabaseCommentsAdapter: scopeFilter is required.');
  }

  return {
    async listComments(scope) {
      const filter = scopeFilter(scope) || {};
      let query = supabase.from(tableName).select(profilesJoin);
      for (const [col, val] of Object.entries(filter)) {
        if (val === undefined || val === null) continue;
        query = query.eq(col, val);
      }
      query = query.order(orderBy, { ascending: !descending }).limit(limit);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return Array.isArray(data) ? data : [];
    },

    async postComment(scope, { user, comment_type, content }) {
      if (!user || !user.id) throw new Error('Sign in required to comment.');
      const filter = scopeFilter(scope) || {};
      const row = buildRow
        ? buildRow(scope, { user, comment_type, content })
        : { ...filter, user_id: user.id, comment_type, content };
      const { data, error } = await supabase
        .from(tableName)
        .insert(row)
        .select(profilesJoin)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  };
}
