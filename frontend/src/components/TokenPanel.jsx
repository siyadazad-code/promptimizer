/**
 * TokenPanel — side-by-side character & token estimates for the original and
 * optimized prompts, plus the headline "tokens saved" figure.
 *
 * Every number here is an ESTIMATE: tokens = ceil(characters / charsPerToken).
 * The `stats` object is recomputed by the parent whenever charsPerToken
 * changes, so these values update live.
 */
export default function TokenPanel({ stats, charsPerToken }) {
  const {
    originalChars,
    optimizedChars,
    originalTokens,
    optimizedTokens,
    tokensSaved,
    percentSaved,
  } = stats;

  const saved = tokensSaved > 0;
  const pct = Math.abs(percentSaved).toFixed(1);

  return (
    <section className="card token-panel" aria-label="Token estimates">
      <div className="card-head">
        <h2>Token estimate</h2>
        <span className="badge-approx">approximate</span>
      </div>

      <div className="token-grid">
        <div className="token-col">
          <span className="token-col-label">Original</span>
          <span className="token-big">{originalTokens.toLocaleString()}</span>
          <span className="token-sub">est. tokens</span>
          <span className="token-meta">
            {originalChars.toLocaleString()} characters
          </span>
        </div>

        <div className="token-arrow" aria-hidden="true">
          →
        </div>

        <div className="token-col">
          <span className="token-col-label">Optimized</span>
          <span className="token-big token-big-accent">
            {optimizedTokens.toLocaleString()}
          </span>
          <span className="token-sub">est. tokens</span>
          <span className="token-meta">
            {optimizedChars.toLocaleString()} characters
          </span>
        </div>
      </div>

      <div
        className={`token-saved ${saved ? 'is-positive' : 'is-neutral'}`}
        aria-live="polite"
      >
        <div className="token-saved-main">
          <span className="token-saved-num">
            {saved ? '−' : ''}
            {Math.abs(tokensSaved).toLocaleString()}
          </span>
          <span className="token-saved-label">
            {saved
              ? 'estimated tokens saved'
              : tokensSaved === 0
                ? 'no estimated change'
                : 'estimated tokens added'}
          </span>
        </div>
        <span className="token-saved-pct">{pct}%</span>
      </div>

      <p className="token-note">
        Estimated using <strong>{charsPerToken}</strong> characters per token.
        Actual tokenization is model-specific — treat these as a guide.
      </p>
    </section>
  );
}
