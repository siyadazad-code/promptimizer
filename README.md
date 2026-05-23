# Promptimizer

**Trim tokens, keep meaning.** Promptimizer takes a text prompt and produces a
shorter version by swapping long words for shorter synonyms — while leaving the
original meaning, intent, logic, placeholders, code, and formatting fully
intact. The goal is to lower token consumption when the prompt is later sent to
an LLM.

---

## How it works

1. You paste a prompt into the React UI and click **Optimize**.
2. The frontend sends the prompt to the Node/Express backend.
3. The backend tokenizes the prompt, protects everything that must not change,
   and looks up each remaining long word in a **hand-curated dictionary** of
   safe long-to-short word swaps.
4. If the dictionary has a shorter, meaning-preserving word it uses it;
   otherwise the original word is kept. Every swap is verified by hand, so the
   meaning, intent and logic of the prompt are never altered.
5. The UI shows the original and optimized prompts side by side with replaced
   words highlighted, plus a live token-estimate panel.

All word substitution happens **on the backend**. It is fully offline and
deterministic — no third-party API, no API keys, no network calls — so the
same prompt always produces the same result, instantly.

### Why a curated dictionary?

Open synonym APIs return synonyms for *every* sense of a word, so "application"
can come back as "lotion" and "complaint" as "ill". Substituting those silently
breaks the prompt. Promptimizer instead uses a dictionary of word swaps that
have each been checked by hand, so every replacement is safe to apply blindly.
The list is conservative by design: when in doubt, a word is left out.

---

## Project structure

```
promptimizer/
├── README.md
├── backend/                  Node.js + Express REST API
│   ├── package.json
│   └── src/
│       ├── server.js         Express app & routes
│       ├── optimizer.js      Tokenizing + substitution logic
│       └── dictionary.js     Curated long-to-short word dictionary
└── frontend/                 React + Vite single-page app
    ├── package.json
    ├── vite.config.js        Dev server + /api proxy to the backend
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx           State orchestration
        ├── tokens.js         Token-estimate helpers
        ├── styles.css
        └── components/
            ├── SettingsBar.jsx
            ├── PromptInput.jsx
            ├── TokenPanel.jsx
            └── ResultView.jsx
```

---

## Prerequisites

- **Node.js 18 or newer** (the backend uses the built-in global `fetch`).
- npm (bundled with Node).

---

## Running the app

The app is two services. Run each in its own terminal.

### 1. Backend (port 3001)

```bash
cd backend
npm install
npm start          # or: npm run dev   (auto-restarts on file changes)
```

You should see: `Promptimizer API listening on http://localhost:3001`

### 2. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open the printed URL (default **http://localhost:5173**).

> The Vite dev server proxies every `/api/*` request to the backend on port
> 3001, so the two services work together with no extra configuration.

### Production build of the frontend

```bash
cd frontend
npm run build      # output in frontend/dist/
npm run preview    # preview the production build locally
```

---

## Using Promptimizer

1. Paste a prompt (or click **Load an example prompt**).
2. Optionally adjust:
   - **Characters per token** — the token-estimate ratio (default `4`).
     Changing it recalculates every count instantly.
   - **Minimum word length** — words shorter than this are never changed
     (default `6`).
3. Click **Optimize prompt**.
4. Review the side-by-side diff, the token-savings panel, and copy the
   optimized prompt with the **Copy** button.

### What is never changed

- Text inside `[square brackets]` or `{curly braces}` (placeholders/variables)
- Fenced code blocks (```` ``` ````) and `inline code`
- URLs and numbers
- Words shorter than the configured minimum length
- Any word that is not in the curated dictionary of safe word swaps

---

## API reference

### `GET /api/health`

Returns `{ "status": "ok", "dictionary": { "entries": 159 } }`.

### `POST /api/optimize`

Request body:

```json
{ "prompt": "your prompt text", "minWordLength": 6 }
```

`minWordLength` is optional (default 6, allowed range 2–20).

Response body:

```json
{
  "original": "…",
  "optimized": "…",
  "segments": [ { "type": "word", "original": "utilize", "replacement": "use", "replaced": true }, … ],
  "replacements": [ { "original": "utilize", "replacement": "use" } ],
  "failedWords": [],
  "stats": { "wordsConsidered": 12, "wordsReplaced": 7 }
}
```

`segments` covers the whole prompt in order, so the UI can render the original
and optimized text — with highlights — from a single aligned list.

---

## Notes & limitations

- **Token counts are approximate estimates.** Real tokenization is
  model-specific (BPE); Promptimizer uses the transparent heuristic
  `tokens = ceil(characters / charsPerToken)`. The UI labels every figure as
  estimated.
- The word dictionary is deliberately conservative — when in doubt it keeps
  the original word — so meaning is always preserved at the cost of
  occasionally missing a possible saving.
- Savings come from common long words. Prompts already written tersely will
  see little change; that is expected and correct.

---

## Deploying to production

Promptimizer is **two deployable units**: a static frontend and an API server.
Deploy them separately and connect them with one environment variable.

### Step 1 — Deploy the backend

Pick **one** of these:

**Option A · Render (recommended — runs the Express server unchanged)**

1. Push this repo to GitHub.
2. On [render.com](https://render.com): **New → Web Service**, connect the repo.
3. Settings: **Root Directory** `backend`, **Build Command** `npm install`,
   **Start Command** `npm start`. (Render injects `PORT` automatically.)
4. Deploy. Note the URL, e.g. `https://promptimizer-api.onrender.com`.

> Render's free tier sleeps after 15 min of inactivity, so the first request
> after a pause takes ~30–60 s to wake up. Fine for demos; the $7/mo tier
> removes the sleep for real users.

**Option B · Vercel (runs the API as serverless functions)**

The repo already includes `backend/vercel.json` and `backend/api/index.js`.
On Vercel: **New Project**, set **Root Directory** to `backend`, deploy.

> The optimizer is fully offline (no external API), so it runs identically
> whether on Render or as a serverless function.

### Step 2 — Deploy the frontend

On **Vercel** or **Netlify**: New Project → connect the repo, then set
**Root Directory** to `frontend`. Build settings are auto-detected (Vite):
build command `npm run build`, output directory `dist`.

Before the build finishes, add **one environment variable**:

| Key             | Value                                            |
| --------------- | ------------------------------------------------ |
| `VITE_API_BASE` | your backend URL from Step 1 (no trailing slash) |

That's it — the frontend will call your live backend instead of the dev proxy.

### Step 3 (optional) — Lock down CORS

By default the API accepts requests from any origin. To restrict it to your
deployed frontend, set a `CORS_ORIGIN` env var on the backend, e.g.
`CORS_ORIGIN=https://promptimizer.vercel.app`.

### Cost summary

Everything above runs on **free tiers**. The only practical limit is the
backend free tier "cold start" — pay ~$7/month (Render) if you need the API
to respond instantly for real users.
