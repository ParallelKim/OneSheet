# OneSheet 핸드오프

작성 시점: 2026-08-06 · 브랜치 `cursor/strudel-playback-4663`  
base `main` · PR3 (재생 파이프라인)

---

## 제품

기타 차트 편집/재생기. UI는 런치패드 렌즈, 소리는 Strudel.

---

## 재생 파이프라인 (핵심)

```
SheetState  →  compileSheet()  →  toStrudel()  →  evaluateStrudel()
  degrees[]      64스텝 시퀀스      setcps+chord      @strudel/web
  rhythm[][]     clip/gain          .dict.triads
  bpm/metro                         .voicing()
                                    sawtooth (단일)
```

| 파일 | 역할 |
|------|------|
| `src/sheet.ts` | 모델 · `compileSheet` · `toStrudel` |
| `src/engine.ts` | init / evaluate 큐 / hush · AudioContext resume |
| `src/sheet.test.ts` | 변환 단위 테스트 |

- dim 코드 심볼은 `Bo` (`dim` 아님) — triads 딕셔너리
- 음색: **단일 sawtooth** (GM/SOUND 톤 순회·dirt 샘플 보류)
  - hold = 이벤트 `@길이`로 지속 (고무줄 pluck 아님)
  - D/U/X는 gain·길이만 (스트럼 n 분리는 보류)
- AudioContext: Play에서 명시 resume
- 재생 중 편집 → `evaluateStrudel` 재평가 (직렬 큐)
- **플레이헤드**: Guitar Pro식 세로 커서(`--play-phase`) + 마디 밴드(`--mark-bar`). 선택은 셀 배경·글자 반전.

```bash
npm test
npm run dev
```

---

## UI (요약)

LCD: KEY · BPM · transport · 4×4(차트/도수/리듬)  
리듬 셀: D/U/X/hold/rest

## 다음

- 스트럼(D/U) 설득력 · 조성 UX · 음색은 지속이 되는 축부터
