# OneSheet 핸드오프

작성 시점: 2026-08-06 · 브랜치 `cursor/rhythm-inherit-4663`

철학: **write simple play loop** — 빈 차트에서 쓰고, 바로 듣고, 루프한다.

---

## 기본값

- 코드 슬롯 **비움** (채우지 않은 칸은 쉼)
- 메트로놈 **off**, 클릭 gain `0.32`

## 화성 (DEG)

- **위 8**: 근음 도수 I…vii° + ∅
- **아래**: 근음 기준 **상대도수 축** 1…7 (8칸 중 7)
- 클릭 = **단 → 장(·완전) → 해제** 순회 (한 축에 여러 의미)
- 순회 결과는 **채워진 슬롯 전부**에 거울
- 스태프/GRID = 구성음 → 심볼 즉시 반영

## 리듬 상속

- BASE / LINK / OWN

## MODE

| id | 기본 | 축 |
|----|------|-----|
| `strum` | ✅ | 오픈셰이프 + late |
| `piano` | | 전음 동시 |

## Persist

- `onesheet.sheet.v3`

```bash
npm test && npm run build
```
