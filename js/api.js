// Open Library: free, no API key. https://openlibrary.org/developers/api
const OL = 'https://openlibrary.org';

export const coverUrl = (coverId, size = 'M') =>
  coverId ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg` : null;

function fromSearchDoc(d) {
  return {
    olKey: d.key,
    title: d.title,
    authors: d.author_name || [],
    cover: coverUrl(d.cover_i),
    pages: d.number_of_pages_median || null,
    year: d.first_publish_year || null,
    subjects: (d.subject || []).slice(0, 25),
  };
}

export async function searchBooks(q, { limit = 20, signal } = {}) {
  const fields = 'key,title,author_name,cover_i,number_of_pages_median,first_publish_year,subject';
  const url = `${OL}/search.json?q=${encodeURIComponent(q)}&fields=${fields}&limit=${limit}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return (data.docs || []).map(fromSearchDoc);
}

const withTimeout = (ms) => AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;

// Subject feed first; if Open Library is slow or down, fall back to a subject search.
export async function bySubject(slug, { limit = 24 } = {}) {
  try {
    const res = await fetch(`${OL}/subjects/${encodeURIComponent(slug)}.json?limit=${limit}`, { signal: withTimeout(8000) });
    if (!res.ok) throw new Error('subject feed failed');
    const data = await res.json();
    if (!data.works?.length) throw new Error('empty');
    return data.works.map((w) => ({
      olKey: w.key,
      title: w.title,
      authors: (w.authors || []).map((a) => a.name),
      cover: coverUrl(w.cover_id),
      year: w.first_publish_year || null,
      subjects: (w.subject || []).slice(0, 25),
      pages: null,
    }));
  } catch {
    return searchBooks(`subject:"${slug.replace(/_/g, ' ')}"`, { limit, signal: withTimeout(15000) });
  }
}

export async function byAuthor(name, { limit = 12 } = {}) {
  return searchBooks(`author:"${name}"`, { limit });
}

export async function workDetails(olKey) {
  try {
    const res = await fetch(`${OL}${olKey}.json`);
    if (!res.ok) return {};
    const w = await res.json();
    const d = typeof w.description === 'string' ? w.description : w.description?.value || '';
    return {
      description: d.replace(/\(\[source\][^)]*\)/g, '').replace(/-{5,}[\s\S]*$/, '').trim(),
      subjects: (w.subjects || []).slice(0, 40),
    };
  } catch { return {}; }
}

export async function workRatings(olKey) {
  try {
    const res = await fetch(`${OL}${olKey}/ratings.json`);
    if (!res.ok) return null;
    const { summary } = await res.json();
    return summary?.count ? { average: summary.average, count: summary.count } : null;
  } catch { return null; }
}
