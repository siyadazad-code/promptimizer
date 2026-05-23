/**
 * optimizer.js
 * ------------
 * Core logic: shorten a prompt while preserving its meaning, intent and logic.
 *
 * Two modes:
 *   - Safe (default): swap long words for shorter ones using the hand-curated
 *     dictionary in dictionary.js. Nothing is ever deleted.
 *   - Aggressive (opt-in): first run compress.js to rewrite wordy phrases and
 *     strip filler words, then apply the same safe synonym swaps on top.
 *
 * Pipeline:
 *   1. (Aggressive only) compress wordy phrases / filler, then fix sentence
 *      capitalization left lowercase by deletions.
 *   2. Tokenize into words, keeping everything else verbatim.
 *   3. Protect regions that must never change: [brackets], {braces}, fenced and
 *      inline code, URLs, numbers, and words shorter than MIN_WORD_LENGTH.
 *   4. Swap each remaining word for a safe, strictly shorter dictionary word.
 *   5. Re-apply the original word's capitalization to the substitute.
 *   6. Fix any "a"/"an" article left wrong by a substitution.
 *
 * This module makes NO network calls — it is fast, offline and deterministic.
 */

import { SYNONYMS } from './dictionary.js';
import { aggressiveCompress, recapitalize } from './compress.js';

export const DEFAULT_MIN_WORD_LENGTH = 6;

/** Size of the curated dictionary — reported by the /api/health endpoint. */
export function dictionaryStats() {
  return { entries: Object.keys(SYNONYMS).length };
}

