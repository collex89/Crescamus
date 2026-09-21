// Replaces each saint's bio in scripts/saints-enriched.json with a fuller
// extract from the same Wikipedia article -- feedback was that the
// lead-paragraph-only bios (from fetch-saints.mjs's exintro=1 call) read as
// too shallow for a mini-biography: no sense of what the person actually
// did or why the Church remembers them. This re-fetches the FULL article
// plaintext, keeps the intro plus whichever biographical sections exist
// (early life, ministry, works, legacy/veneration -- whatever a given
// article actually has, since saints' articles aren't uniformly
// structured), drops the reference-apparatus sections no reader wants
// (Notes, References, Bibliography, External links, See also, Gallery),
// and trims to a length that reads like a real mini-biography rather than
// a summary or a full article dump.
//
// Only touches `bio` -- image/localImage/imageLicense/sourceUrl/
// wikipediaTitle are left exactly as fetch-saints.mjs and
// download-saint-images.mjs already set them, so this never re-downloads
// or re-verifies an image.
//
// Run with: node scripts/deepen-saints-bios.mjs
// Then:     node scripts/merge-saints.mjs

import { readFileSync, writeFileSync } from 'fs';

const ENRICHED_PATH = 'scripts/saints-enriched.json';
const MAX_BIO_LENGTH = 5800;

const DROP_SECTIONS = new Set([
  'notes', 'references', 'bibliography', 'external links', 'see also',
  'gallery', 'further reading', 'citations', 'sources', 'footnotes',
  'in popular culture', 'media', 'works cited',
]);

async function fetchJSON(url, attempt = 1) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Crescamus-App/1.0 (bio depth enrichment, one-time batch run)' } });
  if (res.status === 429 && attempt <= 5) {
    const wait = attempt * 4000;
    console.log(`  (rate limited, waiting ${wait / 1000}s...)`);
    await new Promise((r) => setTimeout(r, wait));
    return fetchJSON(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

// Wikipedia's plaintext extract marks section headings as "\n\n== Heading ==\n\n"
// (more "="s for subheadings). Splits the full text into { heading, body }
// blocks, with the lead (untitled) section first.
function splitSections(fullText) {
  // Leading \n* (not \n+): when one heading has no body before its first
  // subheading ("== Recognition ==\n\n\n=== Canonization ==="), the first
  // match's trailing \n+ already consumes the newlines between them,
  // leaving none for the second match's leading boundary to eat.
  const parts = fullText.split(/\n*(={2,6})\s*([^=\n]+?)\s*\1\n+/g);
  // parts alternates: [lead, marker, heading, body, marker, heading, body, ...]
  const sections = [{ heading: null, body: parts[0].trim() }];
  for (let i = 1; i < parts.length; i += 3) {
    sections.push({ heading: parts[i + 1].trim(), body: (parts[i + 2] || '').trim() });
  }
  return sections;
}

// Headings signaling "what they did / why the Church remembers them" --
// guaranteed a slot when present, since these are exactly what the
// feedback asked for and a pure sequential take can starve them out on a
// long article (they tend to sit well after early-life sections).
const PRIORITY_KEYWORDS = /canoniz|beatif|recogni|legacy|venerat|patron|influenc|achievement|\bwork(s)?\b|ministry|ecclesiastical|later life|death|founding|founder|miracle|writing|teaching|doctor of the church|missio/i;

function truncateToFit(body, room) {
  if (body.length <= room) return body;
  const cut = body.slice(0, room);
  const lastBreak = Math.max(cut.lastIndexOf('\n\n'), cut.lastIndexOf('. '));
  return (lastBreak > room * 0.4 ? cut.slice(0, lastBreak + 1) : cut).trim();
}

function buildBio(fullText) {
  const sections = splitSections(fullText);
  const lead = sections[0];
  const rest = sections.slice(1).filter((s) => s.body && !(s.heading && DROP_SECTIONS.has(s.heading.toLowerCase())));

  let budget = MAX_BIO_LENGTH - lead.body.length;
  const selected = new Set();

  // Guaranteed: sections explicitly about canonization/legacy/veneration/etc.
  // -- but capped at roughly half the budget. A saint with an unusually
  // detailed canonization writeup (multiple matching sections) would
  // otherwise crowd out the actual life narrative entirely, which is just
  // as much what was asked for as the "why they stand out" material.
  const priorityFloor = budget - MAX_BIO_LENGTH * 0.5;
  for (const s of rest) {
    if (budget <= priorityFloor) break;
    if (!(s.heading && PRIORITY_KEYWORDS.test(s.heading))) continue;
    selected.add(s);
    budget -= s.body.length;
  }

  // Fill remaining budget alternating from the start (the biographical
  // narrative -- early life, formation, ministry) and the end (Wikipedia
  // convention tends to close a saint's article with veneration/impact
  // material even when it isn't titled anything our keyword list catches).
  // Reassembled in original document order below, so the result still
  // reads chronologically even though it was picked from both ends.
  const remaining = rest.filter((s) => !selected.has(s));
  let head = 0, tail = remaining.length - 1;
  while (head <= tail && budget > 0) {
    if (!selected.has(remaining[head])) { selected.add(remaining[head]); budget -= remaining[head].body.length; }
    head++;
    if (head > tail || budget <= 0) break;
    if (!selected.has(remaining[tail])) { selected.add(remaining[tail]); budget -= remaining[tail].body.length; }
    tail--;
  }

  const ordered = [lead, ...rest.filter((s) => selected.has(s))];
  const kept = [];
  let total = 0;
  for (const s of ordered) {
    const room = MAX_BIO_LENGTH - total;
    if (room <= 0) break;
    const body = truncateToFit(s.body, room);
    kept.push(body);
    total += body.length;
  }
  return kept.join('\n\n');
}

const enriched = JSON.parse(readFileSync(ENRICHED_PATH, 'utf-8'));
const results = [];

for (const saint of enriched) {
  if (!saint.ok || !saint.wikipediaTitle) {
    console.log(`- ${saint.id}: no wikipediaTitle, skipping`);
    results.push(saint);
    continue;
  }
  try {
    const encodedTitle = encodeURIComponent(saint.wikipediaTitle.replace(/ /g, '_'));
    const data = await fetchJSON(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&titles=${encodedTitle}&format=json&origin=*`
    );
    const page = Object.values(data.query.pages)[0];
    const fullText = page?.extract || '';
    if (!fullText) {
      console.log(`✗ ${saint.id}: no extract returned, keeping old bio`);
      results.push(saint);
      continue;
    }
    const newBio = buildBio(fullText);
    console.log(`✓ ${saint.id.padEnd(16)} bio: ${saint.bio.length} -> ${newBio.length} chars`);
    results.push({ ...saint, bio: newBio });
  } catch (err) {
    console.log(`✗ ${saint.id}: ERROR ${err.message}, keeping old bio`);
    results.push(saint);
  }
  await new Promise((r) => setTimeout(r, 1500));
}

writeFileSync(ENRICHED_PATH, JSON.stringify(results, null, 2));
console.log(`\nDone. Run node scripts/merge-saints.mjs next.`);
