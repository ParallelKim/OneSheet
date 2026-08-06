import { describe, expect, it } from "vitest";
import {
  chordFromDegree,
  compileSheet,
  createInitialSheet,
  cyclesPerSecond,
  holdRun,
  MUTE_SOUND,
  nextSound,
  strumN,
  toStrudel,
  type Articulation,
  type SheetState,
} from "./sheet";

describe("chordFromDegree", () => {
  it("메이저/마이너/디민 심볼을 Strudel triads 딕셔너리에 맞게 낸다", () => {
    expect(chordFromDegree("C", 0)).toBe("C");
    expect(chordFromDegree("C", 1)).toBe("Dm");
    expect(chordFromDegree("C", 5)).toBe("Am");
    expect(chordFromDegree("C", 6)).toBe("Bo");
  });

  it("조성에 따라 근음이 바뀐다", () => {
    expect(chordFromDegree("G", 0)).toBe("G");
    expect(chordFromDegree("G", 4)).toBe("D");
    expect(chordFromDegree("F", 6)).toBe("Eo");
  });
});

describe("holdRun", () => {
  it("공격 뒤 hold만 센다", () => {
    const bar: Articulation[] = ["D", "hold", "hold", "hold", "U", "hold", "rest", "rest"];
    expect(holdRun(bar, 0)).toBe(3);
    expect(holdRun(bar, 4)).toBe(1);
  });
});

describe("nextSound", () => {
  it("steel → nylon → clean → saw → square → tri → steel", () => {
    expect(nextSound("steel")).toBe("nylon");
    expect(nextSound("nylon")).toBe("clean");
    expect(nextSound("clean")).toBe("saw");
    expect(nextSound("saw")).toBe("square");
    expect(nextSound("square")).toBe("tri");
    expect(nextSound("tri")).toBe("steel");
  });
});

describe("strumN", () => {
  it("D는 저→고, U는 고→저, X는 동시", () => {
    expect(strumN("D", 1)).toBe("[0 1 2 3]");
    expect(strumN("U", 1)).toBe("[3 2 1 0]");
    expect(strumN("X", 1)).toBe("[0,1,2]");
  });

  it("길면 첫 16분에 몰고 나머지는 링", () => {
    expect(strumN("D", 4)).toBe("[[0 1 2 3]@1 ~@3]@4");
    expect(strumN("U", 2)).toBe("[[3 2 1 0]@1 ~@1]@2");
  });
});

describe("compileSheet / toStrudel", () => {
  it("초기 차트는 4분 다운을 @4 이벤트로 만든다", () => {
    const sheet = createInitialSheet();
    const parts = compileSheet(sheet);
    expect(parts.totalSteps).toBe(64);
    expect(parts.hasHits).toBe(true);
    expect(parts.cps).toBeCloseTo(cyclesPerSecond(96));
    expect(parts.events.filter((e) => e.chord !== null)).toHaveLength(16);
    expect(parts.events.every((e) => e.chord === null || e.steps === 4)).toBe(true);
    expect(parts.preset.id).toBe("clean");
  });

  it("D·U· 패턴은 박마다 공격 2개(@2)", () => {
    const sheet = createInitialSheet();
    const bar: Articulation[] = Array.from({ length: 16 }, (_, i) => {
      const sub = i % 4;
      if (sub === 0) return "D";
      if (sub === 2) return "U";
      return "hold";
    });
    sheet.rhythm = [bar, bar, bar, bar];
    const parts = compileSheet(sheet);
    const hits = parts.events.filter((e) => e.chord !== null);
    expect(hits).toHaveLength(32);
    expect(hits.every((e) => e.steps === 2)).toBe(true);
    expect(hits.filter((e) => e.art === "D")).toHaveLength(16);
    expect(hits.filter((e) => e.art === "U")).toHaveLength(16);
  });

  it("도수·리듬이 모두 비면 silence", () => {
    const sheet: SheetState = {
      ...createInitialSheet(),
      degrees: Array(16).fill(null),
      metro: false,
    };
    expect(toStrudel(sheet)).toBe("silence");
  });

  it("메트로만 켜도 클릭 레이어가 나온다", () => {
    const sheet: SheetState = {
      ...createInitialSheet(),
      degrees: Array(16).fill(null),
      metro: true,
    };
    const code = toStrudel(sheet);
    expect(code).toContain("setcps(");
    expect(code).toContain("note(\"c6 a5 a5 a5");
    expect(code).toContain('.s("square")');
    expect(code).not.toContain("chord(");
  });

  it("코드 재생은 스트럼 n·기타 음역·voicing을 포함한다", () => {
    const code = toStrudel(createInitialSheet());
    expect(code).toMatch(/^setcps\(/);
    expect(code).toContain('n("[[0 1 2 3]@1 ~@3]@4');
    expect(code).toContain('chord("Am@4');
    expect(code).toContain('.dict("triads")');
    expect(code).toContain('.mode("above:c3")');
    expect(code).toContain(".voicing()");
    expect(code).toContain("gm_electric_guitar_clean:5");
    expect(code).toContain('.s("square")');
  });

  it("X는 뮤트 샘플과 짧은 clip", () => {
    const sheet = createInitialSheet();
    const bar: Articulation[] = Array.from({ length: 16 }, (_, i) =>
      i % 4 === 0 ? "X" : "hold",
    );
    sheet.rhythm = [bar, bar, bar, bar];
    const code = toStrudel(sheet);
    expect(code).toContain(MUTE_SOUND);
    expect(code).toContain("[0,1,2]");
    expect(code).toContain("0.12");
  });

  it("파형 프리셋은 cutoff를 붙인다", () => {
    const sheet = { ...createInitialSheet(), sound: "saw" as const };
    const code = toStrudel(sheet);
    expect(code).toContain('.s("sawtooth');
    expect(code).toContain(".cutoff(1600)");
  });

  it("rest 구간은 공격이 없다", () => {
    const sheet = createInitialSheet();
    sheet.rhythm = sheet.rhythm.map(() => Array(16).fill("rest") as Articulation[]);
    const parts = compileSheet(sheet);
    expect(parts.hasHits).toBe(false);
  });
});
