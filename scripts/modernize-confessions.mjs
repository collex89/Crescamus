// One-time migration: modernizes Confessions' "Thou/Thee/Thy/Thine/Ye" address
// to God (and its matching archaic verb conjugations -- "resistest",
// "createdst", "loveth", "hath", etc.) into plain modern English, since
// Augustine wrote the whole book as a direct second-person prayer and the
// Pusey translation (1838, the only public-domain English edition -- see
// scripts/parse-catholic-books.mjs) renders that address in Early Modern
// English throughout. No modern-English public-domain translation exists to
// swap in instead (checked Gutenberg's other Confessions listings; all are
// the same Pusey text), so this rewrites the verb forms and pronouns in
// place rather than the underlying translation.
//
// VERB_MAP was built by hand from every unique word across all 13 chapters
// matching an archaic-suffix pattern (-est/-edst/-dst/-eth) or a closed set
// of irregulars (art, hast, doth, etc.) -- see the harvesting approach in
// this commit's description. Ordinary modern words that happen to share
// those endings (superlatives like "highest"/"dearest", nouns like
// "harvest"/"interest", conjunctions like "against"/"whilst") are
// deliberately left out of the map and pass through untouched.
//
// Run with: node scripts/modernize-confessions.mjs
// Writes:   src/data/books/confessions/<1-13>.json

import { readFileSync, writeFileSync } from 'fs';

const DIR = 'src/data/books/confessions';

