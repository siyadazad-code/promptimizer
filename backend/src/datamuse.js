/**
 * datamuse.js
 * -----------
 * Thin client for the Datamuse API (https://api.datamuse.com).
 *
 * Why Datamuse?
 *  - Completely free, requires NO API key and NO authentication.
 *  - `rel_syn=` returns curated synonyms; `md=p` attaches part-of-speech tags.
 *  - `sp=` (spelled-like) lets us look up the part of speech of the source word.
 *
 * All lookups are cached in memory so a repeated word never hits the network
 * twice for the lifetime of the process. If the API is unreachable we fail
 * gracefully: the caller is told the lookup failed and keeps the original word.
 */

const API_BASE = 'https://api.datamuse.com/words';
const REQUEST_TIMEOUT_MS = 4000;

// In-memory caches. Keyed by the lowercased word.
// synonymCache: word -> { synonyms: [{word, pos:Set}], failed: boolean }
// posCache:     word -> Set<string>  (part-of-speech tags of the source word)
const synonymCache = new Map();
const posCache = new Map();

// Datamuse `md=p` part-of-speech codes we treat as meaningful.
const POS_CODES = new Set(['n', 'v', 'adj', 'adv', 'u', 'pron']);

/** Fetch a URL as JSON with a hard timeout. Throws on network/HTTP failure. */
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Datamuse responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Extract the part-of-speech tags from a Datamuse result's `tags` array. */
function extractPos(tags) {
  const pos = new Set();
  for (const tag of tags || []) {
    if (POS_CODES.has(tag)) pos.add(tag);
  }
  return pos;
}

/**
 * Look up the part(s) of speech of a single word.
 * Returns a Set (possibly empty). Cached. Never throws — on failure returns
 * an empty Set so the optimizer can still proceed.
 */
async function lookupPartOfSpeech(word) {
  if (posCache.has(word)) return posCache.get(word);
  try {
    const url = `${API_BASE}?sp=${encodeURIComponent(word)}&md=p&max=1`;
    const data = await fetchJson(url);
    const match = data.find((d) => d.word?.toLowerCase() === word);
    const pos = match ? extractPos(match.tags) : new Set();
    posCache.set(word, pos);
    return pos;
  } catch {
    // Don't cache failures for POS — a later retry may succeed.
    return new Set();
  }
}

/**
 * Fetch synonyms for `word`.
 * Returns { synonyms: [{ word, pos:Set }], failed: boolean }.
 *  - `failed` is true only when the network call itself failed.
 *  - Successful-but-empty results are cached so we don't re-query dead ends.
 */
export async function getSynonyms(word) {
  const key = word.toLowerCase();
  const cached = synonymCache.get(key);
  if (cached) return cached;

  try {
    const url = `${API_BASE}?rel_syn=${encodeURIComponent(key)}&md=p&max=25`;
    const data = await fetchJson(url);
    const synonyms = data.map((d) => ({
      word: d.word,
      pos: extractPos(d.tags),
    }));
    const result = { synonyms, failed: false };
    synonymCache.set(key, result);
    return result;
  } catch {
    // Network/timeout failure — flag it but DON'T cache, so a later
    // request for the same word can retry once the API is reachable again.
    return { synonyms: [], failed: true };
  }
}

export { lookupPartOfSpeech };

/** Exposed for diagnostics / the /api/health endpoint. */
export function cacheStats() {
  return { synonymEntries: synonymCache.size, posEntries: posCache.size };
}
