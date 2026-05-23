import { useMemo, useState } from 'react';
import SettingsBar from './components/SettingsBar.jsx';
import PromptInput from './components/PromptInput.jsx';
import ResultView from './components/ResultView.jsx';
import TokenPanel from './components/TokenPanel.jsx';
import { computeStats } from './tokens.js';

// Base URL of the backend API.
//  - In development this stays empty, so requests go to "/api/..." and Vite's
//    dev proxy forwards them to the backend on port 3001.
//  - In production, set VITE_API_BASE (a build-time env var) to your deployed
//    backend URL, e.g. https://promptimizer-api.onrender.com
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

const EXAMPLE_PROMPT = `You are an experienced assistant. Please carefully analyze the
following customer feedback and demonstrate the underlying sentiment. Summarize
the principal complaints, provide actionable recommendations, and approximately
estimate the severity for each issue. Preserve the placeholder [CUSTOMER_NAME]
and the variable {ticket_id} exactly. Reference https://example.com/policy when
necessary. Numbers such as 2024 must remain unchanged.`;

export default function App() {
  const [prompt, setPrompt] = useState('');
  // Numeric settings are kept as strings so the inputs stay freely editable.
  const [charsPerToken, setCharsPerToken] = useState('4');
  const [minWordLength, setMinWordLength] = useState('6');

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Recomputed on every render — so editing "characters per token" updates
  // the token panel live, with no extra request to the backend.
  const stats = useMemo(() => {
    if (!result) return null;
    return computeStats(result.original, result.optimized, charsPerToken);
  }, [result, charsPerToken]);

  async function handleOptimize() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          minWordLength: Number(minWordLength) || 6,
        }),
      });

      if (!res.ok) {
        // The backend returns a JSON { error } body for known failures.
        let message = `Request failed (HTTP ${res.status}).`;
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {
          /* non-JSON error response — keep the generic message */
        }
        throw new Error(message);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      // A thrown TypeError here almost always means the API is unreachable.
      setResult(null);
      setError(
        err instanceof TypeError
          ? 'Could not reach the optimizer service. Make sure the backend is running on port 3001.'
          : err.message,
      );
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setPrompt('');
    setResult(null);
    setError(null);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            {'</>'}
          </span>
          <div>
            <h1>Promptimizer</h1>
            <p className="tagline">
              Trim tokens, keep meaning. Long words swapped for shorter
              synonyms — placeholders, code and logic left untouched.
            </p>
          </div>
        </div>
      </header>

      <main className="app-main">
        <SettingsBar
          charsPerToken={charsPerToken}
          onCharsPerTokenChange={setCharsPerToken}
          minWordLength={minWordLength}
          onMinWordLengthChange={setMinWordLength}
        />

        <PromptInput
          prompt={prompt}
          onPromptChange={setPrompt}
          onOptimize={handleOptimize}
          onClear={handleClear}
          loading={loading}
        />

        {prompt.length === 0 && !result && (
          <button
            type="button"
            className="btn btn-link"
            onClick={() => setPrompt(EXAMPLE_PROMPT)}
          >
            Load an example prompt
          </button>
        )}

        {error && (
          <p className="notice notice-error" role="alert">
            <strong>Optimization failed.</strong> {error}
          </p>
        )}

        {loading && (
          <div className="loading-block" role="status">
            <span className="spinner spinner-lg" aria-hidden="true" />
            <p>Looking up shorter synonyms…</p>
          </div>
        )}

        {result && !loading && (
          <>
            <TokenPanel stats={stats} charsPerToken={charsPerToken} />
            <ResultView result={result} />
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Token figures are <strong>approximate estimates</strong> (characters
          ÷ characters-per-token), not exact model tokenization. Synonyms
          provided by the free Datamuse API.
        </p>
      </footer>
    </div>
  );
}
