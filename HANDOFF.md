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

- **주법(우선)**: D/U를 동시타가 아닌 쓸기+링으로 — paradigm「주법 · 보이싱」참고
- 조성 UX
- 음색(바디)은 주법·지속이 선 뒤에

## 학습 기록 — 기타 보이싱 (구현 보류)

동시 타현은 기타감이 아니다. 올바른 축은 **쓸기 방향 + 짧은 창 + 링**.

| 시도 | 결과 |
|------|------|
| `chord`+`voicing`만 (현재) | 모든 음 동시 → 피아노감. D/U 구분 약함 |
| `n("0 1 2 3")` 스트럼 + GM | 방향은 맞으나 pluck+`~`면 고무줄, 뱅크 0은 얇음 |
| dirt `gtr` 다중 WAV + 스트럼 n | `n`이 샘플 인덱스로 겹침 → 묵음/깨짐 |
| SOUND 톤 나열 | 주법 축을 음색으로 위장. 시기상조 |

다음에 손댈 때:
1. D=`0→3`, U=`3→0`을 **짧은 쓸기 창**에 몰기 (Tidal `rolled` 축)
2. hold 구간은 **음이 죽지 않게** (legato/clip — `~`로 링을 지우지 말 것)
3. 음색 UI는 그 후. 단일 톤 유지가 기본