// lowercase archaic form -> lowercase modern form. Case of the actual match
// (Title Case vs lowercase) is reapplied at replace time, never taken from
// here.
const VERB_MAP = {
  // Irregular auxiliaries / modals
  art: 'are', wast: 'were', wert: 'were',
  hast: 'have', hadst: 'had', hath: 'has',
  wilt: 'will', wouldst: 'would', wouldest: 'would',
  shalt: 'shall', shouldst: 'should', shouldest: 'should',
  dost: 'do', didst: 'did', diddest: 'did', doth: 'does',
  canst: 'can', couldst: 'could', couldest: 'could',
  mayst: 'may', mayest: 'may', mightst: 'might', mightest: 'might',
  durst: 'dared',

  // -est / -st present tense (2nd person singular)
  knowest: 'know', gavest: 'gave', saidst: 'said', sawest: 'saw',
  givest: 'give', commandest: 'command', seest: 'see', sayest: 'say',
  enjoinest: 'enjoin', fillest: 'fill', makest: 'make', heardest: 'heard',
  lovest: 'love', abidest: 'abide', knewest: 'knew', resistest: 'resist',
  teachest: 'teach', hearest: 'hear', dividest: 'divide', callest: 'call',
  workest: 'work', residest: 'reside', speakest: 'speak', forgivest: 'forgive',
  sentest: 'sent', standest: 'stand', rejoicest: 'rejoice', blessest: 'bless',
  pluckest: 'pluck', spokest: 'spoke', pleasest: 'please', containest: 'contain',
  changest: 'change', receivest: 'receive', remittest: 'remit', pitiest: 'pity',
  quickenest: 'quicken', cleansest: 'cleanse', carest: 'care',
  vouchsafest: 'vouchsafe', settest: 'set', feedest: 'feed', dwellest: 'dwell',
  answerest: 'answer', openest: 'open', preparest: 'prepare',
  awakest: 'awake', pourest: 'pour', upliftest: 'uplift', gatherest: 'gather',
  repentest: 'repent', grievest: 'grieve', findest: 'find', payest: 'pay',
  demandest: 'demand', threatenest: 'threaten', despisest: 'despise',
  distributest: 'distribute', livest: 'live', orderest: 'order',
  lashest: 'lash', roarest: 'roar', holdest: 'hold', drawest: 'draw',
  sittest: 'sit', lettest: 'let', formest: 'form', woundest: 'wound',
  killest: 'kill', avengest: 'avenge', loosest: 'loose', hidest: 'hide',
  renderest: 'render', curest: 'cure', followest: 'follow',
  oughtest: 'ought', cementest: 'cement', numberest: 'number',
  dissolvest: 'dissolve', forsakest: 'forsake', comfortest: 'comfort',
  beholdest: 'behold', regardest: 'regard', recallest: 'recall',
  guidest: 'guide', employest: 'employ', deliverest: 'deliver',
  placest: 'place', chastenest: 'chasten', departest: 'depart',
  sleepest: 'sleep', likest: 'like', thinkest: 'think', turnest: 'turn',
  sufferest: 'suffer', instillest: 'instill', shinest: 'shine',
  seekest: 'seek', remainest: 'remain', liftest: 'lift', burnest: 'burn',
  consumest: 'consume', ceasest: 'cease', keepest: 'keep',
  thunderest: 'thunder', blamest: 'blame', judgest: 'judge',
  condemnest: 'condemn', dispraisest: 'dispraise', admittest: 'admit',
  presidest: 'preside', precedest: 'precede', surpassest: 'surpass',
  raisest: 'raise', stirrest: 'stir', rulest: 'rule', createst: 'create',
  propoundest: 'propound', clearest: 'clear', discoverest: 'discover',
  inspirest: 'inspire', dispensest: 'dispense', spreadest: 'spread',
  restrainest: 'restrain', waterest: 'water', instructest: 'instruct',
  grantest: 'grant', meanest: 'mean', readest: 'read',
  strengthenest: 'strengthen', tellest: 'tell', willest: 'will', doest: 'do',
  possessest: 'possess', goest: 'go', provest: 'prove', sufficest: 'suffice',
  placedst: 'placed',
  containeth: 'contains', speaketh: 'speaks',

  // -edst / -dst past tense (2nd person singular)
  madest: 'made', createdst: 'created', willedst: 'willed', calledst: 'called',
  sufferedst: 'suffered', heldest: 'held', bestowedst: 'bestowed',
  taughtest: 'taught', showedst: 'showed', healedst: 'healed',
  sparedst: 'spared', deliveredst: 'delivered', formedst: 'formed',
  broughtest: 'brought', soughtest: 'sought', upheldest: 'upheld',
  sangest: 'sang', scourgedst: 'scourged', drewest: 'drew',
  despisedst: 'despised', comfortedst: 'comforted', caredst: 'cared',
  perceivedst: 'perceived', conveyedst: 'conveyed', tracedst: 'traced',
  tookest: 'took', resistedst: 'resisted', recoveredst: 'recovered',
  deridedst: 'derided', desiredst: 'desired', effectedst: 'effected',
  succouredst: 'succoured', preparedst: 'prepared', providedst: 'provided',
  humbledst: 'humbled', procuredst: 'procured', hiddest: 'hid',
  revealedst: 'revealed', liftedst: 'lifted', criedst: 'cried',
  soundedst: 'sounded', pressedst: 'pressed', convertedst: 'converted',
  enteredst: 'entered', tamedst: 'tamed', subduedst: 'subdued',
  enlargedst: 'enlarged', ornamentedst: 'ornamented',
  regeneratedst: 'regenerated', shoutedst: 'shouted', burstest: 'burst',
  flashedst: 'flashed', shonest: 'shone', scatteredst: 'scattered',
  breathedst: 'breathed', touchedst: 'touched', strengthenedst: 'strengthened',
  forbadest: 'forbade', diversifiedst: 'diversified', vouchsafedst: 'vouchsafed',
  forgottest: 'forgot', preventedst: 'prevented', urgedst: 'urged',
  blottedst: 'blotted', chastenedst: 'chastened', multipliedst: 'multiplied',
  subjoinedst: 'subjoined', raisedst: 'raised', compactedst: 'compacted',
  begannest: 'began', gatheredst: 'gathered', requitest: 'requite',
  thrustedst: 'thrust', likedst: 'liked', restest: 'rest', castest: 'cast',
  fittest: 'fit', realisest: 'realize',

  // -eth present tense (3rd person singular) -- kept consistent with the
  // 2nd-person forms above rather than left half-modernized
  knoweth: 'knows', willeth: 'wills', cometh: 'comes', rejoiceth: 'rejoices',
  teacheth: 'teaches', abideth: 'abides', confesseth: 'confesses',
  eateth: 'eats', liveth: 'lives', maketh: 'makes', judgeth: 'judges',
  loveth: 'loves', shineth: 'shines', remaineth: 'remains', asketh: 'asks',
  seeketh: 'seeks', thirsteth: 'thirsts', giveth: 'gives', becometh: 'becomes',
  findeth: 'finds', sufficeth: 'suffices', glorieth: 'glories', seeth: 'sees',
  appeareth: 'appears', receiveth: 'receives', forgetteth: 'forgets',
  belongeth: 'belongs', enlighteneth: 'enlightens', leaveth: 'leaves',
  existeth: 'exists', endureth: 'endures', lieth: 'lies', heareth: 'hears',
  commandeth: 'commands', approveth: 'approves', soundeth: 'sounds',
  tasteth: 'tastes', strengtheneth: 'strengthens', denieth: 'denies',
  remindeth: 'reminds', thinketh: 'thinks', dwelleth: 'dwells',
  goeth: 'goes', calleth: 'calls', standeth: 'stands', lighteth: 'lights',
  displeaseth: 'displeases', triumpheth: 'triumphs', lusteth: 'lusts',
  drinketh: 'drinks', intercedeth: 'intercedes', despiseth: 'despises',
  dieth: 'dies', sigheth: 'sighs', justifieth: 'justifies',
  believeth: 'believes', disapproveth: 'disapproves', smelleth: 'smells',
  perceiveth: 'perceives', resisteth: 'resists', creepeth: 'creeps',
  sitteth: 'sits', ariseth: 'arises', remembereth: 'remembers',
  singeth: 'sings', understandeth: 'understands', beholdeth: 'beholds',
  reacheth: 'reaches', feedeth: 'feeds', careth: 'cares', decayeth: 'decays',
  separateth: 'separates', discovereth: 'discovers', observeth: 'observes',
  harmoniseth: 'harmonises', perisheth: 'perishes', filleth: 'fills',
  loseth: 'loses', fleeth: 'flees', forsaketh: 'forsakes', healeth: 'heals',
  ceaseth: 'ceases', encompasseth: 'encompasses', possesseth: 'possesses',
  neglecteth: 'neglects', springeth: 'springs', killeth: 'kills',
  faileth: 'fails', hindereth: 'hinders', environeth: 'environs',
  reneweth: 'renews', presseth: 'presses', museth: 'muses', leadeth: 'leads',
  warreth: 'wars', bringeth: 'brings', forceth: 'forces', oppresseth: 'oppresses',
  blesseth: 'blesses', yieldeth: 'yields', openeth: 'opens', telleth: 'tells',
  talketh: 'talks', beareth: 'bears', disperseth: 'disperses',
  diminisheth: 'diminishes', clingeth: 'clings', divorceth: 'divorces',
  retaineth: 'retains', happeneth: 'happens', joineth: 'joins',
  commendeth: 'commends', saddeneth: 'saddens', seasoneth: 'seasons',
  consecrateth: 'consecrates', consisteth: 'consists', layeth: 'lays',
  useth: 'uses', praiseth: 'praises', exceedeth: 'exceeds', presideth: 'presides',
  beginneth: 'begins', gleameth: 'gleams', fluttereth: 'flutters',
  followeth: 'follows', uttereth: 'utters', answereth: 'answers',
  moveth: 'moves', enacteth: 'enacts', expecteth: 'expects',
  considereth: 'considers', continueth: 'continues', proceedeth: 'proceeds',
  knocketh: 'knocks', promiseth: 'promises', constituteth: 'constitutes',
  partaketh: 'partakes', contemplateth: 'contemplates', desireth: 'desires',
  reposeth: 'reposes', createth: 'creates', precedeth: 'precedes',
  gloweth: 'glows', cleaveth: 'cleaves', taketh: 'takes', doubteth: 'doubts',
  showeth: 'shows', riseth: 'rises', comprehendeth: 'comprehends',
  groaneth: 'groans', feareth: 'fears', relapseth: 'relapses',
  discerneth: 'discerns', seemeth: 'seems', worketh: 'works',
  proveth: 'proves', disalloweth: 'disallows', ruleth: 'rules',
  concludeth: 'concludes', thickeneth: 'thickens', needeth: 'needs',
  directeth: 'directs', weigheth: 'weighs', looketh: 'looks', lacketh: 'lacks',
  passeth: 'passes', willedst: 'willed',

  // Other archaic vocabulary, not part of the verb-conjugation system but
  // clearly tied to the same "old" register the request is about
  blest: 'blessed',
};

