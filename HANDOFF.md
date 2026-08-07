# OneSheet 핸드오프

작성 시점: 2026-08-06 · 브랜치 `cursor/rhythm-inherit-4663`

철학: **write simple play loop** — 빈 차트에서 쓰고, 바로 듣고, 루프한다.

## UX — 상태 전환

상태는 점프하지 않고 **전환으로** 바뀐다. 아르카나는 **한** 사례(양극 회전)일 뿐.
2상태(on/off)도 전환 — 메타포는 기능·UI가 고른다: 뒤집힘 / 밀림 / **점등** / **상승·하강**.
why 없는 motion은 스타일링. 소리(PLAY/STOP)도 같은 축.
후보: 렌즈, transport, 메트로, 키, 프리셋 순회, 패드 on/off.

---

## 기본값

- 코드 슬롯 **비움** (채우지 않은 칸은 쉼)
- 메트로놈 **off**, 클릭 gain `0.32`

## 조성

- 5도권 12조: `C G D A E B F# Db Ab Eb Bb F`
- KEY **♭ / ♯** = 조표처럼 한 칸 (완전5도 ↓/↑)

- **위 8**: 근음 도수 I…vii° + ∅ (비우기는 ∅만)
- 같은 근음 재클릭 → 공통 순회: maj → min → 7 → m7 → add2 → sus4 (세부 구성음은 패드로)
- 선택 슬롯의 근음 패드 라벨이 현재 심볼로 갱신
- **아래**: 근음 기준 **상대도수 축** 1…7 (8칸 중 7)
- 클릭 = **단 → 장(·완전) → 해제** 순회 — **선택 슬롯만**
- 장·단 쌍 축 = **아르카나**: 가로선 구분, 역방향=단·정방향=장 (단도 없으면 양면 장도)
- 패드 임시표는 **♭/♯** (내부 id는 `b`/`#`)
- 스태프/GRID = 구성음 → 심볼 즉시 반영

## 리듬 상속

- BASE / LINK / OWN

## MODE

| id | 기본 | 축 |
|----|------|-----|
| `strum` | ✅ | 오픈셰이프 + late |
| `piano` | | 전음 동시 |

## Transport / 오디오

- PLAY: UI 위상 선부착 → 패턴 로드 → 스케줄러 start (사이클 0). 스트럼 폰트 워밍·latency 0.14
- STOP: epoch↑ + 마스터 gain duck(~30ms) + hush — 스케줄만 끊지 않고 잔향도 짧게 죽임
- 편집 중 재생: syncStart 없이 핫스왑

## Share (SheetDoc)

휴대용 채보 포맷 `SheetDoc` v1 — URL / 파일 / 서버 공통.

- 쿼리: `?s=<base64url(JSON)>` (우선 로드, 편집 시 `replaceState` 동기화)
- 필드: `v,bpm,key,metro,mode,gain?,deg[16],ton[16],rhy,ov[3]`
- 코드: `src/sheetDoc.ts`, 쿼리 어댑터 `src/shareQuery.ts`

```bash
npm test && npm run build
```
