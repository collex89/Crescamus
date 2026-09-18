// One-time migration: replaces DAILY_VERSES' hand-copied Douay-Rheims
// wording with the exact text from the app's own WEB data (src/data/bible-web/),
// pulled programmatically rather than retyped by hand -- same reasoning as
// scripts/parse-catholic-books.mjs: 164 verses is exactly the kind of volume
// where a manual transcription slip goes unnoticed.
//
// Run with: node scripts/swap-daily-verses-to-web.mjs
// Reads:    src/data/dailyVerses.js (regex-extracts the book/chapter/verse
//           of each entry -- it doesn't need the existing `text`)
// Writes:   src/data/dailyVerses.js (same file, `text` fields replaced)

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSES_PATH = path.join(__dirname, '..', 'src', 'data', 'dailyVerses.js');
const WEB_DIR = path.join(__dirname, '..', 'src', 'data', 'bible-web');

const src = readFileSync(VERSES_PATH, 'utf8');

const entryRegex = /\{ book: '([^']+)', chapter: (\d+), verse: (\d+), text: '((?:[^'\\]|\\.)*)' \}/g;
const entries = [...src.matchAll(entryRegex)];
console.log(`Found ${entries.length} entries in dailyVerses.js`);

const webCache = new Map();
function loadWebBook(bookId) {
  if (!webCache.has(bookId)) {
    const filePath = path.join(WEB_DIR, `${bookId}.json`);
    webCache.set(bookId, JSON.parse(readFileSync(filePath, 'utf8')));
  }
  return webCache.get(bookId);
}

// JS string literal -> readable text, since the source has escaped quotes.
function unescapeJs(str) {
  return str.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

// Readable text -> safe JS single-quoted string literal.
function escapeJs(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

let newSrc = src;
let replaced = 0;
let missing = [];

for (const match of entries) {
  const [fullMatch, book, chapter, verse] = match;
  const bookData = loadWebBook(book);
  const verses = bookData[chapter];
  const verseObj = verses?.find(v => v.v === Number(verse));
  if (!verseObj) {
    missing.push(`${book} ${chapter}:${verse}`);
    continue;
  }
  const newText = escapeJs(verseObj.t);
  const newEntry = `{ book: '${book}', chapter: ${chapter}, verse: ${verse}, text: '${newText}' }`;
  newSrc = newSrc.replace(fullMatch, newEntry);
  replaced++;
}

if (missing.length > 0) {
  console.log(`\n✗ ${missing.length} verse(s) not found in WEB data (left unchanged):`);
  missing.forEach(m => console.log(`  - ${m}`));
}

writeFileSync(VERSES_PATH, newSrc);
console.log(`\n✓ Replaced ${replaced}/${entries.length} verses with WEB text.`);
