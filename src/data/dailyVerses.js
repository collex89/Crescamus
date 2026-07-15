// Daily verse rotation. One verse per calendar day, same verse everywhere in
// the app (pinned card, story overlay, saved image). Text is word-for-word
// from the app's own Douay-Rheims data (src/data/bible/), so the verse always
// matches what the reader shows. References use Douay-Rheims naming/numbering.
export const DAILY_VERSES = [
  { book: 'phi', chapter: 4, verse: 13, ref: 'Philippians 4:13', text: 'I can do all things in him who strengtheneth me.' },
  { book: 'mat', chapter: 18, verse: 20, ref: 'Matthew 18:20', text: 'For where there are two or three gathered together in my name, there am I in the midst of them.' },
  { book: 'joh', chapter: 3, verse: 16, ref: 'John 3:16', text: 'For God so loved the world, as to give his only begotten Son: that whosoever believeth in him may not perish, but may have life everlasting.' },
  { book: 'jos', chapter: 1, verse: 9, ref: 'Josue 1:9', text: 'Behold I command thee, take courage, and be strong. Fear not, and be not dismayed: because the Lord thy God is with thee in all things whatsoever thou shalt go to.' },
  { book: 'isa', chapter: 41, verse: 10, ref: 'Isaias 41:10', text: 'Fear not, for I am with thee: turn not aside, for I am thy God: I have strengthened thee, and have helped thee, and the right hand of my just one hath upheld thee.' },
  { book: 'rom', chapter: 8, verse: 28, ref: 'Romans 8:28', text: 'And we know that to them that love God all things work together unto good: to such as, according to his purpose, are called to be saints.' },
  { book: 'pro', chapter: 3, verse: 5, ref: 'Proverbs 3:5', text: 'Have confidence in the Lord with all thy heart, and lean not upon thy own prudence.' },
  { book: 'mat', chapter: 11, verse: 28, ref: 'Matthew 11:28', text: 'Come to me all you that labor and are burdened, and I will refresh you.' },
  { book: 'psa', chapter: 22, verse: 1, ref: 'Psalm 22:1', text: 'The Lord ruleth me: and I shall want nothing.' },
  { book: 'joh', chapter: 14, verse: 6, ref: 'John 14:6', text: 'Jesus saith to him: I am the way, and the truth, and the life. No man cometh to the Father, but by me.' },
  { book: 'heb', chapter: 11, verse: 1, ref: 'Hebrews 11:1', text: 'Now, faith is the substance of things to be hoped for, the evidence of things that appear not.' },
  { book: 'phi', chapter: 4, verse: 6, ref: 'Philippians 4:6', text: 'Be nothing solicitous: but in every thing, by prayer and supplication, with thanksgiving, let your petitions be made known to God.' },
  { book: 'psa', chapter: 26, verse: 1, ref: 'Psalm 26:1', text: 'The Lord is my light and my salvation, whom shall I fear? The Lord is the protector of my life: of whom shall I be afraid?' },
  { book: 'mat', chapter: 5, verse: 16, ref: 'Matthew 5:16', text: 'So let your light shine before men, that they may see your good works, and glorify your Father who is in heaven.' },
  { book: 'rom', chapter: 12, verse: 12, ref: 'Romans 12:12', text: 'Rejoicing in hope. Patient in tribulation. Instant in prayer.' },
  { book: '1pet', chapter: 5, verse: 7, ref: '1 Peter 5:7', text: 'Casting all your care upon him, for he hath care of you.' },
  { book: 'eph', chapter: 2, verse: 8, ref: 'Ephesians 2:8', text: 'For by grace you are saved through faith: and that not of yourselves, for it is the gift of God.' },
  { book: 'col', chapter: 3, verse: 15, ref: 'Colossians 3:15', text: 'And let the peace of Christ rejoice in your hearts, wherein also you are called in one body: and be ye thankful.' },
  { book: 'jam', chapter: 1, verse: 5, ref: 'James 1:5', text: 'But if any of you want wisdom, let him ask of God who giveth to all men abundantly and upbraideth not. And it shall be given him.' },
  { book: 'psa', chapter: 45, verse: 11, ref: 'Psalm 45:11', text: 'Be still and see that I am God; I will be exalted among the nations, and I will be exalted in the earth.' },
  { book: 'isa', chapter: 40, verse: 31, ref: 'Isaias 40:31', text: 'But they that hope in the Lord shall renew their strength, they shall take wings as eagles, they shall run and not be weary, they shall walk and not faint.' },
  { book: 'mat', chapter: 6, verse: 33, ref: 'Matthew 6:33', text: 'Seek ye therefore first the kingdom of God, and his justice, and all these things shall be added unto you.' },
  { book: 'joh', chapter: 8, verse: 12, ref: 'John 8:12', text: 'I am the light of the world. He that followeth me walketh not in darkness, but shall have the light of life.' },
  { book: 'rom', chapter: 15, verse: 13, ref: 'Romans 15:13', text: 'Now the God of hope fill you with all joy and peace in believing: that you may abound in hope and in the power of the Holy Ghost.' },
  { book: '2cor', chapter: 5, verse: 7, ref: '2 Corinthians 5:7', text: 'For we walk by faith and not by sight.' },
  { book: 'psa', chapter: 117, verse: 24, ref: 'Psalm 117:24', text: 'This is the day which the Lord hath made: let us be glad and rejoice therein.' },
  { book: 'mic', chapter: 6, verse: 8, ref: 'Micheas 6:8', text: 'I will shew thee, O man, what is good, and what the Lord requireth of thee: Verily to do judgment, and to love mercy, and to walk solicitous with thy God.' },
  { book: '1joh', chapter: 4, verse: 19, ref: '1 John 4:19', text: 'Let us therefore love God: because God first hath loved us.' }
];

// Same verse for everyone on a given calendar day; rotates automatically.
export function getDailyVerse(date = new Date()) {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - startOfYear) / 86400000);
  return DAILY_VERSES[dayOfYear % DAILY_VERSES.length];
}
