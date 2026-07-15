// Lightweight, safe post formatting: a small markdown-like syntax stored as
// plain text (**bold**, *italic*, "> quote", "- list item"), parsed into
// React elements at render time. Deliberately not HTML/contentEditable —
// storing and rendering real HTML from user input is an XSS risk; this
// approach never touches dangerouslySetInnerHTML, so there's nothing to
// sanitize in the first place.

function parseInline(text, keyPrefix) {
  const parts = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      parts.push(<strong key={`${keyPrefix}-b-${i++}`}>{match[1]}</strong>);
    } else {
      parts.push(<em key={`${keyPrefix}-i-${i++}`}>{match[2]}</em>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export function renderFormattedText(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const blocks = [];
  let listBuffer = [];

  const flushList = (key) => {
    if (listBuffer.length) {
      blocks.push(<ul key={`ul-${key}`} className="post-bullet-list">{listBuffer}</ul>);
      listBuffer = [];
    }
  };

  lines.forEach((line, idx) => {
    if (line.startsWith('> ')) {
      flushList(idx);
      blocks.push(<blockquote key={`q-${idx}`} className="post-blockquote">{parseInline(line.slice(2), `q${idx}`)}</blockquote>);
    } else if (line.startsWith('- ')) {
      listBuffer.push(<li key={`li-${idx}`}>{parseInline(line.slice(2), `li${idx}`)}</li>);
    } else {
      flushList(idx);
      blocks.push(<span key={`ln-${idx}`}>{line ? parseInline(line, `ln${idx}`) : ' '}{idx < lines.length - 1 && <br />}</span>);
    }
  });
  flushList('end');
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
