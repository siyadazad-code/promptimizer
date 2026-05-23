/**
 * SettingsBar — numeric controls.
 *  - charsPerToken: drives the live token estimate (default 4).
 *  - minWordLength: shortest word the backend is allowed to substitute
 *    (default 6); sent with the next optimize request.
 */
export default function SettingsBar({
  charsPerToken,
  onCharsPerTokenChange,
  minWordLength,
  onMinWordLengthChange,
}) {
  return (
    <div className="settings-bar" role="group" aria-label="Estimation settings">
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
    </div>
  );
}
