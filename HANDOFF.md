# OneSheet 핸드오프

작성 시점: 2026-08-06 · 브랜치 `cursor/strudel-playback-4663`

---

## MODE

| id | 기본 | 축 |
|----|------|-----|
| `strum` | ✅ | 오픈셰이프 + late 쓸기 → GM clean |
| `piano` | | 오픈셰이프 전음 동시 → `gm_piano` |

docs / arp / gm / block 제거. MODE 칩으로 strum ↔ piano.

### strum

- `stack`/`late`(~8ms), late만큼 clip↓
- 코드마다 5~6음 (C/Am 오픈은 6번줄 뮤트)
- 피치별 gain: 저현↓ / 1번줄↑ + `hpf`
- D=저→고, U=고→저

### piano

- `note("a2,e3,a3,c4,e4")` 동시 타건
- 차트 리듬·오픈셰이프 공유, late 없음

```bash
npm test
npm run build
npm run dev
```