const PRONOUN_MAP = [
  [/\bthyself\b/g, 'yourself'],
  [/\bThyself\b/g, 'Yourself'],
  [/\bthou\b/g, 'you'],
  [/\bThou\b/g, 'You'],
  [/\bthee\b/g, 'you'],
  [/\bThee\b/g, 'You'],
  [/\bthy\b/g, 'your'],
  [/\bThy\b/g, 'Your'],
  [/\bye\b/g, 'you'],
  [/\bYe\b/g, 'You'],
  [/\bo'er\b/g, 'over'],
];

function applyCase(match, replacement) {
  if (match[0] === match[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function modernizeText(text) {
  let out = text;

  // Verb map first, while "Thou/Thee" (needed by a few disambiguation
  // heuristics below) are still in the text.
  for (const [archaic, modern] of Object.entries(VERB_MAP)) {
    // Case-insensitive: sentence-initial inverted questions ("Art Thou
    // weary?", "Hast Thou forgotten?", "Dost Thou...") capitalize the verb
    // itself, not just the following "Thou" -- applyCase restores it.
    const re = new RegExp(`\\b${archaic}\\b`, 'gi');
    out = out.replace(re, (m) => applyCase(m, modern));
  }

  // "thine": attributive ("Thine eyes" -> "Your eyes") vs standalone/
  // predicate ("a servant of Thine," / "Thine were these words" ->
  // "of yours," / "Yours were these words"). Checked every one of the 95
  // occurrences by hand against what actually follows "Thine" in the raw
  // text (not just the next word in isolation -- "sparedst not Thine Only
  // Son" is attributive despite the "not", since "Only Son" is the noun
  // being possessed; "who hath aught that is not Thine?" is predicate,
  // since nothing follows it there but punctuation).
  out = out.replace(/\b(Thine|thine)\s+own\b/g, (m, thine) => `${applyCase(thine, 'your')} own`);
  out = out.replace(/\b(Thine|thine)\b(?=[.,;:?)]|\s+\(?(?:were|is|was|it|who|in)\b)/g, (m) => applyCase(m, 'yours'));
  out = out.replace(/\b(Thine|thine)\b/g, (m) => applyCase(m, 'your'));

  for (const [re, replacement] of PRONOUN_MAP) {
    out = out.replace(re, replacement);
  }

  return out;
}

for (let i = 1; i <= 13; i++) {
  const filePath = `${DIR}/${i}.json`;
  const text = JSON.parse(readFileSync(filePath, 'utf8'));
  const modernized = modernizeText(text);
  writeFileSync(filePath, JSON.stringify(modernized));
  console.log(`✓ chapter ${i}: ${text.length} -> ${modernized.length} chars`);
}
console.log('\nDone.');
