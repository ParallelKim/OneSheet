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

- 오픈셰이프 절대음 + `stack`/`late`(~8ms)
- **GM clean** `gm_electric_guitar_clean:5`
- 코드마다 5~6음 (C/Am 오픈은 6번줄 뮤트)
- late만큼 clip↓ → 다음 코드로 안 밀림
- 피치별 gain: 저현↓ / **1번줄(e4~)↑**
- `hpf` + decay/sustain
- D=저→고, U=고→저

```bash
npm test
npm run dev
```
