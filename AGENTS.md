# Cursor Cloud specific instructions

세션 인수인계·제품 원칙은 **`HANDOFF.md`** 와 **`.cursor/rules/onesheet-paradigm.mdc`** 를 먼저 읽는다.

## App

OneSheet is a Vite + React + TypeScript SPA. Sound uses `@strudel/web` in the browser (Web Audio). There is no backend server.

Current UI: single 4×4 launchpad (chart / degree / rhythm lenses), LCD bar beads, metronome. See `HANDOFF.md`.

## Commands

- Install / refresh deps: `npm ci`
- Dev server: `npm run dev -- --host 0.0.0.0 --port 5173`
- Unit tests (toStrudel): `npm test`
- Production build check: `npm run build`
- Preview build: `npm run preview -- --host 0.0.0.0 --port 4173`
- Hosting live deploy (local): `npm run deploy`
- Hosting preview channel (local): `npm run deploy:preview`

## Verify (에이전트)

시각·브라우저 확인은 **사람이 한다.** 에이전트는 computerUse / 브라우저 GUI / 화면 녹화로 검증하지 않는다.

1. `npm test` — SheetState → Strudel 변환
2. `npm run build` — 타입·번들
3. (선택) `npm run dev -- --host 0.0.0.0 --port 5173` 기동만 — UI 클릭·스크린샷 불필요

## Verify (사람)

1. Dev server → `http://localhost:5173` (심플) · `/studio` (스튜디오 직접)
2. 4×4 · LCD · DEG/RHY · transport · 재생(제스처 필요)
3. RHY: LCD 마디 선택 후 16분 그리드에 D/U/X/hold/rest
4. 스튜디오: 슬롯·CHAIN · 심플과 인앱 플립 없음

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
