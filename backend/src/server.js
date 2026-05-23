/**
 * server.js
 * ---------
 * Starts the Promptimizer API as a persistent Node process.
 * Used for local development and for host platforms that run a real server
 * (Render, Railway, Fly.io, a VPS, etc.).
 *
 * Serverless platforms (Vercel) use api/index.js instead — see that file.
 */

import app from './app.js';

// Hosts inject the port via the PORT env var; 3001 is the local default.
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Promptimizer API listening on http://localhost:${PORT}`);
});
