# Cursor Cloud specific instructions

세션 인수인계·제품 원칙은 **`HANDOFF.md`** 와 **`.cursor/rules/onesheet-paradigm.mdc`** 를 먼저 읽는다.

## App

OneSheet is a Vite + React + TypeScript SPA. Sound uses `@strudel/web` in the browser (Web Audio). There is no backend server.

Current UI: single 4×4 launchpad (chart / degree / rhythm lenses), LCD bar beads, metronome. See `HANDOFF.md`.

## Commands

- Install / refresh deps: `npm ci`
- Dev server: `npm run dev -- --host 0.0.0.0 --port 5173`
- Production build check: `npm run build`
- Preview build: `npm run preview -- --host 0.0.0.0 --port 4173`
- Hosting live deploy (local): `npm run deploy`
- Hosting preview channel (local): `npm run deploy:preview`

## Verify

1. Start the dev server and open `http://localhost:5173`.
2. Confirm 4×4 launchpad, LCD bar beads, degree/rhythm lenses, and transport (play / metronome / modes).
3. Click Play (browser gesture required for audio). Editing while playing should re-evaluate via Strudel.
4. Rhythm mode: select a bar in LCD, paint D/U/X/hold/rest on the 16th grid.

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
