# Cursor Cloud specific instructions

## App

OneSheet is a Vite + React + TypeScript SPA. Sound uses `@strudel/web` in the browser (Web Audio). There is no backend server.

## Commands

- Install / refresh deps: `npm ci`
- Dev server: `npm run dev -- --host 0.0.0.0 --port 5173`
- Production build check: `npm run build`
- Preview build: `npm run preview -- --host 0.0.0.0 --port 4173`
- Hosting live deploy (local): `npm run deploy`
- Hosting preview channel (local): `npm run deploy:preview`

## Verify

1. Start the dev server and open `http://localhost:5173`.
2. Confirm Parts / Form / Play UI render.
3. Click Play (browser gesture required for audio). Editing chords while playing should re-evaluate via Strudel.

## Firebase Hosting

Project/site: `onesheet-app`  
Live URL: https://onesheet-app.web.app

Repo already has `firebase.json`, `.firebaserc`, and GitHub Actions workflows.
PR preview / live deploy need this GitHub Actions secret:

- Name: `FIREBASE_SERVICE_ACCOUNT_ONESHEET_APP`
- Value: Firebase service account JSON with Hosting Admin

Create it locally (recommended):

```bash
firebase login
firebase init hosting:github
```

Or paste a service-account JSON into the repo secret manually.
Without that secret, Hosting Action jobs fail by design.

Do not block other agent work on missing Firebase deploy credentials.
