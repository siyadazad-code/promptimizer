/**
 * tokens.js — token-estimation helpers (frontend display only).
 *
 * Real tokenizers (BPE) are model-specific; here we use the simple,
 * transparent heuristic the spec asks for:
 *     estimatedTokens = ceil(characterCount / charsPerToken)
 * All figures shown in the UI are therefore APPROXIMATE / ESTIMATED.
 */

/** Estimate token count from a character count and a chars-per-token ratio. */
export function estimateTokens(charCount, charsPerToken) {
  const ratio = Number(charsPerToken);
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return Math.ceil(charCount / ratio);
}

/**
 * Compute the full set of stats for an original/optimized pair.
 * Returns character counts, estimated tokens, and tokens saved (abs + %).
 */
export function computeStats(originalText, optimizedText, charsPerToken) {
  const originalChars = originalText.length;
  const optimizedChars = optimizedText.length;
  const originalTokens = estimateTokens(originalChars, charsPerToken);
  const optimizedTokens = estimateTokens(optimizedChars, charsPerToken);
  const tokensSaved = originalTokens - optimizedTokens;
  const percentSaved =
    originalTokens > 0 ? (tokensSaved / originalTokens) * 100 : 0;

  return {
    originalChars,
    optimizedChars,
    originalTokens,
    optimizedTokens,
    tokensSaved,
    percentSaved,
  };
}
