/**
 * compress.js
 * -----------
 * Aggressive compression — used only when "Aggressive" mode is switched on.
 *
 * The synonym dictionary swaps single long words for short ones. This module
 * goes further: it rewrites wordy multi-word phrases into concise ones and
 * removes filler words that carry no instruction or logic ("please", "very",
 * politeness frames, and so on).
 *
 * It stays safe in the ways that matter:
 *   - it only ever touches UNPROTECTED text — placeholders, braces, code
 *     blocks, inline code and URLs are passed through verbatim;
 *   - it never deletes articles ("the"/"a") and never rewrites the meaning of
 *     a sentence, so the result stays readable, grammatical English.
 *
 * The caller supplies the protected character ranges, so this module has no
 * dependency on the optimizer (and there is no circular import).
 */

// --- Wordy phrase -> concise phrase. Listed longest / most specific first. ---
// An empty replacement means "delete this phrase entirely" (a filler frame).
const PHRASE_PAIRS = [
  // filler frames — pure padding around an instruction, removed entirely
  ['it is important to note that', ''],
  ['it should be noted that', ''],
  ['it is worth noting that', ''],
  ['please be aware that', ''],
  ['please keep in mind that', ''],
  ['please note that', ''],
  ['keep in mind that', ''],
  ['bear in mind that', ''],
  ['as a matter of fact', ''],
  ['needless to say', ''],
  ['what i want you to do is', ''],
  ['i would like for you to', ''],
  ['i would like you to', ''],
  ["i'd like you to", ''],
  ['i want you to', ''],
  ['i need you to', ''],
  ['your task is to', ''],
  ['your job is to', ''],
  // wordy phrase -> short phrase
  ['for all intents and purposes', 'essentially'],
  ['in light of the fact that', 'because'],
  ['on account of the fact that', 'because'],
  ['in view of the fact that', 'because'],
  ['because of the fact that', 'because'],
  ['owing to the fact that', 'because'],
  ['due to the fact that', 'because'],
  ['for the reason that', 'because'],
  ['given the fact that', 'because'],
  ['notwithstanding the fact that', 'although'],
  ['regardless of the fact that', 'although'],
  ['in spite of the fact that', 'although'],
  ['despite the fact that', 'although'],
  ['in the event that', 'if'],
  ['in the event of', 'if'],
  ['in cases where', 'when'],
  ['in situations where', 'when'],
  ['at this moment in time', 'now'],
  ['at this point in time', 'now'],
  ['at the present time', 'now'],
  ['in this day and age', 'now'],
  ['in the near future', 'soon'],
  ['a significant number of', 'many'],
  ['a large number of', 'many'],
  ['a great number of', 'many'],
  ['large numbers of', 'many'],
  ['a wide variety of', 'many'],
  ['a wide range of', 'many'],
  ['a substantial amount of', 'much'],
  ['a great deal of', 'much'],
  ['the majority of', 'most'],
  ['a majority of', 'most'],
  ['a small number of', 'a few'],
  ['has the ability to', 'can'],
  ['have the ability to', 'can'],
  ['has the capacity to', 'can'],
  ['had the ability to', 'could'],
  ['is able to', 'can'],
  ['are able to', 'can'],
  ['was able to', 'could'],
  ['were able to', 'could'],
  ['with regard to', 'about'],
  ['with regards to', 'about'],
  ['in regard to', 'about'],
  ['in regards to', 'about'],
  ['with respect to', 'about'],
  ['in respect to', 'about'],
  ['in relation to', 'about'],
  ['in reference to', 'about'],
  ['in connection with', 'about'],
  ['on a regular basis', 'often'],
  ['on a daily basis', 'daily'],
  ['on a weekly basis', 'weekly'],
  ['in a timely manner', 'promptly'],
  ['in close proximity to', 'near'],
  ['in the vicinity of', 'near'],
  ['with the exception of', 'except'],
  ['in the absence of', 'without'],
  ['through the use of', 'using'],
  ['with the use of', 'using'],
  ['in conjunction with', 'with'],
  ['in advance of', 'before'],
  ['previous to', 'before'],
  ['prior to', 'before'],
  ['subsequent to', 'after'],
  ['by means of', 'by'],
  ['by virtue of', 'by'],
  ['in order to', 'to'],
  ['in order for', 'for'],
  ['so as to', 'to'],
  ['for the purpose of', 'for'],
  ['each and every', 'every'],
  ['any and all', 'all'],
  ['first and foremost', 'first'],
  ['as well as', 'and'],
  ['the fact that', 'that'],
];

