// Lightweight, safe post formatting: a small markdown-like syntax stored as
// plain text (**bold**, *italic*, "> quote", "- list item"), parsed into
// React elements at render time. Deliberately not HTML/contentEditable —
// storing and rendering real HTML from user input is an XSS risk; this
// approach never touches dangerouslySetInnerHTML, so there's nothing to
// sanitize in the first place.

import { findVerseReferences, stripScriptureMetadata, getPostScriptureEmbed } from './bibleReferences.js';

// Splits a plain string on @username mentions and Bible verse references
// (e.g. "Philippians 4:19", "Phil 4:19", "philiphians 4:19", "John 3:16"),
// turning each into an interactive clickable token.
function splitTokens(text, keyPrefix, onMentionClick, onVerseClick) {
  if (!text) return [];

  const tokens = [];

  // 1. Find @mentions
  const mentionRegex = /(^|[^a-zA-Z0-9])@([a-z0-9._]{3,20})/gi;
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    const prefixLen = match[1] ? match[1].length : 0;
    const start = match.index + prefixLen;
    const raw = '@' + match[2];
    tokens.push({
      type: 'mention',
      start,
      end: start + raw.length,
      raw,
      username: match[2].toLowerCase()
    });
  }

  // 2. Find Bible references
  const verseRefs = findVerseReferences(text);
  verseRefs.forEach(ref => {
    tokens.push({
      type: 'verse',
      start: ref.index,
      end: ref.index + ref.length,
      raw: ref.rawText,
      ref
    });
  });

  if (tokens.length === 0) return [text];

  // Sort tokens by start position, resolving any unexpected overlap
  tokens.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  const filteredTokens = [];
  let currentEnd = 0;
  for (const t of tokens) {
    if (t.start >= currentEnd) {
      filteredTokens.push(t);
      currentEnd = t.end;
    }
  }

  const out = [];
  let lastIndex = 0;
  let i = 0;

  filteredTokens.forEach(t => {
    if (t.start > lastIndex) {
      out.push(text.slice(lastIndex, t.start));
    }

    if (t.type === 'mention') {
      out.push(
        <span
          key={`${keyPrefix}-m-${i++}`}
          className="mention-link"
          onClick={onMentionClick ? (e) => { e.stopPropagation(); onMentionClick(t.username); } : undefined}
        >
          {t.raw}
        </span>
      );
    } else if (t.type === 'verse') {
      out.push(
        <span
          key={`${keyPrefix}-v-${i++}`}
          className="verse-ref-badge"
          role="button"
          tabIndex={0}
          title={`Open ${t.ref.display} in Bible`}
          onClick={onVerseClick ? (e) => { e.stopPropagation(); onVerseClick(t.ref); } : undefined}
        >
          <svg className="verse-ref-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
            <path d="M6 6h10"/>
            <path d="M6 10h10"/>
          </svg>
          <span className="verse-ref-text">{t.raw}</span>
        </span>
      );
    }

    lastIndex = t.end;
  });

  if (lastIndex < text.length) {
    out.push(text.slice(lastIndex));
  }

  return out;
}

// Three alternatives, ordered longest-marker-first so ***both*** is taken as
// bold+italic rather than as **bold** plus a stray asterisk -- which is what
// the composer's two toolbar buttons produce when both are applied to the
// same selection, and why they appeared not to work together at all.
//
// The italic branch can't just be \*(.+?)\*: lazily, that closes on the
// first asterisk of a following **bold**, splitting one italic run into
// three. So its body accepts either a non-asterisk or a doubled asterisk,
// and its closing marker must not itself be the start of a doubled one.
// (The two body alternatives are mutually exclusive on the next character,
// so there's no ambiguity for the engine to backtrack over.)
const INLINE_RE = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*((?:[^*]|\*\*)+?)\*(?!\*)/g;

