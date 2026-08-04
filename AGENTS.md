# Cursor Cloud specific instructions

## App

OneSheet is a Vite + React + TypeScript SPA. Sound uses `@strudel/web` in the browser (Web Audio). There is no backend server.

## Commands

- Install / refresh deps: `npm ci`
- Dev server: `npm run dev -- --host 0.0.0.0 --port 5173`
- Production build check: `npm run build`
- Preview build: `npm run preview -- --host 0.0.0.0 --port 4173`

## Verify

1. Start the dev server and open `http://localhost:5173`.
2. Confirm Parts / Form / Play UI render.
3. Click Play (browser gesture required for audio). Editing chords while playing should re-evaluate via Strudel.

## Firebase

Hosting preview deploys via GitHub Actions (`onesheet-app`). Local Firebase CLI is optional; do not block agent work on missing Firebase credentials.
