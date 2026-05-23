/**
 * optimizer.js
 * ------------
 * Core logic: turn a prompt into a shorter, meaning-preserving version by
 * swapping long words for shorter synonyms.
 *
 * Pipeline (in the order required by the spec):
 *   1. Tokenize the prompt into words, preserving everything else verbatim
 *      (punctuation, spacing, line breaks, casing).
 *   2. Protect regions that must never change: [square brackets], {curly
 *      braces}, fenced code blocks, `inline code`, URLs, numbers, and any
 *      word shorter than MIN_WORD_LENGTH.
 *   3. For every remaining word, fetch synonyms and choose the SHORTEST one
 *      that is (a) strictly shorter, (b) the same part of speech, and
 *      (c) a single meaning-preserving word. If none qualifies, keep it.
 *   4. Re-apply the original word's capitalization to the substitute.
 *   5. Return the optimized prompt + the list of {original, replacement} pairs.
 */

import { getSynonyms, lookupPartOfSpeech } from './datamuse.js';

export const DEFAULT_MIN_WORD_LENGTH = 6;

// Cap on concurrent Datamuse lookups — polite to the free API, fast enough.
const LOOKUP_CONCURRENCY = 6;

/**
 * Build a list of [start, end) character ranges that must be left untouched.
 * Order matters only for readability; ranges may overlap and that's fine.
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
 *  - anything else (incl. lowercase / mixed) -> replacement (left as-is)
 */
function matchCase(original, replacement) {
  if (original === original.toUpperCase() && /[A-Z]/.test(original)) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement; // synonyms from Datamuse arrive lowercase
}

/**
 * Choose the best replacement for one (lowercased) word.
 * Returns { replacement: string|null, failed: boolean }.
 *  - replacement is null when nothing qualifies (we keep the original).
 *  - failed is true when the synonym API was unreachable for this word.
 */
async function chooseReplacement(word) {
  const { synonyms, failed } = await getSynonyms(word);
  if (failed) return { replacement: null, failed: true };
  if (synonyms.length === 0) return { replacement: null, failed: false };

  const sourcePos = await lookupPartOfSpeech(word);

  // Keep only candidates that are safe, meaning-preserving substitutions.
  const candidates = synonyms.filter((s) => {
    const cand = s.word;
    if (!/^[a-z][a-z'-]*$/i.test(cand)) return false; // single plain word only
    if (cand.toLowerCase() === word) return false; // must differ
    if (cand.length >= word.length) return false; // must be STRICTLY shorter
    // Part-of-speech check: if both the source word and the candidate expose
    // POS tags, they must share at least one. If either side has no tags,
    // we accept it — Datamuse `rel_syn` results are already curated synonyms.
    if (sourcePos.size > 0 && s.pos.size > 0) {
      const shared = [...s.pos].some((p) => sourcePos.has(p));
      if (!shared) return false;
    }
    return true;
  });

  if (candidates.length === 0) return { replacement: null, failed: false };

  // Pick the shortest; break ties by Datamuse ordering (higher relevance first).
  candidates.sort((a, b) => a.word.length - b.word.length);
  return { replacement: candidates[0].word.toLowerCase(), failed: false };
}

/** Run async `worker` over `items` with a bounded concurrency pool. */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

/**
 * Optimize a prompt.
 * @param {string} prompt
 * @param {number} minWordLength  words shorter than this are never touched
 * @returns {Promise<{
 *   original: string,
 *   optimized: string,
 *   segments: Array<{type:'text'|'word', value?:string, original?:string,
 *                    replacement?:string, replaced?:boolean, failed?:boolean}>,
 *   replacements: Array<{original:string, replacement:string}>,
 *   failedWords: string[],
 *   stats: {wordsConsidered:number, wordsReplaced:number}
 * }>}
 */
export async function optimizePrompt(prompt, minWordLength = DEFAULT_MIN_WORD_LENGTH) {
  const protectedRanges = findProtectedRanges(prompt);

  // Step 1: find every word (a run of letters, allowing internal ' and -).
  const wordRe = /[A-Za-z][A-Za-z'-]*/g;
  const matches = [];
  let m;
  while ((m = wordRe.exec(prompt)) !== null) {
    matches.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }

  // Step 2: decide which words are eligible for substitution.
  const eligibleWords = new Set();
  for (const w of matches) {
    const eligible =
      w.text.length >= minWordLength && !isProtected(w.start, w.end, protectedRanges);
    w.eligible = eligible;
    if (eligible) eligibleWords.add(w.text.toLowerCase());
  }

  // Step 3: look up replacements for each unique eligible word (cached + pooled).
  const uniqueWords = [...eligibleWords];
  const lookups = await mapWithConcurrency(uniqueWords, LOOKUP_CONCURRENCY, (word) =>
    chooseReplacement(word),
  );
  const decisionByWord = new Map();
  uniqueWords.forEach((word, i) => decisionByWord.set(word, lookups[i]));

  // Step 4 & 5: rebuild the prompt as a segment list, applying casing.
  const segments = [];
  const failedWords = new Set();
  const replacementPairs = new Map(); // lowercase original -> replacement
  let wordsReplaced = 0;
  let cursor = 0;

  const pushText = (value) => {
    if (!value) return;
    const last = segments[segments.length - 1];
    if (last && last.type === 'text') last.value += value; // merge adjacent text
    else segments.push({ type: 'text', value });
  };

  for (const w of matches) {
    pushText(prompt.slice(cursor, w.start)); // verbatim gap before this word
    cursor = w.end;

    if (!w.eligible) {
      pushText(w.text); // protected / too short — keep verbatim
      continue;
    }

    const decision = decisionByWord.get(w.text.toLowerCase());
    if (decision?.failed) failedWords.add(w.text.toLowerCase());

    if (decision && decision.replacement) {
      const replacement = matchCase(w.text, decision.replacement);
      segments.push({ type: 'word', original: w.text, replacement, replaced: true });
      replacementPairs.set(w.text.toLowerCase(), decision.replacement);
      wordsReplaced++;
    } else {
      // No qualifying synonym (or lookup failed) — keep the original word.
      segments.push({
        type: 'word',
        original: w.text,
        replacement: w.text,
        replaced: false,
        failed: Boolean(decision?.failed),
      });
    }
  }
  pushText(prompt.slice(cursor)); // trailing verbatim text

  // Derive both strings from the single segment list — guarantees the
  // optimized output keeps every space, line break and punctuation mark,
  // and that `original` is a byte-perfect echo of the input prompt.
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
    failedWords: [...failedWords],
    stats: { wordsConsidered: eligibleWords.size, wordsReplaced },
  };
}
