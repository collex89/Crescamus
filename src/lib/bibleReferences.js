import { BIBLE_BOOKS } from '../data/mockData.js';

// Map of canonical book IDs to aliases, abbreviations, and common phonetic misspellings
const BOOK_ALIASES = {
  gen: ['genesis', 'gen', 'ge', 'gn'],
  exo: ['exodus', 'exod', 'exo', 'ex'],
  lev: ['leviticus', 'lev', 'le', 'lv'],
  num: ['numbers', 'numb', 'num', 'nu', 'nm', 'nb'],
  deu: ['deuteronomy', 'deut', 'deu', 'dt'],
  jos: ['joshua', 'josh', 'jos', 'jsh'],
  jud: ['judges', 'judg', 'jdg', 'jgs'],
  rut: ['ruth', 'rut', 'rth', 'ru'],
  '1sam': ['1 samuel', '1samuel', '1 sam', '1sam', '1 s', '1sa', '1s', 'i samuel', 'i sam'],
  '2sam': ['2 samuel', '2samuel', '2 sam', '2sam', '2 s', '2sa', '2s', 'ii samuel', 'ii sam'],
  '1kin': ['1 kings', '1kings', '1 kgs', '1kgs', '1 kin', '1kin', '1 ki', '1ki', '1k', 'i kings', 'i kgs'],
  '2kin': ['2 kings', '2kings', '2 kgs', '2kgs', '2 kin', '2kin', '2 ki', '2ki', '2k', 'ii kings', 'ii kgs'],
  '1chr': ['1 chronicles', '1chronicles', '1 chron', '1chron', '1 chr', '1chr', '1 ch', '1ch', 'i chronicles', 'i chron'],
  '2chr': ['2 chronicles', '2chronicles', '2 chron', '2chron', '2 chr', '2chr', '2 ch', '2ch', 'ii chronicles', 'ii chron'],
  ezr: ['ezra', 'ezr'],
  neh: ['nehemiah', 'neh', 'ne'],
  tob: ['tobit', 'tobias', 'tob', 'tb'],
  jdt: ['judith', 'judt', 'jdt', 'jth'],
  est: ['esther', 'esth', 'est', 'es'],
  '1mac': ['1 maccabees', '1maccabees', '1 machabees', '1machabees', '1 macc', '1macc', '1 mac', '1mac', '1 mach', 'i maccabees', 'i mac'],
  '2mac': ['2 maccabees', '2maccabees', '2 machabees', '2machabees', '2 macc', '2macc', '2 mac', '2mac', '2 mach', 'ii maccabees', 'ii mac'],
  job: ['job', 'jb'],
  psa: ['psalms', 'psalm', 'psa', 'pss', 'pslm', 'pslam', 'ps'],
  pro: ['proverbs', 'proverb', 'prov', 'pro', 'prv', 'pr'],
  ecc: ['ecclesiastes', 'eccl', 'ecc', 'qoheleth', 'qoh'],
  sg: ['song of songs', 'song of solomon', 'canticle of canticles', 'canticles', 'song', 'cant', 'sg', 'sos'],
  wis: ['wisdom of solomon', 'wisdom', 'wis', 'wsd'],
  sir: ['sirach', 'ecclesiasticus', 'sir', 'ecclus'],
  isa: ['isaiah', 'isai', 'isa', 'is'],
  jer: ['jeremiah', 'jer', 'je', 'jr'],
  lam: ['lamentations', 'lam', 'la'],
  bar: ['baruch', 'bar', 'ba'],
  eze: ['ezekiel', 'ezek', 'eze', 'ezk'],
  dan: ['daniel', 'dan', 'da', 'dn'],
  hos: ['hosea', 'hos', 'ho'],
  joe: ['joel', 'joe', 'jl'],
  amo: ['amos', 'amo', 'am'],
  oba: ['obadiah', 'obad', 'oba', 'ob'],
  jon: ['jonah', 'jon', 'jnh'],
  mic: ['micah', 'mic', 'mc'],
  nah: ['nahum', 'nah', 'na'],
  hab: ['habakkuk', 'hab', 'hb'],
  zep: ['zephaniah', 'zeph', 'zep', 'zp'],
  hag: ['haggai', 'hag', 'hg'],
  zec: ['zechariah', 'zech', 'zec', 'zc'],
  mal: ['malachi', 'mal', 'ml'],
  mat: ['matthew', 'matt', 'mat', 'mt'],
  mar: ['mark', 'mar', 'mk', 'mrk'],
  luk: ['luke', 'luk', 'lk'],
  joh: ['john', 'joh', 'jn', 'jhn'],
  act: ['acts of the apostles', 'acts', 'act', 'ac'],
  rom: ['romans', 'rom', 'ro', 'rm'],
  '1cor': ['1 corinthians', '1corinthians', '1 cor', '1cor', '1 co', '1co', '1c', 'i corinthians', 'i cor'],
  '2cor': ['2 corinthians', '2corinthians', '2 cor', '2cor', '2 co', '2co', '2c', 'ii corinthians', 'ii cor'],
  gal: ['galatians', 'gal', 'ga'],
  eph: ['ephesians', 'ephes', 'eph', 'ep'],
  phi: [
    'philippians', 'philiphians', 'philipians', 'phillippians', 'philippian',
    'phil', 'php', 'pp'
  ],
  col: ['colossians', 'coloss', 'col', 'co'],
  '1the': ['1 thessalonians', '1thessalonians', '1 thess', '1thess', '1 th', '1th', 'i thessalonians', 'i thess'],
  '2the': ['2 thessalonians', '2thessalonians', '2 thess', '2thess', '2 th', '2th', 'ii thessalonians', 'ii thess'],
  '1tim': ['1 timothy', '1timothy', '1 tim', '1tim', '1 ti', '1ti', 'i timothy', 'i tim'],
  '2tim': ['2 timothy', '2timothy', '2 tim', '2tim', '2 ti', '2ti', 'ii timothy', 'ii tim'],
  tit: ['titus', 'tit', 'ti'],
  phm: ['philemon', 'philem', 'phm', 'pm'],
  heb: ['hebrews', 'hebr', 'heb', 'he'],
  jam: ['james', 'jas', 'jam', 'jm'],
  '1pet': ['1 peter', '1peter', '1 pet', '1pet', '1 pe', '1pe', '1p', 'i peter', 'i pet'],
  '2pet': ['2 peter', '2peter', '2 pet', '2pet', '2 pe', '2pe', '2p', 'ii peter', 'ii pet'],
  '1joh': ['1 john', '1john', '1 joh', '1joh', '1 jn', '1jn', '1j', 'i john', 'i jn'],
  '2joh': ['2 john', '2john', '2 joh', '2joh', '2 jn', '2jn', '2j', 'ii john', 'ii jn'],
  '3joh': ['3 john', '3john', '3 joh', '3joh', '3 jn', '3jn', '3j', 'iii john', 'iii jn'],
  jud_nt: ['jude', 'judas'],
  rev: ['revelation', 'revelations', 'apocalypse', 'rev', 're', 'apoc']
};

