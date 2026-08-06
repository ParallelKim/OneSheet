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

- 오픈셰이프 절대음 + `stack`/`late`(~12ms)
- **기본 SF** `gm_piano` (GM #0; `gm_acoustic_grand_piano`는 미등록 → 무음)
- 먼저 친 현 = 같은 길이만큼 먼저 끝 (`late`+동일 clip)
- hold 길수록 gain↓, `.decay`/`.sustain`으로 울리는 동안 작아짐
- D=저→고, U=고→저

```bash
npm test
npm run dev
```
