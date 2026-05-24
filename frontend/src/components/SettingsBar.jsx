/**
 * SettingsBar — controls for the optimizer.
 *  - charsPerToken: drives the live token estimate (default 4).
 *  - minWordLength: shortest word the backend may substitute (default 6).
 *                   Applies to Safe and Aggressive modes only.
 *  - mode:          'safe'       — swap long words for shorter ones (offline);
 *                   'aggressive' — also trim filler and wordy phrases (offline);
 *                   'ai'         — Gemini rewrites the whole prompt (online).
 */
const MODE_HINTS = {
  safe: 'swaps long words only — offline, nothing deleted',
  aggressive: 'also trims filler and wordy phrases — offline',
  ai: 'Gemini rewrites the whole prompt — sends it to Google',
};

export default function SettingsBar({
  charsPerToken,
  onCharsPerTokenChange,
  minWordLength,
  onMinWordLengthChange,
  mode,
  onModeChange,
}) {
  return (
    <div className="settings-bar" role="group" aria-label="Optimizer settings">
      <div className="setting">
        <label htmlFor="mode">Optimization mode</label>
        <div className="setting-control">
          <select
            id="mode"
            value={mode}
            onChange={(e) => onModeChange(e.target.value)}
          >
            <option value="safe">Safe</option>
            <option value="aggressive">Aggressive</option>
            <option value="ai">Maximum (AI)</option>
          </select>
          <span className="setting-hint">{MODE_HINTS[mode]}</span>
        </div>
      </div>

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
          <span className="setting-hint">Safe / Aggressive modes only</span>
        </div>
      </div>
    </div>
  );
}
