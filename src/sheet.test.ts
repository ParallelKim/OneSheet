import { describe, expect, it } from "vitest";
import {
  chordFromDegree,
  compileSheet,
  createInitialSheet,
  cyclesPerSecond,
  holdRun,
  nextSound,
  previewSoundCode,
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
  it("clean → crunch → buzz → clean", () => {
    expect(nextSound("clean")).toBe("crunch");
    expect(nextSound("crunch")).toBe("buzz");
    expect(nextSound("buzz")).toBe("clean");
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
  it("초기 차트는 dirt-samples clean(gtr) 기본", () => {
    const sheet = createInitialSheet();
    const parts = compileSheet(sheet);
    expect(parts.totalSteps).toBe(64);
    expect(parts.hasHits).toBe(true);
    expect(parts.cps).toBeCloseTo(cyclesPerSecond(96));
    expect(parts.events.filter((e) => e.chord !== null)).toHaveLength(16);
    expect(parts.preset.id).toBe("clean");
    expect(parts.preset.sound).toBe("gtr");
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
  });

  it("도수·리듬이 모두 비면 silence", () => {
    const sheet: SheetState = {
      ...createInitialSheet(),
      degrees: Array(16).fill(null),
      metro: false,
    };
    expect(toStrudel(sheet)).toBe("silence");
  });

  it("메트로는 triangle 클릭 (square 8bit 회피)", () => {
    const sheet: SheetState = {
      ...createInitialSheet(),
      degrees: Array(16).fill(null),
      metro: true,
    };
    const code = toStrudel(sheet);
    expect(code).toContain("setcps(");
    expect(code).toContain("note(\"c6 a5 a5 a5");
    expect(code).toContain('.s("triangle")');
    expect(code).not.toContain("chord(");
  });

  it("코드 재생은 gtr 샘플·기타 음역·voicing을 포함한다", () => {
    const code = toStrudel(createInitialSheet());
    expect(code).toMatch(/^setcps\(/);
    expect(code).toContain('n("[[0 1 2 3]@1 ~@3]@4');
    expect(code).toContain('chord("Am@4');
    expect(code).toContain('.dict("triads")');
    expect(code).toContain('.mode("above:c3")');
    expect(code).toContain(".voicing()");
    expect(code).toContain('.s("gtr');
    expect(code).not.toContain("sawtooth");
    expect(code).not.toContain("distort");
  });

  it("X는 같은 SOUND + 짧은 clip (별도 뮤트 샘플 없음)", () => {
    const sheet = createInitialSheet();
    const bar: Articulation[] = Array.from({ length: 16 }, (_, i) =>
      i % 4 === 0 ? "X" : "hold",
    );
    sheet.rhythm = [bar, bar, bar, bar];
    const code = toStrudel(sheet);
    expect(code).toContain('.s("gtr');
    expect(code).not.toContain("gm_electric_guitar_muted");
    expect(code).toContain("[0,1,2]");
    expect(code).toContain("0.12");
  });

  it("crunch는 dist 샘플 + distort", () => {
    const sheet = { ...createInitialSheet(), sound: "crunch" as const };
    const code = toStrudel(sheet);
    expect(code).toContain('.s("gtr:2');
    expect(code).toContain('.distort("2.5:0.35")');
  });

  it("buzz는 sawtooth + cutoff", () => {
    const sheet = { ...createInitialSheet(), sound: "buzz" as const };
    const code = toStrudel(sheet);
    expect(code).toContain('.s("sawtooth');
    expect(code).toContain(".cutoff(1400)");
  });

  it("미리듣기는 해당 SOUND의 한 코드 스트럼", () => {
    const crunch = previewSoundCode("crunch");
    expect(crunch).toContain('.s("gtr:2")');
    expect(crunch).toContain(".distort(");
    const buzz = previewSoundCode("buzz");
    expect(buzz).toContain("sawtooth");
    expect(buzz).toContain(".cutoff(1400)");
  });

  it("rest 구간은 공격이 없다", () => {
    const sheet = createInitialSheet();
    sheet.rhythm = sheet.rhythm.map(() => Array(16).fill("rest") as Articulation[]);
    const parts = compileSheet(sheet);
    expect(parts.hasHits).toBe(false);
  });
});
