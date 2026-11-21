// Suggest tropes, moods, pace and content warnings from a book's description and genres.
// None of the book sources (Google, Apple, Open Library) list tropes or moods directly, so this
// looks for the phrases blurbs and genre labels tend to use. Suggestions are always shown as
// such on the book page so you can undo them; spice is never guessed.
import { WARNINGS } from './data.js';

const T = (pattern) => new RegExp(pattern, 'i');

const TROPE_RULES = {
  'Enemies to lovers': T(String.raw`enemies[\s-]+to[\s-]+lovers|sworn enem|mortal enem|\bnemesis\b|hate each other|hates? (him|her) with`),
  'Friends to lovers': T(String.raw`friends[\s-]+to[\s-]+lovers|more than friends|ruin (our|the) friendship`),
  'Rivals to lovers': T(String.raw`rivals[\s-]+to[\s-]+lovers|\b(bitter|fierce|longtime|business) rival`),
  'Second chance': T(String.raw`second[\s-]chance|\bex-(boyfriend|girlfriend|husband|wife|fianc)|first love|the one that got away`),
  'Fake dating': T(String.raw`fake (dating|relationship|boyfriend|girlfriend|fianc|engagement|date)|pretend(ing)? to (be|date) (his|her|a) |fake-dat`),
  'Marriage of convenience': T(String.raw`marriage of convenience|contract(ual)? marriage|marriage contract|marriage in name only|green card`),
  'Arranged marriage': T(String.raw`arranged marriage|betroth`),
  'Forbidden love': T(String.raw`forbidden (love|romance|attraction)|off[\s-]limits`),
  'Age gap': T(String.raw`age[\s-]gap|(\d+|twelve|fifteen|twenty) years (older|her senior)|older man`),
  'Love triangle': T(String.raw`love triangle|torn between (two|the)`),
  'Instalove': T(String.raw`insta[\s-]?love|love at first sight`),
  'Slow burn': T(String.raw`slow[\s-]burn`),
  'Mutual pining': T(String.raw`\bpining\b|unrequited`),
  'Opposites attract': T(String.raw`opposites attract`),
  'Grumpy / sunshine': T(String.raw`grump(y|iest)|sunshine`),
  'Forced proximity': T(String.raw`forced proximity|stuck (together|with (him|her))|stranded|snowed in|trapped (together|with)|share a (cabin|room|house|tent)|\broommates?\b`),
  'Only one bed': T(String.raw`only one bed|one bed\b`),
  "Brother's best friend": T(String.raw`(brother|brother)'?s best friend`),
  "Best friend's sibling": T(String.raw`best friend'?s (older |younger |little |big )?(brother|sister)`),
  'Boss / employee': T(String.raw`\b(my|her|his|new|grumpy) boss\b|assistant to the|nanny for`),
  'Workplace romance': T(String.raw`co-?worker|workplace|office romance|\bcolleague`),
  'Academic rivals': T(String.raw`academic rival|valedictorian`),
  'Pen pals': T(String.raw`pen[\s-]?pals?|anonymous (letters|messages|notes)`),
  'Single parent': T(String.raw`single (dad|mom|mum|mother|father|parent)|widowed (father|mother|dad|mom)`),
  'Secret baby': T(String.raw`secret baby|pregnant with (his|her ex)`),
  'Why choose': T(String.raw`why choose|reverse harem`),
  'Fated mates': T(String.raw`fated mates?|\b(true|destined) mate`),
  'Morally grey': T(String.raw`morally gr[ae]y|anti-?hero|\bvillain\b`),
  'Touch her and die': T(String.raw`touch her and die`),
  'He falls first': T(String.raw`he falls first`),
  'Who did this to you': T(String.raw`who did this to you`),
  'Bodyguard': T(String.raw`bodyguard|security detail`),
  'Billionaire': T(String.raw`billionaire`),
  'Royalty': T(String.raw`\bprince(ss)?\b|\broyal(ty)?\b|\bthrone\b|\bcrown prince`),
  'Celebrity': T(String.raw`rock ?star|movie star|pop star|\bcelebrity|hollywood`),
  'Athlete': T(String.raw`\bathlete|quarterback|\bnhl\b|\bnfl\b|pro (hockey|football|baseball|soccer) player`),
  'Found family': T(String.raw`found family|ragtag|band of misfits`),
  'Secret identity': T(String.raw`secret identity|in disguise|undercover`),
  'Villain gets the girl': T(String.raw`villain gets the girl`),
  'Small town': T(String.raw`small[\s-]town|tiny town|sleepy town|hometown`),
  'Sports romance': T(String.raw`(hockey|football|baseball|soccer|basketball|rugby|formula (1|one)|\bf1\b) (player|star|team|captain|season|romance)|sports romance`),
  'Hockey romance': T(String.raw`\bhockey\b|\bnhl\b`),
  'Holiday romance': T(String.raw`christmas|holiday romance|mistletoe|\bsanta\b|valentine'?s day`),
  'Romcom': T(String.raw`rom-?com|romantic comedy|laugh-out-loud`),
  'Dark romance': T(String.raw`dark romance|\bcaptive\b|kidnapp|obsession|obsessed with (her|him)`),
  'Mafia': T(String.raw`\bmafia\b|mob boss|bratva|\bcartel\b|crime family|made man|\bcapo\b|\bdon\b of`),
  'Romantasy': T(String.raw`romantasy|fantasy romance|romantic fantasy`),
  'Fae': T(String.raw`\bfae\b|faerie|\bfey\b|seelie|high lord|\bfairy (king|queen|prince|court)`),
  'Vampires': T(String.raw`vampire`),
  'Shifters': T(String.raw`shifter|werewol|wolf pack|\bpack alpha`),
  'Paranormal': T(String.raw`paranormal romance|paranormal fantasy`),
  'Sci-fi romance': T(String.raw`sci-?fi romance|science fiction romance|\balien (warrior|prince|romance)|starship`),
  'Historical': T(String.raw`historical (romance|fiction)|victorian|world war (i|ii|one|two)`),
  'Regency': T(String.raw`regency|\bthe ton\b|\bduke\b|\bearl\b|viscount|london season`),
  'College': T(String.raw`\bcollege\b|university|campus|sorority|fraternity|\bdorm\b`),
  'Queer romance': T(String.raw`\blgbt|\bgay\b|lesbian|sapphic|\bqueer\b|bisexual|\bm/m\b|\bf/f\b|mm romance`),
  'Dual POV': T(String.raw`dual (pov|point of view|perspective)|alternating (pov|points of view|perspectives)`),
  'HEA': T(String.raw`happily ever after|\bhea\b`),
  'Standalone': T(String.raw`stand-?alone`),
  'Revenge': T(String.raw`revenge|vengeance`),
  'Amnesia': T(String.raw`amnesia|lost (her|his) memor`),
};

