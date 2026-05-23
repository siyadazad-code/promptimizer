/**
 * SettingsBar — controls for the optimizer.
 *  - charsPerToken: drives the live token estimate (default 4).
 *  - minWordLength: shortest word the backend may substitute (default 6).
 *  - aggressive:    when on, the backend also trims filler words and rewrites
 *                   wordy phrases — a deeper cut than synonym swaps alone.
 */
export default function SettingsBar({
  charsPerToken,
  onCharsPerTokenChange,
  minWordLength,
  onMinWordLengthChange,
  aggressive,
  onAggressiveChange,
}) {
  return (
    <div className="settings-bar" role="group" aria-label="Optimizer settings">
      <div className="setting">
        <label htmlFor="charsPerToken">Characters per token</label>
        <div className="setting-control">
          <input
            id="charsPerToken"
            type="number"
            min="1"
            max="20"
            step="0.5"
            value={charsPerToken}
            onChange={(e) => onCharsPerTokenChange(e.target.value)}
          />
          <span className="setting-hint">recalculates counts live</span>
        </div>
      </div>

      <div className="setting">
        <label htmlFor="minWordLength">Minimum word length</label>
        <div className="setting-control">
          <input
            id="minWordLength"
            type="number"
            min="2"
            max="20"
            step="1"
            value={minWordLength}
            onChange={(e) => onMinWordLengthChange(e.target.value)}
          />
          <span className="setting-hint">shorter words are never changed</span>
        </div>
      </div>

      <div className="setting">
        <label htmlFor="aggressive">Aggressive mode</label>
        <div className="setting-control">
          <input
            id="aggressive"
            type="checkbox"
            checked={aggressive}
            onChange={(e) => onAggressiveChange(e.target.checked)}
          />
          <span className="setting-hint">
            {aggressive
              ? 'on — also trims filler words and wordy phrases'
              : 'off — swaps long words only, nothing deleted'}
          </span>
        </div>
      </div>
    </div>
  );
}
