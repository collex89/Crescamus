// Merges scripts/saints-enriched.json (real Wikipedia bios + license-checked
// images) into src/data/mockData.js's SAINTS array, keeping the existing
// hand-curated fields (category, feastDay, patronage, quote) and replacing
// only bio + image, while adding sourceUrl/imageLicense for attribution.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_DATA_PATH = path.join(__dirname, '..', 'src', 'data', 'mockData.js');
const ENRICHED_PATH = path.join(__dirname, 'saints-enriched.json');

const enriched = JSON.parse(readFileSync(ENRICHED_PATH, 'utf-8'));
const enrichedById = new Map(enriched.map(e => [e.id, e]));

// Hand-curated fields for saints being added fresh (not already in
// mockData.js) — Wikipedia gives us the bio/image, but category, feast day,
// patronage and a representative quote are curated here.
const NEW_SAINTS_METADATA = {
  josephcup: { name: 'St. Joseph of Cupertino', category: 'Confessors', feastDay: 'September 18', patronage: 'Aviators, Air Travelers, Students, Test-Takers', quote: 'Blessed be God in all his gifts, and holy in all his works.' },
  padrepio: { name: 'St. Padre Pio', category: 'Confessors', feastDay: 'September 23', patronage: 'Civil Defense Volunteers, Adolescents, Stress Relief', quote: 'Pray, hope, and don’t worry.' },
  teresacalcutta: { name: 'St. Teresa of Calcutta', category: 'Missionaries', feastDay: 'September 5', patronage: 'Missionaries of Charity, World Youth Day, the Sick and Suffering', quote: 'Not all of us can do great things. But we can do small things with great love.' },
  clare: { name: 'St. Clare of Assisi', category: 'Virgins', feastDay: 'August 11', patronage: 'Television, Eye Disease, Embroiderers', quote: 'Go forth in peace, for you have followed the good road. Go forth without fear, for he who created you has made you holy, has always protected you, and loves you as a mother.' },
  patrick: { name: 'St. Patrick', category: 'Missionaries', feastDay: 'March 17', patronage: 'Ireland, Engineers, Excluded People', quote: 'Christ with me, Christ before me, Christ behind me.' },
  monica: { name: 'St. Monica', category: 'Confessors', feastDay: 'August 27', patronage: 'Mothers, Married Women, Wayward Children', quote: 'Nothing is far from God.' },
  peter: { name: 'St. Peter', category: 'Apostles', feastDay: 'June 29', patronage: 'The Papacy, Fishermen, Locksmiths', quote: 'Lord, to whom shall we go? You have the words of eternal life.' },
  paul: { name: 'St. Paul', category: 'Apostles', feastDay: 'June 29', patronage: 'Missionaries, Evangelists, Writers', quote: 'I have fought the good fight, I have finished the race, I have kept the faith.' },
  anthonypadua: { name: 'St. Anthony of Padua', category: 'Doctors', feastDay: 'June 13', patronage: 'Lost Items, Travelers, the Poor', quote: 'Actions speak louder than words; let your words teach and your actions speak.' },
  bernadette: { name: 'St. Bernadette Soubirous', category: 'Virgins', feastDay: 'April 16', patronage: 'Illness, Lourdes, Shepherds', quote: 'I was not asked to make you believe. I was told to tell you.' },
  martindeporres: { name: 'St. Martin de Porres', category: 'Confessors', feastDay: 'November 3', patronage: 'Mixed-Race People, Barbers, Public Health Workers', quote: 'Compassion, my dear Brother, is preferable to cleanliness.' },
  judethaddeus: { name: 'St. Jude Thaddeus', category: 'Apostles', feastDay: 'October 28', patronage: 'Desperate Cases, Lost Causes', quote: 'Contend for the faith that was once for all delivered to the saints.' },
  rita: { name: 'St. Rita of Cascia', category: 'Confessors', feastDay: 'May 22', patronage: 'Impossible Causes, Abuse Victims, Difficult Marriages', quote: 'Suffering united to the love of God is progress on the road to heaven.' },
  christopher: { name: 'St. Christopher', category: 'Martyrs', feastDay: 'July 25', patronage: 'Travelers, Motorists, Athletes', quote: 'In carrying the Child, I found I carried the whole world.' },
  anne: { name: 'St. Anne', category: 'Confessors', feastDay: 'July 26', patronage: 'Mothers, Grandmothers, Housewives', quote: 'Blessed is the mother who raises her child in the fear of the Lord.' },
  johnbaptist: { name: 'St. John the Baptist', category: 'Martyrs', feastDay: 'June 24', patronage: 'Baptism, Lambs, Jordan River Region', quote: 'He must increase, but I must decrease.' }
};

