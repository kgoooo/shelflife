// A made-up library so you can see the stats and suggestions before adding your own books.
import { newBook } from './store.js';

const Y = new Date().getFullYear();
const d = (m, day, y = Y) => `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const rows = [
  ['Thorn & Thistle', 'Mara Quill', 412, 'read', 4.5, 4, ['Enemies to lovers', 'Romantasy', 'Fae', 'Slow burn', 'Morally grey'], { 'Violence': 2, 'Sexual content': 3 }, ['Romantic', 'Dark', 'Adventurous'], 'Medium', d(1, 3), d(1, 19)],
  ['Off-Ice Rules', 'Jess Harlow', 336, 'read', 4, 3, ['Hockey romance', 'Fake dating', 'Grumpy / sunshine', 'Dual POV'], { 'Sexual content': 2 }, ['Funny', 'Romantic', 'Lighthearted'], 'Fast', d(1, 20), d(1, 28)],
  ['The Duke Who Didn\'t', 'Eleanor Vale', 368, 'read', 3.5, 2, ['Regency', 'Marriage of convenience', 'Slow burn'], { 'Grief': 1 }, ['Romantic', 'Cozy'], 'Slow', d(2, 1), d(2, 17)],
  ['Saltwater Season', 'Remy Okafor', 298, 'read', 4, 1, ['Small town', 'Second chance', 'Single parent'], { 'Death of a loved one': 2, 'Grief': 2 }, ['Emotional', 'Hopeful', 'Cozy'], 'Medium', d(2, 20), d(3, 2)],
  ['Crown of Ash', 'Mara Quill', 520, 'read', 5, 4, ['Romantasy', 'Enemies to lovers', 'Touch her and die', 'Found family', 'Cliffhanger'], { 'Violence': 3, 'Torture': 2, 'Sexual content': 3 }, ['Dark', 'Tense', 'Adventurous', 'Romantic'], 'Fast', d(3, 5), d(3, 21)],
  ['Desk Across', 'Priya Lund', 310, 'read', 3, 2, ['Workplace romance', 'Rivals to lovers', 'Romcom'], {}, ['Funny', 'Lighthearted'], 'Fast', d(3, 25), d(4, 2)],
  ['Velvet Contract', 'Sloane Mercer', 344, 'read', 4, 5, ['Billionaire', 'Possessive hero', 'Marriage of convenience', 'Dark romance'], { 'Sexual content': 3, 'Dubious consent': 1, 'Stalking': 1 }, ['Steamy', 'Dark', 'Tense'], 'Fast', d(4, 6), d(4, 12)],
  ['Letters to Nowhere', 'Hana Ito', 280, 'read', 4.5, 0, ['Pen pals', 'Friends to lovers', 'Mutual pining'], { 'Terminal illness': 2 }, ['Emotional', 'Reflective', 'Sad'], 'Slow', d(4, 15), d(5, 4)],
  ['Midnight Pack', 'Cass Rowan', 390, 'read', 3.5, 4, ['Shifters', 'Fated mates', 'Forced proximity'], { 'Violence': 2, 'Sexual content': 3 }, ['Steamy', 'Adventurous'], 'Fast', d(5, 10), d(5, 18)],
  ['Penalty Box', 'Jess Harlow', 322, 'read', 4.5, 3, ['Hockey romance', 'Brother\'s best friend', 'He falls first', 'Dual POV'], { 'Sexual content': 2, 'Panic attacks': 1 }, ['Funny', 'Romantic', 'Emotional'], 'Fast', d(6, 1), d(6, 7)],
  ['Wildflower Inn', 'Remy Okafor', 302, 'read', 3.5, 1, ['Small town', 'Opposites attract', 'Holiday romance'], {}, ['Cozy', 'Lighthearted', 'Hopeful'], 'Medium', d(6, 20), d(7, 1)],
  ['Blood Oath', 'Sloane Mercer', 410, 'read', 4, 5, ['Mafia', 'Arranged marriage', 'Morally grey', 'Touch her and die'], { 'Violence': 3, 'Murder': 2, 'Sexual content': 3, 'Gun violence': 2 }, ['Dark', 'Steamy', 'Tense'], 'Fast', d(7, 8), d(7, 15)],
  ['The Gilded Wager', 'Eleanor Vale', 356, 'dnf', 2, 2, ['Regency', 'Love triangle'], { 'Cheating': 2 }, ['Romantic'], 'Slow', d(8, 2), null],
  ['Court of Hollow Stars', 'Mara Quill', 588, 'read', 4.5, 3, ['Romantasy', 'Fae', 'Slow burn', 'Found family', 'Who did this to you'], { 'Violence': 2, 'Grief': 2 }, ['Adventurous', 'Romantic', 'Emotional'], 'Medium', d(8, 10), d(9, 3)],
  ['Rematch', 'Priya Lund', 300, 'read', 4, 3, ['Sports romance', 'Second chance', 'Grumpy / sunshine'], { 'Sexual content': 2 }, ['Romantic', 'Funny'], 'Fast', d(9, 12), d(9, 19)],
  ['Snowed In With You', 'Hana Ito', 260, 'read', 3.5, 2, ['Holiday romance', 'Only one bed', 'Forced proximity'], {}, ['Cozy', 'Lighthearted', 'Romantic'], 'Fast', d(10, 5), d(10, 9)],
  ['A Tide of Teeth', 'Cass Rowan', 444, 'reading', 0, 4, ['Romantasy', 'Enemies to lovers', 'Vampires'], { 'Gore': 2, 'Blood': 3 }, ['Dark', 'Tense'], null, d(11, 2), null, 268],
  ['Overtime', 'Jess Harlow', 330, 'reading', 0, 3, ['Hockey romance', 'Age gap', 'Single parent'], {}, ['Romantic'], null, d(11, 12), null, 84],
  ['Ember & Iron', 'Mara Quill', 496, 'tbr', 0, 4, ['Romantasy', 'Arranged marriage', 'Morally grey'], {}, ['Dark', 'Adventurous'], null, null, null],
  ['Second Draft', 'Priya Lund', 288, 'tbr', 0, 2, ['Second chance', 'Workplace romance', 'Romcom'], {}, ['Funny', 'Lighthearted'], null, null, null],
  ['The Quiet Year', 'Hana Ito', 240, 'tbr', 0, 0, ['Small town', 'Slow burn', 'Mutual pining'], { 'Grief': 1 }, ['Cozy', 'Reflective'], null, null, null],
  ['Kings of Ruin', 'Sloane Mercer', 402, 'tbr', 0, 5, ['Why choose', 'Dark romance', 'Mafia'], { 'Violence': 3, 'Sexual content': 3 }, ['Dark', 'Steamy'], null, null, null],
  ['Moonlit Marsh', 'Cass Rowan', 350, 'tbr', 0, 3, ['Shifters', 'Fated mates', 'Small town'], {}, ['Romantic', 'Cozy'], null, null, null],
  ['Fortune & Folly', 'Eleanor Vale', 330, 'tbr', 0, 1, ['Regency', 'Fake dating', 'Friends to lovers'], {}, ['Lighthearted', 'Romantic'], null, null, null],
];

export function sampleLibrary() {
  const books = rows.map(([title, author, pages, status, rating, spice, tropes, warnings, moods, pace, start, end, progress]) => newBook({
    title, authors: [author], pages, status, rating, spice, tropes, warnings, moods, pace,
    format: ['Ebook', 'Print', 'Kindle Unlimited', 'Audiobook'][title.length % 4],
    dateStarted: start, dateFinished: end,
    dateAdded: start || d(10, 20),
    progress: status === 'read' ? pages : progress || 0,
    description: 'Sample book: made up so you can explore the app.',
  }));
  return { goal: 30, books, customTropes: [], customWarnings: [] };
}
