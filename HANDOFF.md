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
- **GM clean** `gm_electric_guitar_clean:5` (피아노 SF는 톤이 안 맞음)
- late만큼 clip↓ → 먼저 친 현이 먼저 끝 (다음 코드로 안 밀림)
- 피치별 gain↓(저현) + `hpf` — 코드 전환 시 베이스 마스킹 완화
- hold 길수록 gain↓, `.decay`/`.sustain`
- D=저→고, U=고→저

```bash
npm test
npm run dev
```
