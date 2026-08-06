import { describe, expect, it } from "vitest";
import {
  chordFromDegree,
  compileSheet,
  createInitialSheet,
  cyclesPerSecond,
  guitarShape,
  holdRun,
  nextSoundMode,
  SOUND_MODES,
  toStrudel,
  type Articulation,
  type SheetState,
  type SoundModeId,
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

describe("compileSheet / toStrudel", () => {
  it("초기 차트는 4분 다운을 @4 이벤트로 만든다", () => {
    const sheet = createInitialSheet();
    const parts = compileSheet(sheet);
    expect(parts.totalSteps).toBe(64);
    expect(parts.hasHits).toBe(true);
    expect(parts.cps).toBeCloseTo(cyclesPerSecond(96));
    expect(parts.events.filter((e) => e.chord !== null)).toHaveLength(16);
    expect(parts.events.every((e) => e.chord === null || e.steps === 4)).toBe(true);
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

  it("메트로는 triangle 클릭", () => {
    const sheet: SheetState = {
      ...createInitialSheet(),
      degrees: Array(16).fill(null),
      metro: true,
    };
    const code = toStrudel(sheet);
    expect(code).toContain("setcps(");
    expect(code).toContain('note("c6 a5 a5 a5');
    expect(code).toContain('.s("triangle")');
    expect(code).not.toContain("chord(");
  });

  it("기본 MODE는 strum", () => {
    expect(createInitialSheet().soundMode).toBe("strum");
  });

  it("오픈 C/Am 셰이프는 절대음·뮤트 현 제외", () => {
    expect(guitarShape("C")).toEqual(["c3", "e3", "g3", "c4", "e4"]);
    expect(guitarShape("Am")).toEqual(["a2", "e3", "a3", "c4", "e4"]);
    expect(guitarShape("G")).toEqual(["g2", "b2", "d3", "g3", "b3", "g4"]);
  });

  it("strum은 note+late 오픈셰이프·GM clean·차트 리듬", () => {
    const sheet = createInitialSheet();
    const bar: Articulation[] = Array.from({ length: 16 }, (_, i) => {
      const sub = i % 4;
      if (sub === 0) return "D";
      if (sub === 2) return "U";
      return "hold";
    });
    sheet.rhythm = [bar, bar, bar, bar];

    const code = toStrudel({ ...sheet, soundMode: "strum" });
    expect(code).toMatch(/^setcps\(/);
    expect(code).toContain("a2@2");
    expect(code).toContain("e3@2");
    expect(code).toContain("c4@2");
    expect(code).toContain('.s("gm_electric_guitar_clean:5")');
    expect(code).toContain(".late(");
    expect(code).toContain(".hpf(180)");
    expect(code).toContain("note(");
    expect(code).not.toContain('dict("gtr6")');
    expect(code).not.toMatch(/\bn\("/);
    const gains = [...code.matchAll(/\.gain\("([^"]+)"\)/g)].map((m) => m[1]!);
    expect(gains.length).toBeGreaterThanOrEqual(5);
    const low = Number(gains[0]!.split(" ")[0]!.split("@")[0]);
    const high = Number(gains[4]!.split(" ")[0]!.split("@")[0]);
    expect(low).toBeGreaterThan(0);
    expect(high / low).toBeGreaterThan(3);
  });

  it("piano는 오픈셰이프 전음 동시·gm_piano·late 없음", () => {
    const sheet = createInitialSheet();
    const code = toStrudel({ ...sheet, soundMode: "piano", metro: false });
    expect(code).toMatch(/^setcps\(/);
    expect(code).toContain("a2,e3,a3,c4,e4@4");
    expect(code).toContain("c3,e3,g3,c4,e4@4");
    expect(code).toContain("g2,b2,d3,g3,b3,g4@4");
    expect(code).toContain('.s("gm_piano")');
    expect(code).not.toContain(".late(");
    expect(code).not.toContain("gm_electric_guitar_clean");
    expect(code).not.toContain("sawtooth");
  });

  it("MODE는 strum→piano 순환", () => {
    expect(SOUND_MODES.map((m) => m.id)).toEqual(["strum", "piano"]);
    let id: SoundModeId = "strum";
    for (let i = 0; i < SOUND_MODES.length; i++) id = nextSoundMode(id);
    expect(id).toBe("strum");
    expect(nextSoundMode("strum")).toBe("piano");
    expect(nextSoundMode("piano")).toBe("strum");
  });

  it("rest 구간은 공격이 없다", () => {
    const sheet = createInitialSheet();
    sheet.rhythm = sheet.rhythm.map(() => Array(16).fill("rest") as Articulation[]);
    const parts = compileSheet(sheet);
    expect(parts.hasHits).toBe(false);
  });
});
