# OneSheet 핸드오프

작성 시점: 2026-08-06 · 브랜치 `cursor/rhythm-inherit-4663`

철학: **write simple play loop** — 심플 & 루프. 모노톤 기본.

## UX — 상태 전환

상태는 점프하지 않고 **전환으로** 바뀐다. 아르카나는 **한** 사례(양극 회전)일 뿐.
**성격 경계(realm):** 영역 안 순회 ≠ 영역 넘김. 활성↔비활성(∅/`rest`)은 활성 안 프리셋 순회와 분리 (예: 옛 Maj/Min/dim 순회 분리와 같은 논리).
2상태도 전환 — 메타포는 기능·UI가 고른다. 어휘: **`docs/transition-vocabulary.md`** · 레퍼런스: **`docs/design-references.md`**

적용됨 (우선 후보):
- 메트로 armed → 점등 (`--dur-armed` + 추 `--point`)
- 리듬 rest↔hit → 점등 (bg/border)
- 차트·LCD 슬롯 empty↔채움 → opacity/스탬프감
- PLAY↔STOP → 글리프 크로스페이드
- KEY ♭/♯ → 반음 키 단위 순회 + 슬롯머신 롤 (표시 슬롯 **고정폭**)
- piano 사운드폰트도 워밍 (동시 다성 still-loading 스킵 완화)

---

## 기본값

- 코드 슬롯 **비움** (채우지 않은 칸은 쉼)
- 메트로놈 **off**, 클릭 gain `0.32`

## 조성

- 12조 **반음 키 단위**: `C Db D Eb E F F# G Ab A Bb B`
- KEY **♭ / ♯** = 한 키 아래/위 (예측 가능한 순회). 슬롯머신 롤 애니
- 5도권 배열(`CIRCLE_OF_FIFTHS`)은 참고용으로만 유지

- **위 8**: 근음 도수 I…vii° + ∅ (비우기는 ∅만 — 활성 순회와 분리)
- 같은 근음 재클릭 → 공통 순회: maj → min → 7 → m7 → add2 → sus4 (세부 구성음은 패드로)
  - 참고: 옛 Maj/Min/dim **영역별** 순회 분리 원칙은 살아 있음. 공통 목록은 편의; 영역 넘김 인지는 전환 UX로 보완할 후보.
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
