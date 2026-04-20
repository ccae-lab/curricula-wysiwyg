import React, { useEffect, useState } from 'react';

/**
 * CommentsPanel (0.4.0) — shared "Comments & Contributions" thread.
 *
 * Ported from learn.curricula.dev's per-module comment block. Works for
 * any scope shape the host wants, because all database specifics live
 * behind the CommentAdapter contract.
 *
 * Props:
 *   adapter        CommentAdapter: { listComments(scope), postComment(scope, input) }
 *   scope          Arbitrary object identifying the commentable surface.
 *                  Examples:
 *                    Learn:  { moduleId: '0', section: 'reading' }
 *                    Engage: { moduleId: 'MethodologySignalToolkit', section: 'hero' }
 *   currentUser    { id, email, display_name? } | null. Null = read-only.
 *   types          List of comment type slugs. Default:
 *                  ['comment','suggestion','correction','resource'].
 *   defaultType    Initial selected type. Default 'comment'.
 *   label          Button label when collapsed. Default "Comments & Contributions".
 *   startOpen      Skip the collapse behaviour. Default false.
 *   theme          Style overrides. Merges with defaults.
 *   signInPrompt   Rendered instead of the form when currentUser is null.
 *   formatDate     (iso) => string. Default: locale short date.
 *   onPosted       Optional callback fired with the new comment after post.
 *
 * The adapter contract keeps the component framework-agnostic — Engage
 * and Learn both pass different adapters against the same shared
 * `comments` table or any other backend.
 */

const DEFAULT_THEME = {
  mono: "'SF Mono', 'Fira Code', Menlo, monospace",
  font: "'Inter', 'Segoe UI', sans-serif",
  border: '#e5e3db',
  card: '#fafaf7',
  card2: '#f2f1ec',
  ink: '#1a1a1a',
  muted: '#6b7280',
  accent: '#2563eb',
};

const DEFAULT_TYPES = ['comment', 'suggestion', 'correction', 'resource'];

function formatDateDefault(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return ''; }
}

function stableScopeKey(scope) {
  if (!scope || typeof scope !== 'object') return '';
  return Object.keys(scope).sort().map((k) => `${k}=${scope[k]}`).join('|');
}

