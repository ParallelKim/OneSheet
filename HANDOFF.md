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
  degrees[]      64스텝            MODE 분기
  rhythm[][]                       · block → setcps+chord+saw (차트)
  bpm/metro                        · example → docs 원문 그대로
  soundMode
```

| 파일 | 역할 |
|------|------|
| `src/sheet.ts` | 모델 · `compileSheet` · `toStrudel` · SOUND_MODES |
| `src/engine.ts` | init / GM·dirt prebake / evaluate 큐 / hush |
| `src/sheet.test.ts` | 변환 단위 테스트 |

- dim 코드 심볼은 `Bo` (`dim` 아님) — triads 딕셔너리
- **기본**: `soundMode: "block"` — 차트 동시 보이싱 + sawtooth
- **예제 MODE**: strudel.cc 원문 복제. 차트/BPM/메트로 **개입 없음**
- AudioContext: Play에서 명시 resume
- 재생 중 편집 → `evaluateStrudel` 재평가 (직렬 큐)

```bash
npm test
npm run dev
```

---

## UI (요약)

LCD: KEY · MODE · BPM · transport · 4×4(차트/도수/리듬)  
MODE: block → note → scale → arp → n4 → clip → gtr → …

## soundMode

| id | LCD | kind | 출처 |
|----|-----|------|------|
| `block` | block | chart | 제품 기본 |
| `ex-note` | note | example | [recipes](https://strudel.cc/recipes/recipes/) note arp |
| `ex-scale` | scale | example | recipes scale arp |
| `ex-arp` | arp | example | recipes chord+voicing arp |
| `ex-n4` | n4 | example | [tonal](https://strudel.cc/learn/tonal/) n+chord |
| `ex-clip` | clip | example | [voicings](https://strudel.cc/understand/voicings/) n+clip |
| `ex-gtr` | gtr | example | [samples](https://strudel.cc/learn/samples/) dirt gtr+moog |

피드백: 원문이 기대대로 들리는지 / 어떤 축을 차트에 옮길지.

## 다음

1. 예제 청취로 **기준선** 확정 (해석 금지)
2. 괜찮은 축만 차트(도수·D/U·hold)에 **한 겹씩** 매핑
3. 조성 UX · 음색 UI는 주법·지속 이후

## 학습 기록

| 시도 | 결과 |
|------|------|
| 조사→차트에 번역한 MODE (쓸기+`~`) | 대부분 기대와 불일치. `~`=침묵인데 링으로 오용 |
| arp 번역본 | 기대와 가까움 (recipes에 가장 근접) ≠ 채택 |
| **예제 원문 복제** (현재) | 기준선 먼저. 그다음 매핑 |

원칙:
1. 예제를 듣고 나서 번역한다
2. hold 링에 `~`를 쓰지 않는다
3. GM `:5`·dirt 단일 WAV는 **원문에 있을 때만** (지금은 recipes 원문 유지)
