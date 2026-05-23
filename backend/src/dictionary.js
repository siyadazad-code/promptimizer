/**
 * dictionary.js
 * -------------
 * A hand-curated dictionary of long words mapped to shorter words that mean
 * the same thing in essentially every normal context.
 *
 * Why a curated list instead of an online synonym service?
 * An open synonym API returns synonyms for EVERY sense of a word — so
 * "application" comes back as "lotion" and "complaint" as "ill". Picking the
 * shortest of those silently destroys meaning. This list contains only
 * substitutions checked by hand, so every replacement is safe to make blindly.
 *
 * Rules every entry follows:
 *   - the key is always lowercase
 *   - the replacement is STRICTLY shorter than the key
 *   - the replacement preserves meaning, intent and tone in normal use
 *   - words with risky multiple meanings are deliberately left OUT
 *
 * Design principle: when in doubt, leave a word out. The tool changes fewer
 * words rather than risk changing the meaning of a prompt.
 */

export const SYNONYMS = {
  // --- verbs (base / -s / -ed / -ing forms) ---
  utilize: 'use', utilizes: 'uses', utilized: 'used', utilizing: 'using',
  demonstrate: 'show', demonstrates: 'shows', demonstrated: 'showed', demonstrating: 'showing',
  illustrate: 'show', illustrates: 'shows', illustrated: 'showed', illustrating: 'showing',
  indicate: 'show', indicates: 'shows', indicated: 'showed', indicating: 'showing',
  accomplish: 'achieve', accomplishes: 'achieves', accomplished: 'achieved', accomplishing: 'achieving',
  commence: 'start', commences: 'starts', commenced: 'started', commencing: 'starting',
  terminate: 'end', terminates: 'ends', terminated: 'ended', terminating: 'ending',
  purchase: 'buy', purchases: 'buys', purchased: 'bought', purchasing: 'buying',
  obtain: 'get', obtains: 'gets', obtained: 'got', obtaining: 'getting',
  require: 'need', requires: 'needs', required: 'needed', requiring: 'needing',
  provide: 'give', provides: 'gives',
  receive: 'get', receives: 'gets', received: 'got', receiving: 'getting',
  maintain: 'keep', maintains: 'keeps', maintained: 'kept', maintaining: 'keeping',
  construct: 'build', constructs: 'builds', constructed: 'built', constructing: 'building',
  facilitate: 'help', facilitates: 'helps', facilitated: 'helped', facilitating: 'helping',
  generate: 'make', generates: 'makes', generated: 'made', generating: 'making',
  perform: 'do', performs: 'does', performed: 'did',
  remain: 'stay', remains: 'stays', remained: 'stayed',
  create: 'make', creates: 'makes', created: 'made', creating: 'making',
  select: 'pick', selects: 'picks', selected: 'picked', selecting: 'picking',
  assist: 'help', assists: 'helps', assisted: 'helped', assisting: 'helping',
  attempt: 'try', attempts: 'tries', attempted: 'tried', attempting: 'trying',
  evaluate: 'assess', evaluates: 'assesses', evaluated: 'assessed', evaluating: 'assessing',
  recommend: 'suggest', recommends: 'suggests', recommended: 'suggested', recommending: 'suggesting',
  respond: 'reply', responds: 'replies', responded: 'replied', responding: 'replying',
  resolve: 'solve', resolves: 'solves', resolved: 'solved', resolving: 'solving',
  eliminate: 'remove', eliminates: 'removes', eliminated: 'removed', eliminating: 'removing',

  // --- adjectives ---
  additional: 'extra',
  numerous: 'many',
  multiple: 'many',
  sufficient: 'enough',
  beneficial: 'useful',
  necessary: 'needed',
  difficult: 'hard',
  important: 'key',
  significant: 'major',
  enormous: 'huge',
  initial: 'first',
  previous: 'prior',
  excellent: 'great',
  accurate: 'exact',
  expensive: 'costly',
  courteous: 'polite',
  primary: 'main',

  // --- adverbs ---
  approximately: 'about',
  immediately: 'now',
  frequently: 'often',
  currently: 'now',
  previously: 'before',
  typically: 'usually',
  generally: 'mostly',
  additionally: 'also',
  furthermore: 'also',
  consequently: 'so',
  nevertheless: 'still',
  subsequently: 'later',
  primarily: 'mainly',
  initially: 'first',
  therefore: 'so',
  however: 'but',
  although: 'though',
  rapidly: 'fast',

  // --- prepositions ---
  regarding: 'about',
  concerning: 'about',

  // --- nouns (singular / plural) ---
  information: 'info',
  assistance: 'help',
  requirement: 'need', requirements: 'needs',
  difficulty: 'issue', difficulties: 'issues',
  opportunity: 'chance', opportunities: 'chances',
  modification: 'change', modifications: 'changes',
  beginning: 'start', beginnings: 'starts',
  response: 'reply', responses: 'replies',
  question: 'query', questions: 'queries',
  problem: 'issue', problems: 'issues',
};