// --- Single filler words -> removed. Only words safe to drop in instructions. ---
const FILLER_WORDS = [
  'please', 'kindly', 'very', 'really', 'quite', 'basically', 'actually',
  'literally', 'definitely', 'certainly', 'obviously', 'somewhat', 'fairly',
  'highly', 'extremely', 'absolutely', 'truly', 'indeed',
];

// --- Pre-compile every rule once at module load -----------------------------
const COMPILED_PHRASES = PHRASE_PAIRS.map(([phrase, repl]) => {
  const body = phrase.split(' ').join('\\s+');
  // deletions also swallow trailing spaces/tabs so no double space is left
  const pattern = '\\b' + body + '\\b' + (repl === '' ? '[ \\t]*' : '');
  return { re: new RegExp(pattern, 'gi'), repl };
});

const COMPILED_FILLERS = FILLER_WORDS.map(
  (w) => new RegExp('[ \\t]*\\b' + w + '\\b[ \\t]*', 'gi'),
);

/** Sort protected ranges by start and merge any that overlap or touch. */
function sortMerge(ranges) {
  if (!ranges || ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out = [[sorted[0][0], sorted[0][1]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const [s, e] = sorted[i];
    if (s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/** Apply phrase rewrites + filler removal + whitespace cleanup to plain text. */
function transformText(text) {
  if (!text) return text;
  let t = text;
  for (const { re, repl } of COMPILED_PHRASES) t = t.replace(re, repl);
  for (const re of COMPILED_FILLERS) t = t.replace(re, ' ');
  // tidy up after the deletions
  t = t.replace(/[ \t]{2,}/g, ' '); // collapse runs of spaces
  t = t.replace(/,[ \t]*,/g, ','); // double comma a deletion may leave
  t = t.replace(/[ \t]+([,.;:!?])/g, '$1'); // space before punctuation
  t = t.replace(/[ \t]+\n/g, '\n'); // trailing space at end of a line
  return t;
}

/**
 * Aggressively compress a prompt. Only the text OUTSIDE the supplied protected
 * ranges is rewritten; protected spans are copied through byte-for-byte.
 */
export function aggressiveCompress(text, ranges) {
  const merged = sortMerge(ranges);
  let out = '';
  let cursor = 0;
  for (const [s, e] of merged) {
    out += transformText(text.slice(cursor, s));
    out += text.slice(s, e); // protected — verbatim
    cursor = e;
  }
  out += transformText(text.slice(cursor));
  return out.trim();
}

/**
 * Capitalize sentence and list-item starts. After deletions, a sentence can
 * begin with a lowercase word ("Please review" -> "review"); this restores the
 * capital. It triggers only at real boundaries — start of text, after .!?, a
 * blank line, or a bullet — so wrapped sentences are NOT wrongly capitalized.
 * Positions inside protected ranges are skipped.
 */
export function recapitalize(text, ranges) {
  const merged = sortMerge(ranges);
  const re =
    /(^|[.!?]["'’)\]]*\s+|\n[ \t]*\n[ \t]*|\n[ \t]*(?:[-*•]|\d+[.)])[ \t]+)([a-z])/g;
  return text.replace(re, (match, pre, ch, offset) => {
    const idx = offset + pre.length;
    for (const [s, e] of merged) {
      if (idx >= s && idx < e) return match; // inside protected text — leave it
    }
    return pre + ch.toUpperCase();
  });
}
