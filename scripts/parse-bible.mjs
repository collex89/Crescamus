// One-time build script: parses the public-domain Douay-Rheims (Challoner
// revision) text from Project Gutenberg into per-book JSON files matching
// Credora's existing BIBLE_BOOKS ids, so the Bible reader has real,
// complete, legally-free scripture text for all 73 Catholic canon books.
//
// Run with: node scripts/parse-bible.mjs
// Source:   scripts/dr_source.txt (Project Gutenberg ebook #1581, public domain)
// Output:   src/data/bible/<id>.json  (one file per book)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, 'dr_source.txt');
const OUT_DIR = path.join(__dirname, '..', 'src', 'data', 'bible');

// Douay-Rheims book title (as it appears in "<Title> Chapter N" headers) ->
// Credora book id + expected chapter count (from src/data/mockData.js).
const BOOK_MAP = [
  ['Genesis', 'gen', 50], ['Exodus', 'exo', 40], ['Leviticus', 'lev', 27],
  ['Numbers', 'num', 36], ['Deuteronomy', 'deu', 34], ['Josue', 'jos', 24],
  ['Judges', 'jud', 21], ['Ruth', 'rut', 4], ['1 Kings', '1sam', 31],
  ['2 Kings', '2sam', 24], ['3 Kings', '1kin', 22], ['4 Kings', '2kin', 25],
  ['1 Paralipomenon', '1chr', 29], ['2 Paralipomenon', '2chr', 36],
  ['1 Esdras', 'ezr', 10], ['2 Esdras', 'neh', 13], ['Tobias', 'tob', 14],
  ['Judith', 'jdt', 16], ['Esther', 'est', 10], ['Job', 'job', 42],
  ['Psalms', 'psa', 150], ['Proverbs', 'pro', 31], ['Ecclesiastes', 'ecc', 12],
  ['Canticle of Canticles', 'sg', 8], ['Wisdom', 'wis', 19],
  ['Ecclesiasticus', 'sir', 51], ['Isaias', 'isa', 66], ['Jeremias', 'jer', 52],
  ['Lamentations', 'lam', 5], ['Baruch', 'bar', 6], ['Ezechiel', 'eze', 48],
  ['Daniel', 'dan', 14], ['Osee', 'hos', 14], ['Joel', 'joe', 3],
  ['Amos', 'amo', 9], ['Abdias', 'oba', 1], ['Jonas', 'jon', 4],
  ['Micheas', 'mic', 7], ['Nahum', 'nah', 3], ['Habacuc', 'hab', 3],
  ['Sophonias', 'zep', 3], ['Aggeus', 'hag', 2], ['Zacharias', 'zec', 14],
  ['Malachias', 'mal', 4], ['1 Machabees', '1mac', 16], ['2 Machabees', '2mac', 15],
  ['Matthew', 'mat', 28], ['Mark', 'mar', 16], ['Luke', 'luk', 24],
  ['John', 'joh', 21], ['Acts', 'act', 28], ['Romans', 'rom', 16],
  ['1 Corinthians', '1cor', 16], ['2 Corinthians', '2cor', 13],
  ['Galatians', 'gal', 6], ['Ephesians', 'eph', 6], ['Philippians', 'phi', 4],
  ['Colossians', 'col', 4], ['1 Thessalonians', '1the', 5],
  ['2 Thessalonians', '2the', 3], ['1 Timothy', '1tim', 6],
  ['2 Timothy', '2tim', 4], ['Titus', 'tit', 3], ['Philemon', 'phm', 1],
  ['Hebrews', 'heb', 13], ['James', 'jam', 5], ['1 Peter', '1pet', 5],
  ['2 Peter', '2pet', 3], ['1 John', '1joh', 5], ['2 John', '2joh', 1],
  ['3 John', '3joh', 1], ['Jude', 'jud_nt', 1], ['Apocalypse', 'rev', 22]
];

const text = readFileSync(SRC, 'utf-8');

// Trim Project Gutenberg's license header/footer.
const startMarker = '*** START OF THE PROJECT GUTENBERG EBOOK';
const endMarker = '*** END OF THE PROJECT GUTENBERG EBOOK';
const body = text.slice(
  text.indexOf(startMarker) + startMarker.length,
  text.indexOf(endMarker)
);

// Build a title -> id/chapters lookup, longest title first so "1 Kings"
// doesn't accidentally get matched by a shorter partial title, etc.
const titleToBook = new Map(BOOK_MAP.map(([title, id, chapters]) => [title, { id, chapters }]));
const headerRegex = /^([A-Za-z0-9 ]+?) Chapter (\d+)$/;

const lines = body.split('\n');
const books = new Map(); // id -> { chapters: { [num]: [{v,t}] } }
let currentBookId = null;
let currentChapter = null;
let paragraphLines = [];

function flushParagraph() {
  if (!paragraphLines.length) return;
  const para = paragraphLines.join(' ').replace(/\s+/g, ' ').trim();
  paragraphLines = [];
  if (!para || !currentBookId || currentChapter === null) return;

  const verseMatch = para.match(/^(\d+):(\d+)\.\s*(.*)$/);
  if (!verseMatch) return; // footnote/commentary paragraph — skip

  const verseNum = parseInt(verseMatch[2], 10);
  const verseText = verseMatch[3].trim();
  if (!verseText) return;

  const book = books.get(currentBookId);
  if (!book.chapters[currentChapter]) book.chapters[currentChapter] = [];
  book.chapters[currentChapter].push({ v: verseNum, t: verseText });
}

for (const rawLine of lines) {
  const line = rawLine.trim();

  const headerMatch = line.match(headerRegex);
  if (headerMatch && titleToBook.has(headerMatch[1])) {
    flushParagraph();
    const { id } = titleToBook.get(headerMatch[1]);
    currentBookId = id;
    currentChapter = parseInt(headerMatch[2], 10);
    if (!books.has(id)) books.set(id, { chapters: {} });
    continue;
  }

  if (line === '') {
    flushParagraph();
    continue;
  }

  paragraphLines.push(line);
}
flushParagraph();

// Write one JSON file per book + collect a validation report.
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const report = [];
for (const [title, id, expectedChapters] of BOOK_MAP) {
  const book = books.get(id);
  if (!book) {
    report.push(`MISSING BOOK: ${title} (${id})`);
    continue;
  }
  const chapterNums = Object.keys(book.chapters).map(Number).sort((a, b) => a - b);
  const actualChapters = chapterNums.length;
  const totalVerses = chapterNums.reduce((sum, c) => sum + book.chapters[c].length, 0);
  const flag = actualChapters !== expectedChapters ? '  <== CHAPTER COUNT MISMATCH' : '';
  report.push(`${id.padEnd(7)} ${title.padEnd(24)} chapters ${String(actualChapters).padStart(3)}/${expectedChapters}  verses ${totalVerses}${flag}`);

  writeFileSync(
    path.join(OUT_DIR, `${id}.json`),
    JSON.stringify(book.chapters)
  );
}

writeFileSync(path.join(__dirname, 'parse-report.txt'), report.join('\n'));
console.log(report.join('\n'));
console.log(`\nWrote ${books.size} book files to ${OUT_DIR}`);