const source = readFileSync(MOCK_DATA_PATH, 'utf-8');

// Pull out each saint object between "export const SAINTS = [" and the
// matching closing "];" using a straightforward brace-depth scan (the
// array is flat objects only, no nested arrays, so this is safe).
const startMarker = 'export const SAINTS = [';
const startIdx = source.indexOf(startMarker);
if (startIdx === -1) throw new Error('Could not find SAINTS array in mockData.js');
let depth = 0, i = startIdx + startMarker.length - 1, endIdx = -1;
for (; i < source.length; i++) {
  if (source[i] === '[') depth++;
  if (source[i] === ']') { depth--; if (depth === 0) { endIdx = i; break; } }
}
if (endIdx === -1) throw new Error('Could not find end of SAINTS array');

const beforeSaints = source.slice(0, startIdx);
const afterSaints = source.slice(endIdx + 1);

// eslint-disable-next-line no-eval -- trusted local build script, not user input
const currentSaints = eval(source.slice(startIdx + startMarker.length - 1, endIdx + 1));

const existingIds = new Set(currentSaints.map(s => s.id));

const updatedExisting = currentSaints.map(s => {
  const e = enrichedById.get(s.id);
  if (!e || !e.ok) {
    console.log(`! ${s.id}: no enriched data, keeping original`);
    return s;
  }
  return {
    ...s,
    bio: e.bio,
    image: e.localImage || e.image || s.image,
    sourceUrl: e.sourceUrl,
    imageLicense: e.image ? e.imageLicense : null
  };
});

const newSaints = Object.entries(NEW_SAINTS_METADATA)
  .filter(([id]) => !existingIds.has(id))
  .map(([id, meta]) => {
    const e = enrichedById.get(id);
    if (!e || !e.ok) {
      console.log(`! ${id}: no enriched data, skipping (not added)`);
      return null;
    }
    return {
      id,
      ...meta,
      bio: e.bio,
      image: e.localImage || e.image || null,
      sourceUrl: e.sourceUrl,
      imageLicense: e.image ? e.imageLicense : null
    };
  })
  .filter(Boolean);

const merged = [...updatedExisting, ...newSaints];

function jsStringLiteral(str) {
  return JSON.stringify(str);
}

function formatSaint(s) {
  const lines = [
    `  {`,
    `    id: ${jsStringLiteral(s.id)},`,
    `    name: ${jsStringLiteral(s.name)},`,
    `    category: ${jsStringLiteral(s.category)},`,
    `    feastDay: ${jsStringLiteral(s.feastDay)},`,
    `    patronage: ${jsStringLiteral(s.patronage)},`,
    `    quote: ${jsStringLiteral(s.quote)},`,
    `    bio: ${jsStringLiteral(s.bio)},`,
    `    image: ${jsStringLiteral(s.image)},`,
    `    sourceUrl: ${s.sourceUrl ? jsStringLiteral(s.sourceUrl) : 'null'},`,
    `    imageLicense: ${s.imageLicense ? jsStringLiteral(s.imageLicense) : 'null'}`,
    `  }`
  ];
  return lines.join('\n');
}

const newBlock = `export const SAINTS = [\n${merged.map(formatSaint).join(',\n')}\n]`;

writeFileSync(MOCK_DATA_PATH, beforeSaints + newBlock + afterSaints);
console.log(`\nMerged ${merged.length} saints into mockData.js`);