// Flatten into alias -> bookId lookup
const ALIAS_LOOKUP = new Map();
const ALL_ALIASES_SORTED = [];

// Populate lookup with book canonical name, ID, and defined aliases
BIBLE_BOOKS.forEach(book => {
  const normName = book.name.toLowerCase();
  ALIAS_LOOKUP.set(normName, book.id);
  ALIAS_LOOKUP.set(book.id.toLowerCase(), book.id);

  const aliases = BOOK_ALIASES[book.id] || [];
  aliases.forEach(a => {
    ALIAS_LOOKUP.set(a.toLowerCase(), book.id);
  });
});

// Create sorted list of aliases by length descending so longer phrases match first
// (e.g. "1 thessalonians" matches before "1 th")
Array.from(ALIAS_LOOKUP.keys())
  .sort((a, b) => b.length - a.length)
  .forEach(alias => {
    // Avoid single-letter collision if any; aliases like '1c', 'jn', 'mt' are safe with boundaries
    if (alias.length >= 2) {
      ALL_ALIASES_SORTED.push(alias);
    }
  });

// Escape string for regex
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Regex to capture book alias followed by chapter[:verse[-endVerse]]
// e.g., "Philippians 4:19", "Phil 4:19-20", "John 3:16", "1 Cor 13:4-8", "Genesis 1:1"
const ALIASES_PATTERN = ALL_ALIASES_SORTED.map(escapeRegex).join('|');

// Matches [book alias] [chapter](: [verse](- [endVerse])?)?
// Uses word boundary / non-alphanumeric check to avoid matching inside other words or URLs
export const BIBLE_VERSE_REGEX = new RegExp(
  `\\b(${ALIASES_PATTERN})\\.?\\s+(\\d{1,3})(?:\\s*[:.,]\\s*(\\d{1,3})(?:\\s*[-–—]\\s*(\\d{1,3}))?)?\\b`,
  'gi'
);

/**
 * Resolves any raw book query/alias to the BIBLE_BOOKS item
 */
export function resolveBook(rawAlias) {
  if (!rawAlias) return null;
  const clean = rawAlias.trim().toLowerCase().replace(/\.$/, '');
  const bookId = ALIAS_LOOKUP.get(clean);
  if (!bookId) return null;
  return BIBLE_BOOKS.find(b => b.id === bookId) || null;
}

/**
 * Scans text and extracts all verified Bible references with their indices
 */
