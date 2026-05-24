/**
 * app.js
 * ------
 * Builds and exports the Express application WITHOUT starting a listener.
 *
 * Why split this out from server.js?
 *  - server.js  -> calls app.listen(), used for local dev and host platforms
 *                  that run a persistent Node process (e.g. Render, Railway).
 *  - api/index.js -> just re-exports this app, used by serverless platforms
 *                  (e.g. Vercel) that invoke the app per-request.
 * One app definition, two ways to run it.
 */

import express from 'express';
import cors from 'cors';
import { optimizePrompt, DEFAULT_MIN_WORD_LENGTH, dictionaryStats } from './optimizer.js';
import { geminiCompress, geminiConfigured, geminiModel } from './gemini.js';

const MAX_PROMPT_CHARS = 50_000; // guardrail against abusive payloads

const app = express();

// CORS: open by default so any frontend origin can call the API.
// To lock it down to your deployed frontend only, set the CORS_ORIGIN env
// var (e.g. CORS_ORIGIN=https://promptimizer.vercel.app).
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    dictionary: dictionaryStats(),
    ai: { configured: geminiConfigured(), model: geminiModel() },
  });
});

app.post('/api/optimize', async (req, res) => {
  const { prompt, minWordLength, aggressive, mode } = req.body ?? {};

  // --- Validation -----------------------------------------------------------
  if (typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Field "prompt" must be a string.' });
  }
  if (prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Prompt is empty.' });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return res
      .status(413)
      .json({ error: `Prompt exceeds the ${MAX_PROMPT_CHARS.toLocaleString()} character limit.` });
  }

  let minLen = DEFAULT_MIN_WORD_LENGTH;
  if (minWordLength !== undefined) {
    const n = Number(minWordLength);
    if (!Number.isFinite(n) || n < 2 || n > 20) {
      return res
        .status(400)
        .json({ error: '"minWordLength" must be a number between 2 and 20.' });
    }
    minLen = Math.floor(n);
  }

  // Resolve the mode. `mode` is the current field; `aggressive` (boolean) is
  // still accepted for backward compatibility with older frontend builds.
  const effectiveMode =
    typeof mode === 'string'
      ? mode.toLowerCase()
      : aggressive
        ? 'aggressive'
        : 'safe';
  if (!['safe', 'aggressive', 'ai'].includes(effectiveMode)) {
    return res
      .status(400)
      .json({ error: '"mode" must be safe, aggressive, or ai.' });
  }

  // --- Maximum (AI) mode: rewrite via the Gemini API ------------------------
  if (effectiveMode === 'ai') {
    try {
      const optimized = await geminiCompress(prompt);
      return res.json({
        original: prompt,
        optimized,
        mode: 'ai',
        segments: [{ type: 'text', value: optimized }],
        replacements: [],
        failedWords: [],
        stats: { wordsConsidered: 0, wordsReplaced: 0 },
      });
    } catch (err) {
      // geminiCompress throws messages that are safe to show the user.
      console.error('AI optimization failed:', err.message);
      return res.status(502).json({ error: err.message });
    }
  }

  // --- Safe / Aggressive mode: offline rule-based optimization --------------
  try {
    const result = await optimizePrompt(prompt, {
      minWordLength: minLen,
      aggressive: effectiveMode === 'aggressive',
    });
    res.json({ ...result, mode: effectiveMode });
  } catch (err) {
    console.error('Optimization failed:', err);
    res.status(500).json({ error: 'Internal error while optimizing the prompt.' });
  }
});

export default app;
