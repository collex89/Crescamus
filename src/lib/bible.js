// Real Bible text: the public-domain Douay-Rheims (Challoner revision),
// parsed into one JSON file per book under src/data/bible/ (see
// scripts/parse-bible.mjs). Vite code-splits each book into its own chunk,
// so only the book currently being read is ever downloaded.
const bibleModules = import.meta.glob('../data/bible/*.json');

export async function loadBibleChapter(bookId, chapterNum) {
  const importer = bibleModules[`../data/bible/${bookId}.json`];
  if (!importer) return [];
  const mod = await importer();
  return mod.default[String(chapterNum)] || [];
}
