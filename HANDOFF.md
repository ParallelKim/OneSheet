# OneSheet 핸드오프

작성 시점: 2026-08-06 · 브랜치 `cursor/rhythm-inherit-4663`

---

## 화성 (DEG)

- **위 8**: 근음 도수 I…vii° + ∅
- **아래 8**: 근음 기준 구성음 토글 — 음이름만 표시 (`G B D` …)
- 기본: 도수 다이아토닉 퀄리티 (V→1·3·5, ii→1·b3·5)
- 스태프/GRID 라벨 = 구성음에서 즉시 심볼화 (E, Fm, G7…)
- 셀: `degrees[]` + `tones[]`

## 리듬 상속

- BASE / LINK / OWN (1마디 상속, override fork, USE BASE)

## MODE

| id | 기본 | 축 |
|----|------|-----|
| `strum` | ✅ | 오픈셰이프 + late 쓸기 |
| `piano` | | 전음 동시 |

## Persist

- `onesheet.sheet.v3` (tones). v1/v2 마이그레이션

```bash
npm test && npm run build
```
