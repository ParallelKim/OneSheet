# OneSheet 핸드오프

작성 시점: 2026-08-06 · 브랜치 `cursor/strudel-playback-4663`

---

## MODE

| id | 축 |
|----|-----|
| `block` | 한꺼번에 + saw |
| `strum` | **오픈셰이프 note + late 쓸기→링** + GM |
| `arp` / `gm` | recipes식 한 음씩 펼침 |
| `docs` | recipes 원문 |

### strum

- Strudel 공식에 기타 오픈 스트럼 예제 없음 → MIDI-guitar 관례(오픈 셰이프) 사용
- `guitarShape("C")` = `c3 e3 g3 c4 e4` (6현 뮤트)
- `stack(note(..), note(..).late(Δ), …)` — onset만 ms 단위, 길이는 hold(`clip~0.95`)
- D=저→고, U=고→저. 임의 `0 4 7…` / `gtr6` dict 폐기

```bash
npm test
npm run dev
```
