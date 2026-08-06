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
  soundMode                         block | strum-* | arp | dirt
```

| 파일 | 역할 |
|------|------|
| `src/sheet.ts` | 모델 · `compileSheet` · `toStrudel` · soundMode |
| `src/engine.ts` | init / GM·dirt prebake / evaluate 큐 / hush |
| `src/sheet.test.ts` | 변환 단위 테스트 |

- dim 코드 심볼은 `Bo` (`dim` 아님) — triads 딕셔너리
- **기본 음색**: `soundMode: "block"` — 동시 보이싱 + sawtooth + `clip(0.95)`
- 실험 모드는 LCD **MODE** 칩으로 순환 (피드백용, 제품 톤 시스템 아님)
- AudioContext: Play에서 명시 resume
- 재생 중 편집 → `evaluateStrudel` 재평가 (직렬 큐)
- **플레이헤드**: Guitar Pro식 세로 커서(`--play-phase`) + 마디 밴드(`--mark-bar`)

```bash
npm test
npm run dev
```

---

## UI (요약)

LCD: KEY · MODE · BPM · transport · 4×4(차트/도수/리듬)  
리듬 셀: D/U/X/hold/rest  
MODE: block → strum → gm → arp → dirt → …

## soundMode (청취 A/B)

| id | LCD | 의도 |
|----|-----|------|
| `block` | block | **기본.** 동시 보이싱+saw. 피아노감 기준선 |
| `strum-saw` | strum | D/U 짧은 쓸기 창 + saw + `clip(2)` |
| `strum-gm` | gm | 같은 쓸기 + `gm_electric_guitar_clean:5` + `above:c3` |
| `arp-saw` | arp | D/U를 hold 전체에 펼침 (아르페지오) |
| `dirt` | dirt | 단일 `gtr` WAV + 쓸기 (다중 WAV 금지) |

피드백 질문: 무엇이 이상한지 / 괜찮은지 — 주법(쓸기·링) vs 음색(바디)을 구분해서.

## 다음

- 유저 청취 피드백으로 모드 축소 → 주법 축 확정
- 조성 UX
- 음색 UI는 주법·지속이 선 뒤에

## 학습 기록 — 기타 보이싱

동시 타현은 기타감이 아니다. 올바른 축은 **쓸기 방향 + 짧은 창 + 링**.

| 시도 | 결과 |
|------|------|
| `chord`+`voicing`만 (block) | 모든 음 동시 → 피아노감. D/U 구분 약함 |
| `n("0 1 2 3")` 스트럼 + GM | 방향은 맞으나 pluck+`~`면 고무줄, 뱅크 0은 얇음 |
| dirt `gtr` 다중 WAV + 스트럼 n | `n`이 샘플 인덱스로 겹침 → 묵음/깨짐 |
| SOUND 톤 나열 | 주법 축을 음색으로 위장. 시기상조 |

원칙 (구현 시):
1. D=`0→3`, U=`3→0`을 **짧은 쓸기 창**에 몰기 (Tidal `rolled`)
2. hold는 **음이 죽지 않게** (legato/`clip` — `~`로 링을 지우지 말 것)
3. GM은 `:5` 뱅크 고정 (voicing 후 `n` 클리어 → 뱅크 0 방지)
4. dirt `gtr`는 **단일 WAV**만

## 조사 요약 — Strudel에서 현실적 기타

(제품에 붙이기 전 레퍼런스. 연동 대상 아님.)

### 공식·레시피에서 쓰는 축
- **스트럼**: `n("[0 1 2 3]")` / `n("[3 2 1 0]")` + `chord` + `voicing` — 방향 = n 순서
- **음역**: `.mode("above:c3")` 등으로 기타 존
- **음색 후보**: GM `gm_electric_guitar_clean:5`(Strat), steel/nylon `:5`(LK); dirt `gtr` 단일 WAV+피치
- **지속**: 샘플 pluck은 짧음 → `clip`/레가토로 링을 흉내. `~`는 침묵이지 링이 아님

### 함정
| 함정 | 왜 |
|------|-----|
| 블록 보이싱만 | 피아노/패드감 |
| GM 뱅크 생략 (`:0`) | voicing 후 n 소실 → 얇은 Aspirin 등 |
| dirt 다중 WAV + strum n | n = 샘플 인덱스 충돌 |
| 짧은 이벤트 + `~` hold | 고무줄 pluck |
| 음색 UI 먼저 | 주법 축을 가림 |

### OneSheet에 맞는 분해
- **주법 축** (먼저): D/U 쓸기 창 + 링
- **바디 축** (나중): saw / GM / dirt 중 하나
- 실험 MODE는 두 축을 **분리해서 듣게** 하기 위한 임시 렌즈
