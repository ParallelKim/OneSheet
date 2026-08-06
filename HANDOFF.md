# OneSheet 핸드오프

작성 시점: 2026-08-06 · 브랜치 `cursor/strudel-playback-4663`  
base `main` · PR3 (재생 파이프라인)

---

## 제품

기타 차트 편집/재생기. UI는 런치패드 렌즈, 소리는 Strudel.

---

## 재생 파이프라인

```
SheetState  →  compileSheet()  →  toStrudel()  →  evaluateStrudel()
  degrees[]      64스텝            MODE:
  rhythm[][]                       · block / arp / gm → 차트 리듬·코드·BPM
  bpm/metro                        · docs → recipes 원문 (차트 무시)
  soundMode
```

| 파일 | 역할 |
|------|------|
| `src/sheet.ts` | 모델 · compile · toStrudel · SOUND_MODES |
| `src/engine.ts` | init / GM·dirt / evaluate 큐 |
| `src/sheet.test.ts` | 단위 테스트 |

```bash
npm test
npm run dev
```

---

## MODE (청취 비교)

같은 차트로 돌리고, **한 축만** 바꾼다.

| id | LCD | 축 | 리듬 |
|----|-----|-----|------|
| `block` | block | 한꺼번에 (동시) + saw | ✅ 차트 |
| `arp` | arp | 한 음씩 D↓U↑ + saw | ✅ 차트 |
| `gm` | gm | 한 음씩 D↓U↑ + GM `:5` | ✅ 차트 |
| `docs` | docs | recipes 원문 1개 | ❌ 무시 |

비교 방법: Play → 리듬 셀 바꾸며 block↔arp → 바디만 gm → docs는 기준선.

## 학습

| 시도 | 결과 |
|------|------|
| 쓸기+`~` 번역 | 기대 불일치 |
| docs 원문만 여러 개 | 리듬 미반영 · 서로 비슷해 차이 안 들림 |
| **소수 MODE + 차트 공유** (현재) | 주법(block/arp) vs 바디(gm) vs 원문(docs) |

원칙: hold 링에 `~` 금지. docs는 하나만. 쓸기(짧은 창)는 아직 없음 — arp(펼침)만.
