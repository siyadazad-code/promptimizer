/**
 * optimizer.js
 * ------------
 * Core logic: shorten a prompt by swapping long words for shorter ones,
 * using the hand-curated dictionary in dictionary.js.
 *
 * Pipeline (in the order required by the spec):
 *   1. Tokenize the prompt into words, keeping everything else verbatim
 *      (punctuation, spacing, line breaks, casing).
 *   2. Protect regions that must never change: [square brackets], {curly
 *      braces}, fenced code blocks, `inline code`, URLs, numbers, and any
 *      word shorter than MIN_WORD_LENGTH.
 *   3. For each remaining word, look it up in the curated dictionary. If a
 *      safe, strictly shorter word exists, use it; otherwise keep the original.
 *   4. Re-apply the original word's capitalization to the substitute.
 *   5. Fix any "a"/"an" article that a substitution would have left wrong.
 *   6. Return the optimized prompt plus the list of {original, replacement}.
 *
 * This module makes NO network calls — it is fast, offline and deterministic.
 */

import { SYNONYMS } from './dictionary.js';

export const DEFAULT_MIN_WORD_LENGTH = 6;

/** Size of the curated dictionary — reported by the /api/health endpoint. */
export function dictionaryStats() {
  return { entries: Object.keys(SYNONYMS).length };
}

/**
 * Build a list of [start, end) character ranges that must be left untouched.
 */
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
 * Words that take "an" begin with a vowel SOUND. For every replacement word
 * in the curated dictionary, a first letter of a/e/i/o reliably signals that.
 * (The "u" replacements here — use, useful, usually — take "a", so a leading
 * "u" is treated as a consonant sound.)
 */
function startsWithVowelSound(word) {
  return /^[aeio]/i.test(word);
}

/**
 * After substitution, an "a"/"an" sitting in front of a replaced word may no
 * longer agree with it (e.g. "an important" -> "a key"). Fix any such article,
 * preserving the article's original capitalization.
 */
function fixArticles(segments) {
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.type !== 'word' || !seg.replaced) continue;
    const prev = segments[i - 1];
    if (!prev || prev.type !== 'text') continue;

    // Does the text immediately before this word end with an "a"/"an" article?
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
 * Optimize a prompt.
 * @param {string} prompt
 * @param {number} minWordLength  words shorter than this are never touched
 * @returns {{
 *   original: string, optimized: string,
 *   segments: Array<object>,
 *   replacements: Array<{original:string, replacement:string}>,
 *   failedWords: string[],
 *   stats: {wordsConsidered:number, wordsReplaced:number}
 * }}
 */
/**
 * Comparative / superlative markers. A word sitting directly after one of
 * these is left untouched, so the tool never produces broken grammar like
 * "more difficult" -> "more hard" (should be "harder"), or awkward phrasing
 * like "most important" -> "most key".
 */
const COMPARATIVE_MARKERS = /^(more|most|less|least)$/i;

export function optimizePrompt(prompt, minWordLength = DEFAULT_MIN_WORD_LENGTH) {
  const protectedRanges = findProtectedRanges(prompt);

  // Step 1: find every word (a run of letters, allowing internal ' and -).
  const wordRe = /[A-Za-z][A-Za-z'-]*/g;
  const matches = [];
  let m;
  while ((m = wordRe.exec(prompt)) !== null) {
    matches.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }

  // Steps 2-4: rebuild the prompt as a segment list, substituting where safe.
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
    pushText(prompt.slice(cursor, w.start)); // verbatim gap before this word
    cursor = w.end;

    const eligible =
      w.text.length >= minWordLength &&
      !isProtected(w.start, w.end, protectedRanges);

    if (eligible) {
      wordsConsidered++;

      // Guard: skip a word that sits directly after "more/most/less/least"
      // (only whitespace between), to avoid broken comparatives.
      const afterComparative =
        prevWord &&
        COMPARATIVE_MARKERS.test(prevWord.text) &&
        /^\s*$/.test(prompt.slice(prevWord.end, w.start));

      const base = afterComparative ? null : lookupReplacement(w.text);

      if (base) {
        const replacement = matchCase(w.text, base);
        segments.push({ type: 'word', original: w.text, replacement, replaced: true });
        replacementPairs.set(w.text.toLowerCase(), base);
        wordsReplaced++;
      } else {
        // Not in the dictionary, or guarded — keep the original word untouched.
        segments.push({ type: 'word', original: w.text, replacement: w.text, replaced: false });
      }
    } else {
      pushText(w.text); // protected / too short — keep verbatim
    }

    prevWord = w;
  }
  pushText(prompt.slice(cursor)); // trailing verbatim text

  // Step 5: repair any "a"/"an" left wrong by a substitution.
  fixArticles(segments);

  // Step 6: derive the optimized string from the single segment list — this
  // guarantees every space, line break and punctuation mark is preserved.
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