/** Build a list of [start, end) character ranges that must be left untouched. */
function findProtectedRanges(text) {
  const ranges = [];
  const patterns = [
    /```[\s\S]*?```/g, // fenced code blocks
    /`[^`\n]*`/g, // inline code
    /\[[^\]]*\]/g, // [square brackets] — placeholders / variables
    /\{[^}]*\}/g, // {curly braces} — placeholders / variables
    /\b(?:https?:\/\/|www\.)[^\s)]+/gi, // URLs
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      ranges.push([m.index, m.index + m[0].length]);
      if (m[0].length === 0) re.lastIndex++; // guard against zero-width loops
    }
  }
  return ranges;
}

/** True if [start, end) overlaps any protected range. */
function isProtected(start, end, ranges) {
  return ranges.some(([rs, re]) => start < re && end > rs);
}

/**
 * Re-apply the casing pattern of `original` onto `replacement`.
 *  - ALL CAPS    -> REPLACEMENT
 *  - Capitalized -> Replacement
 *  - anything else -> replacement (left lowercase, as stored in the dictionary)
 */
function matchCase(original, replacement) {
  if (original === original.toUpperCase() && /[A-Z]/.test(original)) {
    return replacement.toUpperCase();
  }
  if (
    original[0] === original[0].toUpperCase() &&
    original.slice(1) === original.slice(1).toLowerCase()
  ) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/** Look up a safe, strictly shorter replacement. Returns null if none. */
function lookupReplacement(word) {
  const replacement = SYNONYMS[word.toLowerCase()];
  if (!replacement) return null;
  if (replacement.length >= word.length) return null; // safety net
  return replacement;
}

/**
 * Words that take "an" begin with a vowel SOUND. For every replacement word in
 * the curated dictionary, a first letter of a/e/i/o reliably signals that.
 * (The "u" replacements here — use, useful, usually — take "a".)
 */
function startsWithVowelSound(word) {
  return /^[aeio]/i.test(word);
}

/**
 * After substitution, an "a"/"an" in front of a replaced word may no longer
 * agree with it (e.g. "an important" -> "a key"). Fix any such article,
 * preserving the article's original capitalization.
 */
function fixArticles(segments) {
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.type !== 'word' || !seg.replaced) continue;
    const prev = segments[i - 1];
    if (!prev || prev.type !== 'text') continue;

    const m = prev.value.match(/(^|[^A-Za-z'])(a|an|A|An)(\s+)$/);
    if (!m) continue;

    const article = m[2];
    const wantAn = startsWithVowelSound(seg.replacement);
    const capitalized = article[0] === article[0].toUpperCase();
    const fixed = wantAn ? (capitalized ? 'An' : 'an') : capitalized ? 'A' : 'a';

    if (fixed !== article) {
      const head = prev.value.slice(0, m.index + m[1].length);
      prev.value = head + fixed + m[3];
    }
  }
}

/**
 * Comparative / superlative markers. A word directly after one of these is
 * left untouched, so the tool never produces broken grammar like "more
 * difficult" -> "more hard", or awkward phrasing like "most important" ->
 * "most key".
 */
const COMPARATIVE_MARKERS = /^(more|most|less|least)$/i;

/**
 * Optimize a prompt.
 * @param {string} prompt
 * @param {object|number} options  { minWordLength, aggressive }. A bare number
 *                                 is accepted as minWordLength for compatibility.
 * @returns {{
 *   original: string, optimized: string,
 *   segments: Array<object>,
 *   replacements: Array<{original:string, replacement:string}>,
 *   failedWords: string[],
 *   stats: {wordsConsidered:number, wordsReplaced:number}
 * }}
 */
export function optimizePrompt(prompt, options = {}) {
  const opts = typeof options === 'number' ? { minWordLength: options } : options;
  const minWordLength = opts.minWordLength ?? DEFAULT_MIN_WORD_LENGTH;
  const aggressive = Boolean(opts.aggressive);

  // Step 1: in aggressive mode, compress wordy phrases / filler first, then
  // repair sentence capitalization. `source` is what the synonym pass works on.
  let source = prompt;
  if (aggressive) {
    let compressed = aggressiveCompress(prompt, findProtectedRanges(prompt));
    compressed = recapitalize(compressed, findProtectedRanges(compressed));
    if (compressed.trim().length > 0) source = compressed; // fall back if empty
  }

  const protectedRanges = findProtectedRanges(source);

  // Step 2: find every word (a run of letters, allowing internal ' and -).
  const wordRe = /[A-Za-z][A-Za-z'-]*/g;
  const matches = [];
  let m;
  while ((m = wordRe.exec(source)) !== null) {
    matches.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }

  // Steps 3-5: rebuild the text as a segment list, substituting where safe.
  const segments = [];
  const replacementPairs = new Map(); // lowercase original -> replacement
  let wordsConsidered = 0;
  let wordsReplaced = 0;
  let cursor = 0;

  const pushText = (value) => {
    if (!value) return;
    const last = segments[segments.length - 1];
    if (last && last.type === 'text') last.value += value; // merge adjacent text
    else segments.push({ type: 'text', value });
  };

  let prevWord = null; // previous word token, used for the comparative guard
  for (const w of matches) {
    pushText(source.slice(cursor, w.start)); // verbatim gap before this word
    cursor = w.end;

    const eligible =
      w.text.length >= minWordLength &&
      !isProtected(w.start, w.end, protectedRanges);

    if (eligible) {
      wordsConsidered++;

      // Guard: skip a word directly after "more/most/less/least".
      const afterComparative =
        prevWord &&
        COMPARATIVE_MARKERS.test(prevWord.text) &&
        /^\s*$/.test(source.slice(prevWord.end, w.start));

      const base = afterComparative ? null : lookupReplacement(w.text);

      if (base) {
        const replacement = matchCase(w.text, base);
        segments.push({ type: 'word', original: w.text, replacement, replaced: true });
        replacementPairs.set(w.text.toLowerCase(), base);
        wordsReplaced++;
      } else {
        segments.push({ type: 'word', original: w.text, replacement: w.text, replaced: false });
      }
    } else {
      pushText(w.text); // protected / too short — keep verbatim
    }

    prevWord = w;
  }
  pushText(source.slice(cursor)); // trailing verbatim text

  // Step 6: repair any "a"/"an" left wrong by a substitution.
  fixArticles(segments);

  const optimized = segments
    .map((s) => (s.type === 'text' ? s.value : s.replacement))
    .join('');

  return {
    original: prompt,
    optimized,
    segments,
    replacements: [...replacementPairs].map(([original, replacement]) => ({
      original,
      replacement,
    })),
    failedWords: [], // kept for response-shape compatibility; offline = no failures
    stats: { wordsConsidered, wordsReplaced },
  };
}
