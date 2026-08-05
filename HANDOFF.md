# OneSheet 핸드오프

작성 시점: 2026-08-05 · 브랜치 `cursor/strudel-playback-4663`  
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
```

| 파일 | 역할 |
|------|------|
| `src/sheet.ts` | 모델 · `compileSheet` · `toStrudel` |
| `src/engine.ts` | init / evaluate 큐 / hush |
| `src/sheet.test.ts` | 변환 단위 테스트 |

- dim 코드 심볼은 `Bo` (`dim` 아님) — triads 딕셔너리
- 음색은 WebAudio 신스만 (soundfont 없음)
- 재생 중 편집 → `evaluateStrudel` 재평가 (직렬 큐)

```bash
npm test
npm run dev
```

---

## UI (요약)

LCD: 얇은 한 줄 차트 · transport · 4×4(차트/도수/리듬)  
리듬 셀: D/U/X/hold/rest

## 다음

- 플레이헤드 · 아르페지오 · 사운드 설득력 · 조성 UX
