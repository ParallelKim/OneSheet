# OneSheet 핸드오프

다음 세션 에이전트/인간을 위한 인수인계.  
작성 시점: 2026-08-05 · 브랜치 `cursor/onesheet-mvp-38fc` · HEAD `f39fbc9`  
PR: https://github.com/ParallelKim/OneSheet/pull/1 · base `main`

---

## 1. 제품이 무엇인가

**OneSheet** = Teenage Engineering에 영감받은 **기타 악보 편집/재생기**.

- 슬로건/정체성: 장난감처럼 만지고, 바로 들어보는 **한 장 차트**
- 소리·문법은 **Strudel** (`@strudel/web`)이 담당
- OneSheet의 질문은 “Strudel을 연동하느냐”가 아니라 **그 문법을 얼마나 직관적으로 만지게 하느냐**

필수 규칙: `.cursor/rules/onesheet-paradigm.mdc` (`alwaysApply: true`)

---

## 2. 절대 잊지 말 것 (이 세션에서 확정된 원칙)

1. **코드는 현상**이다. 정체성에 안 맞으면 백지화한다. 매몰비용으로 틀린 뼈대를 살리지 않는다.
2. **간단 > 복잡**. 더하기 전에 빼라.
3. **TE 복제 ≠ TE 접근**. PO PCB/16패드 실크/기능을 베끼지 마라. 빌릴 것은 렌즈·색=매핑·즉시 반응·제약이다.
4. **해체 루프**로 설계한다:
   - 지금 고르는 척하는 것 → 음악적 기준 있나? → 자동 결정되면 UI에서 빼라 → 남은 축만 토글/프리셋/고정 슬롯
5. **카피는 사용자 문장 복붙이 아니다.** 입력 표현을 라벨로 쓰지 말고 제품 용어로 다시 쓴다.
6. **재료(차트)는 문맥에 가두지 않는다.** 모드는 팔레트만 바꾼다.
7. 응답/UI는 **한국어** 우선.

---

## 3. 현재 UI / 모델 (구현된 상태)

### 화면 구조
- **상단**: 브랜드 · 선택 위치(마디·박) · 조성/음색/BPM 칩
- **본체**: **4×4 차트** (항상 보임)
  - **행 = 마디**, **칸 = 4분음표** (4/4, 총 16칸)
- **팔레트**: transport 모드에 따라
  - **도수**: I–vii° + rest (메이저 다이아토닉; 화음 타입은 도수가 결정)
  - **진행**: Pop/50s/Canon… 프리셋 (한 마디 패턴을 4마디에 반복)
- **하단 transport row (공통)**: `재생` · `메트로놈` · `도수` · `진행`

### 데이터 (`src/sheet.ts`)
```ts
SheetState = {
  bpm, key,           // 메이저 조만 (C G D A E F Bb)
  degrees: (number|null)[16],  // 0–6 diatonic or rest
  voice, gain,        // 웜/샤프/소프트/피아노 → sound+cutoff
  metro: boolean
}
```
- `toStrudel()`: `setcps(bpm/60/16)` + `chord("<…>")` + (옵션) woodblock 메트로놈
- **드럼/그루브/bd·sd·hh 없음** — 의도적으로 제거됨

### 엔진 (`src/engine.ts`)
- `initStrudelEngine` / `evaluateStrudel` / `hushStrudel`
- 재생 중 편집 → `evaluate` 재평가 (즉시 반영)

### 기타
- Vite + React + TS, 폰트: Fraunces + Pretendard + IBM Plex Mono
- Firebase analytics/hosting 설정은 레포에 있으나, 이번 UI 재설계와 무관. Hosting 시크릿/배포는 미완일 수 있음.

---

## 4. 버려진 길 (다시 가지 말 것)

| 시도 | 왜 버려졌나 |
|------|------------|
| PO PCB/실크 코스프레 | 외형 복제. 접근이 아님 |
| Part/Form 대시보드식 다크 UI | 장난감·한 장 감각 없음 |
| 레이어(H/B) + 렌즈 3개 + 미니노테이션 | 미니 DAW. 배우기 비용 큼 |
| 코드명 사이클 (Am→C→G…) | **기준 없음** |
| 근음×퀄리티(단/M/m/7/dim…) 전부 노출 | 정확하나 제품(다이아토닉 차트)에 과함 |
| bd→sd→hh 리듬 사이클 / 그루브 그리드 | 기타 차트 정체성과 안 맞음. 스트럼이 리듬을 담당한다는 합의 |

---

## 5. 해체로 얻은 공식 (재사용)

**코드**
- ❌ 나열/사이클/타입 직접 고르기  
- ✅ `조성(제약) → 도수 토글 → 진행 프리셋`

**시간/리듬**
- ❌ 드럼 머신  
- ✅ `타임그리드(4×4 4분) + 메트로놈`  
- 기타 리듬감은 앞으로 **주법(스트럼)** 축으로

**공통 조작**
- ✅ 재생·메트로놈·모드 = **하나의 transport row**

---

## 6. 다음 세션 후보 (우선순위 제안)

1. **주법 해체**  
   - 지금 `음색`(웜/샤프/파형)은 기술 축에 가깝다.  
   - 후보: 스트럼 / 아르페지오 / 패드 → Strudel 패턴으로 매핑.  
2. **재생 피드백**  
   - 재생 중 현재 칸(플레이헤드) 하이라이트.  
3. **조성 UX**  
   - 키 사이클 → 카포/오도원 등 기타 메타포.  
4. **사운드 품질**  
   - woodblock 메트로놈·chord voicing이 실제 기기에서 설득력 있는지 검증.  
5. **Firebase Hosting**  
   - preview/live 배포, GitHub Secret, 사이트 ID(`onesheet-app` vs `one-sheet-play`) 정리.  
6. **모바일 실사용**  
   - transport/팔레트 간격, 터치 타겟, 가로 스크롤 없는지.

기능을 더하기 전에 **해체 루프**를 한 번 더 돌릴 것.

---

## 7. 로컬 명령

```bash
npm ci
npm run dev      # :5173
npm run build
```

브랜치: 이미 `cursor/onesheet-mvp-38fc` 작업 중. 새 작업도 `cursor/<name>-38fc` 패턴 유지.

스크린샷 참고 (에이전트 아티팩트):
- `/opt/cursor/artifacts/screenshots/22-transport-fixed.png` — 현재 transport + 4×4

---

## 8. 핵심 파일

| 경로 | 역할 |
|------|------|
| `.cursor/rules/onesheet-paradigm.mdc` | 사고 패러다임 + 해체 원칙 |
| `src/sheet.ts` | 차트 모델 · 도수 · 프리셋 · `toStrudel` |
| `src/App.tsx` | UI · transport · 팔레트 |
| `src/App.css` | 서피스 |
| `src/engine.ts` | Strudel evaluate/hush |
| `README.md` | 정체성만 (기술 나열 금지) |

---

## 9. 한 줄 인수인계

> OneSheet는 PO를 베끼는 앱이 아니라, **해체로 진짜 축만 남긴 기타 차트**다. 지금은 **4×4 4분음표 + 다이아토닉 도수 + 메트로놈 + transport**다. 다음은 쌓지 말고, **주법·조성·재생 피드백**을 같은 칼로 잘라라.
