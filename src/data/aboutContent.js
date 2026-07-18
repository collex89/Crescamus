// About page copy — kept separate from App.jsx the same way legalContent.js
// and dailyVerses.js are, so the actual words can be edited without touching
// component logic.

export const MISSION = `Crescamus takes its name from the Latin "let us grow" — this app exists to help you grow in faith through Scripture, prayer, the lives of the saints, and a community walking the same path.`;

// icon refers to a key in the Icons object in App.jsx.
export const ABOUT_FEATURES = [
  {
    icon: 'Bible',
    title: 'Bible',
    description: 'The full Catholic Bible — Old and New Testament, including the Deuterocanonical books — organized and ready to read.'
  },
  {
    icon: 'Rosary',
    title: 'Prayers',
    description: 'Track a daily prayer streak, set reminders for the Rosary, the Angelus, and more, and keep personal prayer intentions.'
  },
  {
    icon: 'Sparkles',
    title: 'Saints',
    description: 'Explore the life stories, feast days, and quotes of the saints.'
  },
  {
    icon: 'Audio',
    title: 'Audio',
    description: 'Gregorian chants, hymns, the Rosary, and Scripture readings — every track real and properly licensed, never a placeholder.'
  },
  {
    icon: 'Users',
    title: 'Community',
    description: 'Share reflections, follow others, and message people in a faith-centered feed.'
  }
];

export const CONTENT_SOURCING_NOTE = `Scripture, saint biographies, and audio are drawn from public-domain and Creative Commons-licensed sources (Wikipedia/Wikimedia Commons, LibriVox, Internet Archive), with attribution shown in the app where it applies.`;
