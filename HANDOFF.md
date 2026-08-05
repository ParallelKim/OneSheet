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
  degrees[]      64스텝 시퀀스      setcps+n+chord   @strudel/web
  rhythm[][]     art/clip/gain      .dict.triads     + soundfonts
  bpm/metro                         .voicing()
                                    GM guitar s()
```

| 파일 | 역할 |
|------|------|
| `src/sheet.ts` | 모델 · `compileSheet` · `toStrudel` · 스트럼 n |
| `src/engine.ts` | init(+registerSoundfonts) / evaluate 큐 / hush |
| `src/sheet.test.ts` | 변환 단위 테스트 |

- dim 코드 심볼은 `Bo` (`dim` 아님) — triads 딕셔너리
- 음색: `@strudel/soundfonts` GM 기타 (steel/nylon/clean). X는 `gm_electric_guitar_muted`
- 주법: D=`n([0 1 2 3])` 다운스트럼, U=`n([3 2 1 0])` 업, X=동시타+짧은 clip
- Play → 샘플 프리로드(스피너 LOAD) → 재생. 로딩 중 다시 누르면 취소
- 재생 중 편집 → `evaluateStrudel` 재평가 (직렬 큐)
- **플레이헤드**: Guitar Pro식 세로 커서(`--play-phase`) + 마디 밴드(`--mark-bar`). 선택은 셀 배경·글자 반전.

```bash
npm test
npm run dev
```

---

## UI (요약)

LCD: 얇은 한 줄 차트 · transport · 4×4(차트/도수/리듬)  
리듬 셀: D/U/X/hold/rest

## 다음

- 조성 UX · 바디(nylon/steel) UI · 아르페지오 프리셋