export default function CommentsPanel({
  adapter,
  scope,
  currentUser,
  types = DEFAULT_TYPES,
  defaultType,
  label = 'Comments & Contributions',
  startOpen = false,
  theme,
  signInPrompt,
  formatDate = formatDateDefault,
  onPosted,
}) {
  const t = { ...DEFAULT_THEME, ...(theme || {}) };
  const typeList = Array.isArray(types) && types.length > 0 ? types : DEFAULT_TYPES;
  const initialType = defaultType && typeList.includes(defaultType) ? defaultType : typeList[0];

  const [open, setOpen] = useState(!!startOpen);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState(initialType);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);

  const scopeKey = stableScopeKey(scope);

  useEffect(() => {
    if (!open) return;
    if (!adapter || typeof adapter.listComments !== 'function') return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.resolve(adapter.listComments(scope))
      .then((rows) => {
        if (cancelled) return;
        setComments(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Could not load comments');
        setComments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // Re-fetch whenever scope changes (by stable key) or panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scopeKey]);

  async function handlePost() {
    if (!newComment.trim() || !currentUser) return;
    if (!adapter || typeof adapter.postComment !== 'function') return;
    setPosting(true);
    setError(null);
    try {
      const created = await adapter.postComment(scope, {
        comment_type: commentType,
        content: newComment.trim(),
        user: currentUser,
      });
      const row = (created && typeof created === 'object') ? created : {
        id: `local-${Date.now()}`,
        comment_type: commentType,
        content: newComment.trim(),
        created_at: new Date().toISOString(),
        user_id: currentUser.id,
        profiles: currentUser.display_name ? { display_name: currentUser.display_name } : null,
      };
      setComments((prev) => [row, ...prev]);
      setNewComment('');
      onPosted?.(row);
    } catch (err) {
      setError(err?.message || 'Could not post comment');
    } finally {
      setPosting(false);
    }
  }

  const toggle = () => {
    setOpen((o) => !o);
  };

  const countLabel = open || comments.length
    ? ` (${comments.length})`
    : '';

  return (
    <div style={{ marginTop: 32, borderTop: `1px solid ${t.border}`, paddingTop: 24 }}>
      <button
        type="button"
        onClick={toggle}
        style={{
          background: 'none',
          border: `1px solid ${t.border}`,
          borderRadius: 4,
          padding: '8px 16px',
          color: t.muted,
          fontFamily: t.mono,
          fontSize: 10,
          cursor: 'pointer',
          letterSpacing: '0.08em',
          marginBottom: 16,
        }}
      >
        {open ? 'HIDE' : 'SHOW'} {label.toUpperCase()}{countLabel}
      </button>

      {open && (
        <div>
          {currentUser ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {typeList.map((type) => {
                  const active = commentType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCommentType(type)}
                      style={{
                        background: active ? `${t.accent}18` : 'none',
                        border: `1px solid ${active ? t.accent : t.border}`,
                        borderRadius: 4,
                        padding: '4px 10px',
                        color: active ? t.accent : t.muted,
                        fontFamily: t.mono,
                        fontSize: 9,
                        cursor: 'pointer',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {String(type).toUpperCase()}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={`Add a ${commentType}...`}
                  rows={2}
                  style={{
                    flex: 1,
                    background: t.card,
                    border: `1px solid ${t.border}`,
                    borderRadius: 4,
                    padding: '10px 14px',
                    color: t.ink,
                    fontFamily: t.font,
                    fontSize: 15,
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
                <button
                  type="button"
                  onClick={handlePost}
                  disabled={!newComment.trim() || posting}
                  style={{
                    background: t.accent,
                    border: 'none',
                    borderRadius: 4,
                    padding: '10px 16px',
                    color: '#fff',
                    fontFamily: t.mono,
                    fontSize: 10,
                    cursor: newComment.trim() && !posting ? 'pointer' : 'default',
                    alignSelf: 'flex-end',
                    opacity: newComment.trim() && !posting ? 1 : 0.4,
                    letterSpacing: '0.08em',
                  }}
                >
                  {posting ? 'POSTING…' : 'POST'}
                </button>
              </div>
            </>
          ) : (
            signInPrompt || (
              <div
                style={{
                  background: t.card2,
                  border: `1px solid ${t.border}`,
                  borderRadius: 4,
                  padding: 12,
                  fontFamily: t.mono,
                  fontSize: 11,
                  color: t.muted,
                  marginBottom: 16,
                  letterSpacing: '0.04em',
                }}
              >
                Sign in to post a comment, suggestion, correction, or resource.
              </div>
            )
          )}

          {loading && (
            <div style={{ fontFamily: t.mono, fontSize: 11, color: t.muted, padding: '8px 0' }}>
              LOADING…
            </div>
          )}
          {error && (
            <div style={{ fontFamily: t.mono, fontSize: 11, color: '#b91c1c', padding: '8px 0' }}>
              {error}
            </div>
          )}

          {!loading && comments.length === 0 && (
            <div style={{ fontFamily: t.mono, fontSize: 11, color: t.muted, padding: '12px 0' }}>
              No {label.toLowerCase()} yet. Add the first.
            </div>
          )}

          {comments.map((c) => {
            const displayName = c.profiles?.display_name || c.display_name || 'Anonymous';
            return (
              <div
                key={c.id || `${displayName}-${c.created_at}-${(c.content || '').slice(0, 20)}`}
                style={{
                  background: t.card,
                  border: `1px solid ${t.border}`,
                  borderRadius: 6,
                  padding: 16,
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: t.mono,
                      fontSize: 9,
                      color: t.accent,
                      letterSpacing: '0.08em',
                      background: `${t.accent}12`,
                      border: `1px solid ${t.accent}33`,
                      borderRadius: 2,
                      padding: '2px 6px',
                    }}
                  >
                    {(c.comment_type || 'comment').toUpperCase()}
                  </span>
                  <span style={{ fontFamily: t.mono, fontSize: 10, color: t.muted }}>
                    {displayName}
                  </span>
                  <span style={{ fontFamily: t.mono, fontSize: 10, color: t.muted, marginLeft: 'auto' }}>
                    {formatDate(c.created_at)}
                  </span>
                </div>
                <p style={{ color: t.ink, fontSize: 15, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {c.content}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
