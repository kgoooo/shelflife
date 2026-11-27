// Preset vocabularies for tagging books. Add your own in the app; these are just the starting set.

export const STATUSES = [
  { id: 'reading', label: 'Reading' },
  { id: 'tbr', label: 'To read' },
  { id: 'read', label: 'Read' },
  { id: 'dnf', label: 'DNF' },
  { id: 'upcoming', label: 'Upcoming' },
];

export const SPICE = [
  { level: 0, label: 'Sweet', blurb: 'Closed door, no on-page heat' },
  { level: 1, label: 'Mild', blurb: 'Kissing, some tension' },
  { level: 2, label: 'Warm', blurb: 'Fade to black or brief scenes' },
  { level: 3, label: 'Steamy', blurb: 'Open door, a few scenes' },
  { level: 4, label: 'Hot', blurb: 'Explicit and frequent' },
  { level: 5, label: 'Scorching', blurb: 'Very explicit, kink' },
];

export const TROPE_GROUPS = {
  'Relationship': [
    'Enemies to lovers', 'Friends to lovers', 'Rivals to lovers', 'Second chance', 'Fake dating',
    'Marriage of convenience', 'Arranged marriage', 'Forbidden love', 'Age gap', 'Love triangle',
    'Instalove', 'Slow burn', 'Mutual pining', 'Opposites attract', 'Grumpy / sunshine',
    'Forced proximity', 'Only one bed', 'Brother\'s best friend', 'Best friend\'s sibling',
    'Boss / employee', 'Workplace romance', 'Academic rivals', 'Pen pals', 'Single parent',
    'Secret baby', 'Why choose', 'Fated mates',
  ],
  'Characters': [
    'Morally grey', 'Touch her and die', 'He falls first', 'Who did this to you', 'Cinnamon roll hero',
    'Possessive hero', 'Bodyguard', 'Billionaire', 'Royalty', 'Celebrity', 'Athlete', 'Found family',
    'Secret identity', 'Villain gets the girl', 'Strong heroine',
  ],
  'Setting & genre': [
    'Small town', 'Sports romance', 'Hockey romance', 'Holiday romance', 'Road trip', 'Romcom',
    'Dark romance', 'Mafia', 'Romantasy', 'Fae', 'Vampires', 'Shifters', 'Paranormal', 'Sci-fi romance',
    'Historical', 'Regency', 'Contemporary', 'College', 'Queer romance',
  ],
  'Structure': [
    'Dual POV', 'Single POV', 'First person', 'Third person', 'HEA', 'HFN', 'Cliffhanger',
    'Standalone', 'Series', 'Hurt / comfort', 'Revenge', 'Amnesia',
  ],
};
export const TROPES = Object.values(TROPE_GROUPS).flat();

export const WARNINGS = [
  'Sexual content', 'Death of a loved one', 'Grief', 'Cheating', 'Sexual assault', 'Dubious consent',
  'Domestic abuse', 'Toxic relationship', 'Child abuse', 'Parental neglect', 'Violence', 'Gore', 'Blood',
  'Murder', 'Torture', 'Kidnapping', 'Stalking', 'Self-harm', 'Suicide', 'Suicidal ideation',
  'Eating disorder', 'Addiction', 'Alcoholism', 'Drug use', 'Mental illness', 'PTSD', 'Panic attacks',
  'Pregnancy loss', 'Infertility', 'Terminal illness', 'Cancer', 'Medical trauma', 'Car accident',
  'Animal death', 'Bullying', 'Homophobia', 'Racism', 'Misogyny', 'War', 'Gun violence',
];

// 1 = minor, 2 = moderate, 3 = graphic
export const SEVERITY = ['', 'minor', 'moderate', 'graphic'];

export const MOODS = [
  'Romantic', 'Steamy', 'Emotional', 'Angsty', 'Funny', 'Lighthearted', 'Cozy', 'Hopeful', 'Dark',
  'Tense', 'Sad', 'Mysterious', 'Adventurous', 'Reflective', 'Inspiring', 'Challenging', 'Relaxing',
];

export const PACES = ['Slow', 'Medium', 'Fast'];

export const FORMATS = ['Print', 'Ebook', 'Audiobook', 'Kindle Unlimited', 'Library'];

