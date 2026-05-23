import { useState } from 'react';

/**
 * ResultView — original vs optimized prompt, side by side.
 *
 * Both columns are rendered from the SAME `segments` array returned by the
 * backend, so highlighting lines up exactly:
 *   - text segments  -> rendered verbatim (whitespace preserved via CSS)
 *   - word segments  -> `original` on the left, `replacement` on the right;
 *                       substituted words get a coloured highlight, and any
 *                       word whose synonym lookup failed gets a warning mark.
 */
function renderSegments(segments, side) {
  return segments.map((seg, i) => {
    if (seg.type === 'text') {
      return <span key={i}>{seg.value}</span>;
    }
    if (seg.replaced) {
      const cls = side === 'original' ? 'mark mark-from' : 'mark mark-to';
      const title =
        side === 'original'
          ? `Replaced with "${seg.replacement}"`
          : `Was "${seg.original}"`;
      return (
        <mark key={i} className={cls} title={title}>
          {side === 'original' ? seg.original : seg.replacement}
        </mark>
      );
    }
    if (seg.failed) {
      return (
        <span
          key={i}
          className="mark mark-failed"
          title="Synonym lookup failed — original word kept"
        >
          {seg.original}
        </span>
      );
    }
    return <span key={i}>{seg.original}</span>;
  });
}

export default function ResultView({ result }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result.optimized);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      alert('Could not copy automatically — please select and copy manually.');
    }
  }

  const { segments, replacements, failedWords, stats } = result;

  return (
    <section className="card result-card" aria-label="Optimization result">
      <div className="card-head">
        <h2>Original vs optimized</h2>
        <span className="counter">
          {stats.wordsReplaced} of {stats.wordsConsidered} eligible words shortened
        </span>
      </div>

      <div className="diff-grid">
        <article className="diff-col">
          <header className="diff-col-head">
            <span className="diff-tag">Original</span>
          </header>
          <pre className="diff-text">{renderSegments(segments, 'original')}</pre>
        </article>

        <article className="diff-col diff-col-optimized">
          <header className="diff-col-head">
            <span className="diff-tag diff-tag-accent">Optimized</span>
            <button type="button" className="btn btn-copy" onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </header>
          <pre className="diff-text">{renderSegments(segments, 'optimized')}</pre>
        </article>
      </div>

      {failedWords.length > 0 && (
        <p className="notice notice-warn" role="status">
          The synonym service was unreachable for{' '}
          <strong>{failedWords.length}</strong> word
          {failedWords.length === 1 ? '' : 's'} — those were kept unchanged and
          marked above.
        </p>
      )}

      {replacements.length > 0 ? (
        <details className="replacements">
          <summary>
            {replacements.length} substitution
            {replacements.length === 1 ? '' : 's'} made
          </summary>
          <ul className="replacement-list">
            {replacements.map((r) => (
              <li key={r.original}>
                <span className="rep-from">{r.original}</span>
                <span className="rep-arrow" aria-hidden="true">
                  →
                </span>
                <span className="rep-to">{r.replacement}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="notice notice-info" role="status">
          No safe shorter synonyms were found — the prompt is unchanged.
        </p>
      )}
    </section>
  );
}