export function findVerseReferences(text) {
  if (!text || typeof text !== 'string') return [];
  const results = [];
  const regex = new RegExp(BIBLE_VERSE_REGEX.source, 'gi');
  let match;

  while ((match = regex.exec(text)) !== null) {
    const rawMatch = match[0];
    const rawBook = match[1];
    const chapter = parseInt(match[2], 10);
    const verse = match[3] ? parseInt(match[3], 10) : null;
    const endVerse = match[4] ? parseInt(match[4], 10) : null;

    const book = resolveBook(rawBook);
    if (!book) continue;

    // Validate chapter is within book's chapter range
    if (chapter < 1 || chapter > book.chapters) continue;

    // Build canonical display string (e.g. "Philippians 4:19")
    let display = `${book.name} ${chapter}`;
    if (verse !== null) {
      display += `:${verse}`;
      if (endVerse !== null && endVerse > verse) {
        display += `-${endVerse}`;
      }
    }

    results.push({
      index: match.index,
      length: rawMatch.length,
      rawText: rawMatch,
      bookId: book.id,
      bookName: book.name,
      chapter,
      verse,
      endVerse,
      display
    });
  }

  return results;
}

/**
 * Parses an explicit query string (e.g., from `/verse Phil 4:19` or search bar)
 */
export function parseVerseQuery(query) {
  if (!query) return null;
  const trimmed = query.trim();
  const refs = findVerseReferences(trimmed);
  if (refs.length > 0) return refs[0];

  // Try partial fallback e.g. "Phil 4" or "John"
  const parts = trimmed.split(/[\s:,]+/);
  if (parts.length >= 1) {
    const book = resolveBook(parts[0]);
    if (book) {
      const chapter = parts.length > 1 ? parseInt(parts[1], 10) : 1;
      const verse = parts.length > 2 ? parseInt(parts[2], 10) : null;
      const validChapter = isNaN(chapter) ? 1 : Math.max(1, Math.min(chapter, book.chapters));
      return {
        bookId: book.id,
        bookName: book.name,
        chapter: validChapter,
        verse: isNaN(verse) ? null : verse,
        display: `${book.name} ${validChapter}${verse ? `:${verse}` : ''}`,
        rawText: trimmed
      };
    }
  }

  return null;
}

/**
 * Searches books by partial name or alias
 */
export function searchBooks(query) {
  if (!query) return BIBLE_BOOKS.slice(0, 10);
  const q = query.trim().toLowerCase();
  return BIBLE_BOOKS.filter(b => {
    if (b.name.toLowerCase().includes(q)) return true;
    if (b.id.toLowerCase().includes(q)) return true;
    const aliases = BOOK_ALIASES[b.id] || [];
    return aliases.some(a => a.startsWith(q));
  }).slice(0, 8);
}

/**
 * Strips hidden scripture metadata comments e.g. <!--scripture:joh:14:6-->
 */
export function stripScriptureMetadata(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/<!--scripture:[^>]+-->/g, '').trimEnd();
}

/**
 * Determines whether a post has an explicitly referenced scripture whose content should be displayed.
 * 
 * Returns the target reference object { bookId, bookName, chapter, verse, endVerse, display } or null.
 * 
 * A post's verse content shows if:
 * 1. An explicit `scriptureRef` object is attached with `showContent !== false`.
 * 2. An explicit metadata tag `<!--scripture:bookId:chapter:verse-->` is present in the post text (without :no-embed).
 * 3. The post contains a dedicated, standalone scripture reference line (e.g. "John 14:6" or "— John 14:6"),
 *    and the post does NOT already contain blockquotes ('>') typing out the verse content manually.
 * 
 * If a verse is only mentioned casually inside normal prose / sentences (e.g. "I love John 14:6"),
 * it is "just written by who is making the post" and returns null so its content does NOT show.
 */
export function getPostScriptureEmbed(text, scriptureRef = null) {
  if (scriptureRef) {
    if (scriptureRef.showContent === false) return null;
    return scriptureRef;
  }

  if (!text || typeof text !== 'string') return null;

  // 1. Explicit metadata comment <!--scripture:bookId:chapter[:verse][:no-embed]?-->
  // Inserted ONLY when the author uses the "Reference Scripture" tool/modal
  const metaMatch = text.match(/<!--scripture:([a-z0-9_]+):(\d+)(?::(\d+))?(:no-embed)?-->/i);
  if (metaMatch) {
    if (metaMatch[4] === ':no-embed') return null;
    const book = BIBLE_BOOKS.find(b => b.id === metaMatch[1]);
    const chapter = parseInt(metaMatch[2], 10);
    const verse = metaMatch[3] ? parseInt(metaMatch[3], 10) : null;
    if (book) {
      return {
        bookId: book.id,
        bookName: book.name,
        chapter,
        verse,
        display: `${book.name} ${chapter}${verse ? `:${verse}` : ''}`,
        isExplicit: true
      };
    }
  }

  // If a verse was simply typed manually in text (not referenced via the tool),
  // there is no need for its contents to show.
  return null;
}
