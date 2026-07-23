// Downloads real, license-verified chant recordings (mp3 transcodes from
// Wikimedia Commons, small files) and self-hosts them in public/audio/.
// Rosary and long-form Scripture readings are NOT downloaded — those files
// are 15-60MB each (LibriVox/archive.org), too large to bundle; the app
// streams them directly from Archive.org instead (CORS-open, range-request
// capable, built for exactly this).

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'audio');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const CHANTS = [
  {
    id: 'chant_salve',
    origUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Petits_Chanteurs_de_Passy_-_Salve_Regina_de_Hermann_Contract.ogg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Petits_Chanteurs_de_Passy_-_Salve_Regina_de_Hermann_Contract.ogg',
    license: 'CC BY-SA 3.0', artist: 'Les Petits Chanteurs de Passy'
  },
  {
    id: 'chant_avemaria',
    origUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Schola_Gregoriana-Ave_Maria.ogg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Schola_Gregoriana-Ave_Maria.ogg',
    license: 'CC BY-SA 3.0', artist: 'Schola Gregoriana'
  },
  {
    id: 'chant_venicreator',
    origUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/01/Veni.creator.spiritus.ogg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Veni.creator.spiritus.ogg',
    license: 'Public domain', artist: 'Membeth'
  },
  {
    id: 'hymn_almaredemptoris',
    origUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/90/Alma_Redemptoris_Mater.ogg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Alma_Redemptoris_Mater.ogg',
    license: 'CC BY-SA 3.0', artist: 'Rick Dechance'
  },
  {
    id: 'hymn_tantumergo',
    origUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Tantum_Ergo_I_Gregorian.ogg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tantum_Ergo_I_Gregorian.ogg',
    license: 'CC BY-SA 3.0', artist: 'Gareth Hughes'
  },
  {
    id: 'chant_paternoster',
    origUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/af/Schola_Gregoriana-Pater_Noster.ogg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Schola_Gregoriana-Pater_Noster.ogg',
    license: 'CC BY-SA 3.0', artist: 'Schola Gregoriana'
  },
  {
    id: 'chant_kyrie',
    origUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/73/Schola_Gregoriana-Kyrie_eleison.ogg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Schola_Gregoriana-Kyrie_eleison.ogg',
    license: 'CC BY-SA 3.0', artist: 'Schola Gregoriana'
  }
];

function transcodedMp3Url(origUrl) {
  const parts = origUrl.split('/wikipedia/commons/');
  const rel = parts[1]; // e.g. "4/46/Filename.ogg"
  const filename = rel.split('/').pop();
  return `https://upload.wikimedia.org/wikipedia/commons/transcoded/${rel}/${filename}.mp3`;
}

const results = [];
for (const chant of CHANTS) {
  const mp3Url = transcodedMp3Url(chant.origUrl);
  try {
    const res = await fetch(mp3Url, { headers: { 'User-Agent': 'Crescamus-App/1.0 (audio download script)' } });
    if (!res.ok) throw new Error(`${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(path.join(OUT_DIR, `${chant.id}.mp3`), buf);
    console.log(`✓ ${chant.id.padEnd(18)} ${(buf.length / 1024 / 1024).toFixed(1)}MB`);
    results.push({ ...chant, localPath: `/audio/${chant.id}.mp3`, sizeBytes: buf.length });
  } catch (err) {
    console.log(`✗ ${chant.id.padEnd(18)} ERROR: ${err.message}`);
    results.push({ ...chant, localPath: null });
  }
  await new Promise(r => setTimeout(r, 5000));
}

writeFileSync(path.join(__dirname, 'audio-manifest.json'), JSON.stringify(results, null, 2));
console.log('\nWrote scripts/audio-manifest.json');
