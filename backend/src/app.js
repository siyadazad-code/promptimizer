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

const MAX_PROMPT_CHARS = 50_000; // guardrail against abusive payloads

const app = express();

// CORS: open by default so any frontend origin can call the API.
// To lock it down to your deployed frontend only, set the CORS_ORIGIN env
// var (e.g. CORS_ORIGIN=https://promptimizer.vercel.app).
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', dictionary: dictionaryStats() });
});

app.post('/api/optimize', async (req, res) => {
  const { prompt, minWordLength, aggressive } = req.body ?? {};

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

  // --- Optimize -------------------------------------------------------------
  try {
    const result = await optimizePrompt(prompt, {
      minWordLength: minLen,
      aggressive: Boolean(aggressive),
    });
    res.json(result);
  } catch (err) {
    console.error('Optimization failed:', err);
    res.status(500).json({ error: 'Internal error while optimizing the prompt.' });
  }
});

export default app;
