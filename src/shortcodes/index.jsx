import React from 'react';
import { matchYouTubeLine, YOUTUBE_SHORTCODE_REGEX } from './youtube.js';

/**
 * Shortcode rendering for content-blocks text.
 *
 * The convention is block-level: each line is inspected, and if the whole
 * line is a single shortcode, it renders as a rich embed. Otherwise the
 * line renders as plain text (or through the consumer-supplied renderLine).
 *
 * Supported shortcodes:
 *   [youtube:ID]          -> <ShortcodeYouTube id="ID" />
 *
 * Inline shortcodes (multiple per line) are intentionally NOT supported in
 * the current minimal renderer. Consumers who need inline behaviour can
 * call parseShortcodes() and compose themselves.
 */

export { matchYouTubeLine, YOUTUBE_SHORTCODE_REGEX, extractYouTubeId } from './youtube.js';

export function ShortcodeYouTube({ id, classNames = {} }) {
  if (!id) return null;
  return (
    <div
      className={classNames.wrapper || ''}
      style={classNames.wrapper ? undefined : {
        position: 'relative',
        paddingBottom: '56.25%',
        height: 0,
        margin: '16px 0',
        overflow: 'hidden',
      }}
    >
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        title={`YouTube ${id}`}
        className={classNames.iframe || ''}
        style={classNames.iframe ? undefined : {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 0,
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

/**
 * Render a string with shortcode support.
 * Splits by newline, checks each line for a whole-line shortcode,
 * otherwise passes through to `renderLine` (default: wrap in <p>).
 */
export function ShortcodePrint({ text, renderLine, classNames = {} }) {
  if (!text) return null;
  const lines = String(text).split('\n');

  return (
    <>
      {lines.map((line, i) => {
        const yt = matchYouTubeLine(line);
        if (yt) {
          return <ShortcodeYouTube key={i} id={yt.id} classNames={classNames} />;
        }
        if (renderLine) return <React.Fragment key={i}>{renderLine(line, i)}</React.Fragment>;
        if (line.trim() === '') return null;
        return (
          <p key={i} className={classNames.paragraph || ''} style={classNames.paragraph ? undefined : { margin: 0 }}>
            {line}
          </p>
        );
      })}
    </>
  );
}

/**
 * Pure helper: returns true if the text contains any supported shortcode.
 * Useful for deciding whether to hand the string to ShortcodePrint or
 * just render as plain text.
 */
export function hasShortcode(text) {
  if (!text) return false;
  return YOUTUBE_SHORTCODE_REGEX.test(String(text));
}
