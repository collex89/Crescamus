// Downloads a reasonably-sized (max 640px wide), already license-verified
// portrait for each saint (see scripts/saints-enriched.json) and saves it
// into public/saints/. Self-hosting instead of hotlinking Wikimedia's CDN:
// hotlinking full-resolution originals is slow and gets rate-limited (429s)
// under real usage — the same "download once, ship reliably" approach
// already used for the Bible text.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'saints');
const ENRICHED_PATH = path.join(__dirname, 'saints-enriched.json');

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const enriched = JSON.parse(readFileSync(ENRICHED_PATH, 'utf-8'));

async function fetchJSON(url, attempt = 1) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Crescamus-App/1.0 (image download script)' } });
  if (res.status === 429 && attempt <= 5) {
    const wait = attempt * 4000;
    console.log(`  (rate limited, waiting ${wait / 1000}s...)`);
    await new Promise(r => setTimeout(r, wait));
    return fetchJSON(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

const results = [];
for (const saint of enriched) {
  if (saint.localImage && existsSync(path.join(OUT_DIR, path.basename(saint.localImage)))) {
    console.log(`= ${saint.id}: already downloaded, skipping`);
    results.push(saint);
    continue;
  }
  if (!saint.ok || !saint.image || !saint.wikipediaTitle) {
    console.log(`- ${saint.id}: skipping (no verified image)`);
    results.push(saint);
    continue;
  }
  try {
    const encodedTitle = encodeURIComponent(saint.wikipediaTitle.replace(/ /g, '_'));
    const data = await fetchJSON(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodedTitle}&prop=pageimages&piprop=thumbnail&pithumbsize=640&format=json&origin=*`
    );
    const thumb = Object.values(data.query.pages)[0]?.thumbnail;
    if (!thumb) throw new Error('no thumbnail returned');

    const imgRes = await fetch(thumb.source, { headers: { 'User-Agent': 'Crescamus-App/1.0' } });
    if (!imgRes.ok) throw new Error(`image fetch ${imgRes.status}`);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const ext = path.extname(new URL(thumb.source).pathname) || '.jpg';
    const localPath = `saints/${saint.id}${ext}`;
    writeFileSync(path.join(OUT_DIR, `${saint.id}${ext}`), buf);

    console.log(`✓ ${saint.id.padEnd(14)} ${(buf.length / 1024).toFixed(0)}KB -> public/${localPath}`);
    results.push({ ...saint, localImage: `/${localPath}` });
  } catch (err) {
    console.log(`✗ ${saint.id.padEnd(14)} ERROR: ${err.message} (keeping remote URL as fallback)`);
    results.push(saint);
  }
  await new Promise(r => setTimeout(r, 1500));
}

writeFileSync(ENRICHED_PATH, JSON.stringify(results, null, 2));
console.log(`\nDone. Images saved to public/saints/, manifest updated.`);