// Open Library subject slugs to try when building suggestions for a trope or mood.
export const TROPE_SUBJECTS = {
  'Enemies to lovers': 'enemies_to_lovers',
  'Friends to lovers': 'friends_to_lovers',
  'Second chance': 'second_chance_romance',
  'Fake dating': 'fake_relationship',
  'Marriage of convenience': 'marriage_of_convenience',
  'Arranged marriage': 'arranged_marriage',
  'Small town': 'small_town_romance',
  'Sports romance': 'sports_romance',
  'Hockey romance': 'hockey_stories',
  'Holiday romance': 'christmas_stories',
  'Romcom': 'romantic_comedy',
  'Dark romance': 'dark_romance',
  'Mafia': 'mafia',
  'Romantasy': 'fantasy_romance',
  'Fae': 'fairies',
  'Vampires': 'vampires',
  'Shifters': 'shapeshifting',
  'Paranormal': 'paranormal_romance_stories',
  'Sci-fi romance': 'science_fiction_romance',
  'Historical': 'historical_romance',
  'Regency': 'regency_romance',
  'Contemporary': 'contemporary_romance',
  'Royalty': 'princes',
  'Billionaire': 'billionaires',
  'Queer romance': 'lgbtq_romance',
  'College': 'college_students',
  'Workplace romance': 'office_romance',
  'Single parent': 'single_parents',
  'Age gap': 'age_difference',
  'Love triangle': 'love_triangles',
  'Found family': 'found_family',
};

// Muted palette used for generated covers when a book has no image.
export const COVER_TONES = [
  ['#3a3532', '#6e5a55'], ['#2f3430', '#5c6b5a'], ['#34302a', '#7a6a4e'], ['#302d35', '#625670'],
  ['#2b2f33', '#56616b'], ['#3b3030', '#7d5b58'], ['#2d302d', '#4f5f52'], ['#353029', '#6b5d48'],
];

// Genres outside romance, for Discover. `match` recognises the genre in a book's genre labels;
// `subjects` are Open Library subject names used to find popular books in it.
export const GENRES = {
  'Thriller': { match: /thriller|suspense/i, subjects: ['thrillers', 'psychological thrillers', 'suspense'], mood: ['Tense'] },
  'Mystery': { match: /mystery|mysteries|detective|crime fiction|whodunit/i, subjects: ['mystery', 'detective and mystery stories', 'crime fiction'], mood: ['Mysterious'] },
  'Fantasy': { match: /(^|[^-])\bfantasy\b/i, subjects: ['epic fantasy', 'fantasy fiction', 'high fantasy', 'dark fantasy'], mood: ['Adventurous'] },
  'Science fiction': { match: /science fiction|\bsci-fi\b(?! & fantasy)|dystopia|space opera/i, subjects: ['science fiction', 'dystopias'], mood: ['Adventurous', 'Challenging'] },
  'Horror': { match: /horror|ghost stories|gothic/i, subjects: ['horror', 'horror fiction', 'horror tales'], mood: ['Dark'] },
  'Historical fiction': { match: /historical fiction|historical novel/i, subjects: ['historical fiction'], mood: ['Emotional', 'Reflective'] },
  'Literary fiction': { match: /literary fiction|literary/i, subjects: ['literary fiction', 'psychological fiction'], mood: ['Reflective'] },
  'Contemporary fiction': { match: /women'?s fiction|domestic fiction|contemporary fiction|family life/i, subjects: ["women's fiction", 'domestic fiction', 'family life'], mood: ['Emotional'] },
  'Young adult': { match: /young adult|juvenile fiction|\bteens?\b/i, subjects: ['young adult fiction'], mood: ['Adventurous'] },
  'Memoir': { match: /memoir|biography|autobiography/i, subjects: ['biography', 'autobiography', 'memoirs'], mood: ['Reflective', 'Inspiring'] },
};

// Which non-romance genres a book belongs to, from its genre labels.
export function genresOf(book) {
  const labels = (book.subjects || []).join(' · ').replace(/sci-fi (&|and) fantasy/gi, '');
  return Object.entries(GENRES).filter(([, g]) => g.match.test(labels)).map(([name]) => name);
}

// Subjects that mark a book as romance-led.
export const ROMANCE_SUBJECTS = /romance|love stories|romantasy|erotic|erotica|lovers/i;

// Genres for the "What should I read next?" picker: the genres above plus Romance and Romantasy.
export function readingGenres(book) {
  const list = genresOf(book);
  const labels = (book.subjects || []).join(' ');
  const romance = book.tropes.length > 0 || ROMANCE_SUBJECTS.test(labels);
  if (romance) {
    list.push('Romance');
    if (book.tropes.includes('Romantasy') || list.includes('Fantasy') || /romantasy|fantasy romance/i.test(labels)) list.push('Romantasy');
  }
  return [...new Set(list)];
}
export const PICKER_GENRE_ORDER = ['Romance', 'Romantasy', ...Object.keys(GENRES)];
