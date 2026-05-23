/**
 * PromptInput — the large prompt text area plus the Optimize / Clear actions.
 * Shows a loading state on the button while a request is in flight.
 */
export default function PromptInput({
  prompt,
  onPromptChange,
  onOptimize,
  onClear,
  loading,
}) {
  const charCount = prompt.length;

  return (
    <section className="card prompt-card" aria-label="Prompt input">
      <div className="card-head">
        <h2>Your prompt</h2>
        <span className="counter" aria-live="polite">
          {charCount.toLocaleString()} characters
        </span>
      </div>

      <label htmlFor="prompt" className="visually-hidden">
        Prompt text
      </label>
      <textarea
        id="prompt"
        className="prompt-textarea"
        placeholder="Paste the prompt you want to shrink…&#10;&#10;Placeholders like [USER_NAME], {variables}, `inline code`, fenced code blocks, URLs and numbers are kept exactly as written."
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        spellCheck="false"
        rows={10}
      />

      <div className="prompt-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onOptimize}
          disabled={loading || prompt.trim().length === 0}
        >
          {loading ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Optimizing…
            </>
          ) : (
            'Optimize prompt'
          )}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onClear}
          disabled={loading || prompt.length === 0}
        >
          Clear
        </button>
      </div>
    </section>
  );
}
