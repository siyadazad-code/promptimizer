/**
 * api/index.js — Vercel serverless entry point.
 *
 * Vercel runs the exported Express app as a serverless function (one
 * invocation per request). We must NOT call app.listen() here.
 *
 * The vercel.json rewrite routes every request to this file, and Express
 * handles the /api/* paths internally.
 */
import app from '../src/app.js';

export default app;