// Recurses into whatever each marker wrapped, so nesting works in both
// directions and so @mentions and verse references inside bold/italic still become links -- the
// leaf strings are the only place splitTokens runs. Each recursive call
// gets a strictly shorter string (at least two markers are stripped), so
// this always terminates.
function parseInline(text, keyPrefix, onMentionClick, onVerseClick, depth = 0) {
  const parts = [];
  const regex = new RegExp(INLINE_RE.source, 'g');
  let lastIndex = 0;
  let match;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const key = `${keyPrefix}-d${depth}-${i++}`;
    const inner = (body) => parseInline(body, key, onMentionClick, onVerseClick, depth + 1);
    if (match[1] !== undefined) {
      parts.push(<strong key={key}><em>{inner(match[1])}</em></strong>);
    } else if (match[2] !== undefined) {
      parts.push(<strong key={key}>{inner(match[2])}</strong>);
    } else {
      parts.push(<em key={key}>{inner(match[3])}</em>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return parts.flatMap((part, idx) =>
    typeof part === 'string' ? splitTokens(part, `${keyPrefix}-d${depth}-${idx}`, onMentionClick, onVerseClick) : part
  );
}

// onMentionClick(username) and onVerseClick(ref), if given, are called when a rendered
// @mention or Bible verse is tapped -- lets the caller navigate without this
// module needing to know anything about app navigation.
// renderEmbed(targetRef) if given renders an inline Holy Scripture embed card immediately
// after the referenced scripture line.
export function renderFormattedText(text, onMentionClick, onVerseClick, renderEmbed = null, scriptureRef = null) {
  if (!text) return null;

  const targetScripture = getPostScriptureEmbed(text, scriptureRef);
  const rawLines = text.split('\n');
  const blocks = [];
  let listBuffer = [];
  let embedRendered = false;

  const flushList = (key) => {
    if (listBuffer.length) {
      blocks.push(<ul key={`ul-${key}`} className="post-bullet-list">{listBuffer}</ul>);
      listBuffer = [];
    }
  };

  rawLines.forEach((rawLine, idx) => {
    // 1. If this line is the scripture metadata comment, render the embed immediately here
    const isMetaLine = /<!--scripture:([a-z0-9_]+):(\d+)(?::(\d+))?(:no-embed)?-->/i.test(rawLine.trim());
    if (isMetaLine) {
      flushList(idx);
      if (!embedRendered && targetScripture && renderEmbed) {
        embedRendered = true;
        blocks.push(
          <div key={`embed-${idx}`} className="inline-scripture-embed-slot">
            {renderEmbed(targetScripture)}
          </div>
        );
      }
      return;
    }

    const line = stripScriptureMetadata(rawLine);

    if (line.startsWith('> ')) {
      flushList(idx);
      blocks.push(<blockquote key={`q-${idx}`} className="post-blockquote">{parseInline(line.slice(2), `q${idx}`, onMentionClick, onVerseClick)}</blockquote>);
    } else if (line.startsWith('- ')) {
      listBuffer.push(<li key={`li-${idx}`}>{parseInline(line.slice(2), `li${idx}`, onMentionClick, onVerseClick)}</li>);
    } else {
      flushList(idx);
      blocks.push(
        <span key={`ln-${idx}`}>
          {line ? parseInline(line, `ln${idx}`, onMentionClick, onVerseClick) : ' '}
          {idx < rawLines.length - 1 && <br />}
        </span>
      );
    }

    // 2. If this line contains the target scripture reference and embed hasn't rendered yet
    if (!embedRendered && targetScripture && renderEmbed) {
      const refs = findVerseReferences(line);
      const hasMatch = refs.some(r => r.bookId === targetScripture.bookId && r.chapter === targetScripture.chapter && (!targetScripture.verse || r.verse === targetScripture.verse));
      if (hasMatch) {
        embedRendered = true;
        blocks.push(
          <div key={`embed-after-${idx}`} className="inline-scripture-embed-slot">
            {renderEmbed(targetScripture)}
          </div>
        );
      }
    }
  });

  flushList('end');

  // Fallback: If scripture was referenced but not yet rendered inline, place at the end
  if (!embedRendered && targetScripture && renderEmbed) {
    blocks.push(
      <div key="embed-fallback" className="inline-scripture-embed-slot">
        {renderEmbed(targetScripture)}
      </div>
    );
  }

  return blocks;
}


// Wraps the current textarea selection with marker strings (or inserts an
// empty pair and places the cursor between them if nothing is selected) —
// the same interaction pattern as GitHub's markdown editor toolbar.
export function wrapSelection(textarea, value, setValue, before, after = before) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.slice(start, end);
  const newValue = value.slice(0, start) + before + selected + after + value.slice(end);
  setValue(newValue);
  requestAnimationFrame(() => {
    textarea.focus();
    const cursorStart = start + before.length;
    textarea.setSelectionRange(cursorStart, cursorStart + selected.length);
  });
}

// Prefixes every line touched by the current selection with the given
// marker (e.g. "> " or "- "), toggling it off if already present.
export function prefixLines(textarea, value, setValue, prefix) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = value.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = value.length;

  const block = value.slice(lineStart, lineEnd);
  const alreadyPrefixed = block.split('\n').every(l => l === '' || l.startsWith(prefix));
  const newBlock = block
    .split('\n')
    .map(l => (alreadyPrefixed ? l.slice(prefix.length) : l === '' ? l : prefix + l))
    .join('\n');

  const newValue = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
  setValue(newValue);
  requestAnimationFrame(() => textarea.focus());
}

// Inserts text at the current cursor position (or replaces the selection),
// then places the cursor right after it — used for emoji insertion.
export function insertAtCursor(textarea, value, setValue, text) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const newValue = value.slice(0, start) + text + value.slice(end);
  setValue(newValue);
  requestAnimationFrame(() => {
    textarea.focus();
    const cursor = start + text.length;
    textarea.setSelectionRange(cursor, cursor);
  });
}
