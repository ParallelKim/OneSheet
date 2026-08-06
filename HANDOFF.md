# OneSheet 핸드오프

작성 시점: 2026-08-06 · 브랜치 `cursor/rhythm-inherit-4663`

---

## 리듬 상속 (PR5)

- **BASE** = 1마디(`rhythm`) — 전곡 기본 스트로크
- **LINK** = 2~4마디, override 없음 → BASE 상속
- **OWN** = 2~4마디 override — 첫 편집 시 fork, `USE BASE`로 되돌림
- UI: 스태프 밑줄(실선/점선) + 패드 dashed/opacity + `rhy-meta` 태그

## MODE

| id | 기본 | 축 |
|----|------|-----|
| `strum` | ✅ | 오픈셰이프 + late 쓸기 → GM clean |
| `piano` | | 오픈셰이프 전음 동시 → `gm_piano` |

## Persist

- `onesheet.sheet.v2` (v1 `rhythm[][]` → base+override 마이그레이션)

```bash
npm test
npm run build
npm run dev
```
