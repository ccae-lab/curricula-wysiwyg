/**
 * YouTube shortcode: [youtube:VIDEO_ID]
 *
 * Pure string -> regex match. The React renderer lives in ./index.jsx so
 * this file stays dependency-free and testable in a Node environment.
 */

export const YOUTUBE_SHORTCODE_REGEX = /\[youtube:([a-zA-Z0-9_-]{6,16})\]/g;

/**
 * Extract a YouTube video ID from a raw URL the user might paste.
 * Returns the ID or null.
 *
 *   https://youtu.be/E0-a5cV5tL0             -> E0-a5cV5tL0
 *   https://www.youtube.com/watch?v=E0-a5cV5tL0 -> E0-a5cV5tL0
 *   https://www.youtube.com/embed/E0-a5cV5tL0 -> E0-a5cV5tL0
 *   E0-a5cV5tL0                               -> E0-a5cV5tL0
 */
export function extractYouTubeId(input) {
  if (!input) return null;
  const s = String(input).trim();
  // Direct ID
  if (/^[a-zA-Z0-9_-]{6,16}$/.test(s)) return s;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{6,16})/,       // ?v=ID
    /youtu\.be\/([a-zA-Z0-9_-]{6,16})/,   // youtu.be/ID
    /\/embed\/([a-zA-Z0-9_-]{6,16})/,     // /embed/ID
    /\/shorts\/([a-zA-Z0-9_-]{6,16})/,    // /shorts/ID
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return null;
}

/**
 * Given a line of text, test whether the whole line is a single shortcode.
 * Returns { id } if yes, null otherwise.
 */
export function matchYouTubeLine(line) {
  if (!line) return null;
  const m = String(line).trim().match(/^\[youtube:([a-zA-Z0-9_-]{6,16})\]$/);
  return m ? { id: m[1] } : null;
}