// Mood: [pattern, weight]. Genre labels count as strongly as blurb wording.
const MOOD_RULES = {
  Romantic: T(String.raw`romance|romantic|love story|falling for|falls for`),
  Steamy: T(String.raw`steamy|spicy|sizzling|erotic|sensual|scorching|explicit`),
  Dark: T(String.raw`dark (romance|fantasy|academia)|horror|gothic|twisted|psychological|serial killer|sinister|deadly`),
  Tense: T(String.raw`thriller|suspense|heart-?pounding|edge of your seat|twist|danger|deadly`),
  Mysterious: T(String.raw`mystery|mysteries|whodunit|detective|secrets?\b|disappear`),
  Funny: T(String.raw`humou?r|comedy|rom-?com|hilarious|witty|laugh`),
  Lighthearted: T(String.raw`rom-?com|light-?hearted|feel-?good|charming|delightful`),
  Cozy: T(String.raw`\bcozy|\bcosy|small[\s-]town|bookshop|bookstore|bakery|cottage|christmas`),
  Emotional: T(String.raw`emotional|heartbreaking|heartwarming|tear-?jerker|moving|poignant`),
  Sad: T(String.raw`\bgrief|grieving|tragic|tragedy|\bloss of\b`),
  Hopeful: T(String.raw`\bhope|healing|uplifting|second chance`),
  Adventurous: T(String.raw`adventure|\bquest\b|epic fantasy|\bbattle|\bwar\b|kingdom|dragon`),
  Angsty: T(String.raw`\bangst|betray(al|ed)|torn apart|heartbreak`),
  Reflective: T(String.raw`literary fiction|introspective|reflective|meditation on`),
  Inspiring: T(String.raw`inspiring|inspirational`),
};

const FAST = T(String.raw`fast-?paced|page-?turner|unputdownable|breakneck|propulsive|can't put (it )?down|thriller`);
const SLOW = T(String.raw`slow-?paced|leisurely|meandering|sweeping saga`);

