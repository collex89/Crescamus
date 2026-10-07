// Re-hosts the long-form tracks (Rosary, Scripture readings) and the one
// remaining archive.org hymn in public/audio/, transcoded for speech.
//
// download-audio.mjs originally left these on archive.org as "too large to
// bundle", streaming them from there instead. Measured, that's what made
// tapping them feel broken: archive.org redirects every request to a
// storage node and takes 4-13s before the first byte arrives, against
// ~0.4s for files on our own Vercel CDN. Re-encoding the spoken-word
// tracks to 48kbps mono (plenty for a single voice) brings them from
// 17-64MB down to 7-25MB, small enough to host ourselves.
//
// All sources are free to redistribute:
//   The Sound of the Rosary (Christian Peschken) -- CC0
//   Panis Angelicus (Franck)                     -- public domain
//   LibriVox Douay-Rheims readings               -- public domain (LibriVox policy)
//
// Needs ffmpeg: set FFMPEG=/path/to/ffmpeg, or have it on PATH.
// Run with: node scripts/rehost-long-audio.mjs
// Output:   public/audio/<id>.mp3, plus entries in scripts/audio-manifest.json

import { writeFileSync, readFileSync, mkdirSync, existsSync, statSync, unlinkSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'audio');
const MANIFEST_PATH = path.join(__dirname, 'audio-manifest.json');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const ROSARY = { sourceUrl: 'https://archive.org/details/TheSoundOfTheRosary', license: 'CC0 (Public domain)', artist: 'Christian Peschken' };
const LIBRIVOX = { sourceUrl: 'https://archive.org/details/bible_dra_complete_2401_librivox', license: 'Public domain (LibriVox)', artist: 'LibriVox volunteers' };

const TRACKS = [
  // transcode: true = re-encode for speech; false = already small, keep as-is
  { id: 'hymn_panisangelicus', origUrl: 'https://archive.org/download/CesarFranckPanisAngelicus/Franck-PanisAngelicus_64kb.mp3', sourceUrl: 'https://archive.org/details/CesarFranckPanisAngelicus', license: 'Public domain', artist: 'César Franck', transcode: false },
  { id: 'rosary_joyful', origUrl: 'https://archive.org/download/TheSoundOfTheRosary/JoyfulMysteries.mp3', ...ROSARY, transcode: true },
  { id: 'rosary_sorrowful', origUrl: 'https://archive.org/download/TheSoundOfTheRosary/SorrowfulMysteries.mp3', ...ROSARY, transcode: true },
  { id: 'rosary_glorious', origUrl: 'https://archive.org/download/TheSoundOfTheRosary/GloriousMysteries.mp3', ...ROSARY, transcode: true },
  { id: 'rosary_luminous', origUrl: 'https://archive.org/download/TheSoundOfTheRosary/LuminousMysteries.mp3', ...ROSARY, transcode: true },
  { id: 'reading_genesis', origUrl: 'https://archive.org/download/bible_dra_complete_2401_librivox/bible1899_001_dra.mp3', ...LIBRIVOX, transcode: true },
  { id: 'reading_john', origUrl: 'https://archive.org/download/bible_dra_complete_2401_librivox/bible1899_111_dra.mp3', ...LIBRIVOX, transcode: true },
  { id: 'reading_1john', origUrl: 'https://archive.org/download/bible_dra_complete_2401_librivox/bible1899_136_dra.mp3', ...LIBRIVOX, transcode: true },
];

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Crescamus-App/1.0 (audio rehost script)' } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

const manifest = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : [];

for (const t of TRACKS) {
  const outPath = path.join(OUT_DIR, `${t.id}.mp3`);
  const tmpPath = path.join(os.tmpdir(), `crescamus-${t.id}-src.mp3`);
  console.log(`- ${t.id}: downloading...`);
  await download(t.origUrl, tmpPath);
  if (t.transcode) {
    // CBR (not VBR) so browsers can seek accurately in a long file without
    // scanning it first; mono 48kbps is clear for a single speaking voice.
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', tmpPath, '-vn', '-map_metadata', '-1',
      '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '48k', outPath]);
  } else {
    writeFileSync(outPath, readFileSync(tmpPath));
  }
  unlinkSync(tmpPath);
  const sizeBytes = statSync(outPath).size;
  console.log(`  ✓ public/audio/${t.id}.mp3 (${(sizeBytes / 1048576).toFixed(1)}MB)`);

  const entry = { id: t.id, origUrl: t.origUrl, sourceUrl: t.sourceUrl, license: t.license, artist: t.artist, localPath: `/audio/${t.id}.mp3`, sizeBytes };
  const existing = manifest.findIndex((m) => m.id === t.id);
  if (existing === -1) manifest.push(entry);
  else manifest[existing] = entry;
}

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
console.log('\nDone. Point AUDIO_TRACKS urls at /audio/<id>.mp3.');