// Only explicit "Content warning(s): …" / "Trigger warnings: …" lines in the blurb are used.
const CW_LINE = /(content|trigger) (warning|note)s?\s*[:\-–]\s*([^\n]+)/i;
const WARNING_HINTS = {
  'Sexual content': /sex|explicit/i, 'Death of a loved one': /death of|loss of a (parent|child|loved)/i, Grief: /grief/i,
  Cheating: /cheat|infidel/i, 'Sexual assault': /sexual (assault|abuse)|rape/i, 'Dubious consent': /dub-?con|dubious consent/i,
  'Domestic abuse': /domestic (abuse|violence)/i, 'Child abuse': /child abuse/i, Violence: /violen/i, Gore: /gore/i, Blood: /blood/i,
  Murder: /murder/i, Torture: /tortur/i, Kidnapping: /kidnap|abduct/i, Stalking: /stalk/i, 'Self-harm': /self-?harm/i,
  Suicide: /suicid/i, 'Eating disorder': /eating disorder/i, Addiction: /addict/i, 'Drug use': /drug/i, Alcoholism: /alcohol/i,
  'Mental illness': /mental (illness|health)/i, PTSD: /ptsd/i, 'Pregnancy loss': /miscarriage|pregnancy loss/i,
  Cancer: /cancer/i, 'Animal death': /animal death|death of (a|an) (pet|dog|cat|animal)/i, War: /\bwar\b/i,
  'Gun violence': /gun/i, Bullying: /bully/i, 'Car accident': /car (accident|crash)/i,
};

export function suggestTags({ description = '', subjects = [] } = {}) {
  const genres = subjects.join(' · ');
  const text = `${description}\n${genres}`;

  const tropes = Object.entries(TROPE_RULES).filter(([, re]) => re.test(text)).map(([t]) => t);
  // Apple files most genre fiction under "Sci-Fi & Fantasy", so that label alone doesn't count.
  const realGenres = genres.replace(/sci-fi (&|and) fantasy/gi, '');
  const magic = /\b(magic|magical|dragons?|fae|faerie|kingdom|realm|sorcer|witch(es)?|demons?|gods?|curse)\b/i;
  // Reader-added genre tags can be noisy (a stalker thriller tagged "Fantasy"), so for thrillers,
  // horror and contemporary books the blurb itself has to mention something magical.
  const fantasyGenre = /fantasy/i.test(realGenres);
  const realistic = /thriller|horror|suspense|contemporary/i.test(realGenres);
  const isFantasy = (fantasyGenre && (!realistic || magic.test(description)))
    || (/\bfantasy\b/i.test(description) && magic.test(description));
  const isRomance = /romance/i.test(text);
  if (isFantasy && isRomance && !tropes.includes('Romantasy')) tropes.push('Romantasy');
  // Witches, ghosts and demons mean paranormal only in fantasy or paranormal books (not a thriller called "The Witch").
  if (!tropes.includes('Paranormal') && (isFantasy || /paranormal/i.test(realGenres)) && /\b(witch(es)?|ghosts?|demons?)\b/i.test(description)) tropes.push('Paranormal');
  if (tropes.includes('Hockey romance') && !tropes.includes('Sports romance')) tropes.push('Sports romance');

  // Moods: count matches across blurb and genres, keep the strongest few.
  const moods = Object.entries(MOOD_RULES)
    .map(([m, re]) => [m, (text.match(new RegExp(re.source, 'gi')) || []).length + (re.test(genres) ? 2 : 0)])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([m]) => m);

  const pace = FAST.test(text) ? 'Fast' : SLOW.test(text) ? 'Slow' : null;

  const warnings = {};
  const cw = description.match(CW_LINE);
  if (cw) {
    for (const [w, re] of Object.entries(WARNING_HINTS)) if (re.test(cw[3]) && WARNINGS.includes(w)) warnings[w] = 2;
  }

  return { tropes: tropes.slice(0, 10), moods, pace, warnings };
}

// Add suggestions to a book without overwriting anything you've already set.
// Returns the patch to save plus a record of what was added, so it can be undone.
export function applySuggestions(book, extra = {}) {
  const s = suggestTags({
    description: extra.description || book.description || '',
    subjects: [...(book.subjects || []), ...(extra.subjects || [])],
  });
  const added = {
    tropes: s.tropes.filter((t) => !book.tropes.includes(t)),
    moods: s.moods.filter((m) => !book.moods.includes(m)),
    pace: !book.pace && s.pace ? s.pace : null,
    warnings: Object.keys(s.warnings).filter((w) => !book.warnings[w]),
  };
  const count = added.tropes.length + added.moods.length + (added.pace ? 1 : 0) + added.warnings.length;
  if (!count) return null;
  return {
    patch: {
      tropes: [...book.tropes, ...added.tropes],
      moods: [...book.moods, ...added.moods],
      ...(added.pace ? { pace: added.pace } : {}),
      warnings: { ...book.warnings, ...Object.fromEntries(added.warnings.map((w) => [w, s.warnings[w]])) },
      suggested: added,
    },
    count,
  };
}

export function undoSuggestions(book) {
  const a = book.suggested;
  if (!a) return {};
  const warnings = { ...book.warnings };
  (a.warnings || []).forEach((w) => delete warnings[w]);
  return {
    tropes: book.tropes.filter((t) => !a.tropes.includes(t)),
    moods: book.moods.filter((m) => !a.moods.includes(m)),
    pace: a.pace && book.pace === a.pace ? null : book.pace,
    warnings,
    suggested: null,
  };
}
