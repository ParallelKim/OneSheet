import { describe, expect, it } from "vitest";
import {
  barRhythm,
  chordFromDegree,
  chordSymbolFromParts,
  clearRhythmOverride,
  compileSheet,
  createInitialSheet,
  cyclesPerSecond,
  defaultTonesForDegree,
  guitarShape,
  holdRun,
  intervalNoteLabel,
  isRhythmOverridden,
  nextSoundMode,
  paintRhythmStep,
  paintToneSlot,
  rhythmBarKind,
  rhythmFromLegacyBars,
  slotLabel,
  SOUND_MODES,
  toggleChordTone,
  toStrudel,
  type Articulation,
  type SheetState,
  type SoundModeId,
} from "./sheet";

function duPattern(): Articulation[] {
  return Array.from({ length: 16 }, (_, i) => {
    const sub = i % 4;
    if (sub === 0) return "D";
    if (sub === 2) return "U";
    return "hold";
  });
}

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

describe("root × tones", () => {
  it("V + 기본 Maj 구성음은 G B D", () => {
    expect(defaultTonesForDegree(4)).toEqual(["1", "3", "5"]);
    expect(chordSymbolFromParts("G", ["1", "3", "5"])).toBe("G");
    expect(intervalNoteLabel("C", 4, "1")).toBe("G");
    expect(intervalNoteLabel("C", 4, "3")).toBe("B");
    expect(intervalNoteLabel("C", 4, "5")).toBe("D");
  });

  it("iii 근음 + Maj 구성음 = E (Don't Look Back…)", () => {
    expect(chordSymbolFromParts("E", ["1", "3", "5"])).toBe("E");
    expect(slotLabel("C", 2, ["1", "3", "5"])).toBe("E");
  });

  it("IV 근음 + min 구성음 = Fm", () => {
    expect(chordSymbolFromParts("F", ["1", "b3", "5"])).toBe("Fm");
    expect(slotLabel("C", 3, ["1", "b3", "5"])).toBe("Fm");
  });

  it("3↔b3 토글은 배타", () => {
    const next = toggleChordTone(["1", "3", "5"], "b3");
    expect(next).toEqual(["1", "b3", "5"]);
  });

  it("2 켜면 add2 / madd2", () => {
    expect(chordSymbolFromParts("A", ["1", "2", "b3", "5"])).toBe("Amadd2");
    expect(chordSymbolFromParts("C", ["1", "2", "3", "5"])).toBe("Cadd2");
    expect(chordSymbolFromParts("G", ["1", "2", "5"])).toBe("Gsus2");
    expect(chordSymbolFromParts("G", ["1", "2", "3", "5", "b7"])).toBe("G9");
  });

  it("구성음 토글은 채워진 슬롯 전부에 거울", () => {
    let sheet = createInitialSheet();
    sheet = {
      ...sheet,
      degrees: Array.from({ length: 16 }, (_, i) =>
        i < 4 ? ([5, 0, 4, 3] as const)[i]! : null,
      ),
      tones: Array.from({ length: 16 }, (_, i) =>
        i < 4 ? defaultTonesForDegree(([5, 0, 4, 3] as const)[i]!) : null,
      ),
    };
    sheet = paintToneSlot(sheet, 0, "2");
    expect(sheet.tones.slice(0, 4)).toEqual([
      ["1", "2", "b3", "5"],
      ["1", "2", "3", "5"],
      ["1", "2", "3", "5"],
      ["1", "2", "3", "5"],
    ]);
    expect(slotLabel("C", 5, sheet.tones[0])).toBe("Amadd2");
    expect(slotLabel("C", 0, sheet.tones[1])).toBe("Cadd2");
  });
});

describe("holdRun", () => {
  it("공격 뒤 hold만 센다", () => {
    const bar: Articulation[] = ["D", "hold", "hold", "hold", "U", "hold", "rest", "rest"];
    expect(holdRun(bar, 0)).toBe(3);
    expect(holdRun(bar, 4)).toBe(1);
  });
});

describe("rhythm inherit / override", () => {
  it("초기에는 전 마디가 1마디 리듬을 상속", () => {
    const sheet = createInitialSheet();
    expect(sheet.rhythm).toHaveLength(16);
    expect(sheet.rhythmOverride.every((r) => r == null)).toBe(true);
    expect(rhythmBarKind(sheet, 0)).toBe("base");
    expect(rhythmBarKind(sheet, 1)).toBe("link");
    expect(barRhythm(sheet, 2)).toEqual(sheet.rhythm);
  });

  it("bar0 수정은 상속 마디에 전파", () => {
    let sheet = createInitialSheet();
    sheet = paintRhythmStep(sheet, 0, 0, "U");
    expect(sheet.rhythm[0]).toBe("U");
    expect(isRhythmOverridden(sheet, 1)).toBe(false);
    expect(barRhythm(sheet, 1)[0]).toBe("U");
  });

  it("bar≥1 편집은 override로 분기", () => {
    let sheet = createInitialSheet();
    sheet = paintRhythmStep(sheet, 2, 0, "X");
    expect(rhythmBarKind(sheet, 2)).toBe("own");
    expect(barRhythm(sheet, 2)[0]).toBe("X");
    expect(barRhythm(sheet, 0)[0]).toBe("D");
    expect(barRhythm(sheet, 1)[0]).toBe("D");
  });

  it("clearRhythmOverride는 상속으로 되돌림", () => {
    let sheet = createInitialSheet();
    sheet = paintRhythmStep(sheet, 1, 0, "X");
    sheet = clearRhythmOverride(sheet, 1);
    expect(rhythmBarKind(sheet, 1)).toBe("link");
    expect(barRhythm(sheet, 1)).toEqual(sheet.rhythm);
  });

  it("legacy 4마디 배열에서 같은 패턴은 상속으로", () => {
    const bar = duPattern();
    const { rhythm, rhythmOverride } = rhythmFromLegacyBars([bar, bar, bar, bar]);
    expect(rhythm).toEqual(bar);
    expect(rhythmOverride.every((r) => r == null)).toBe(true);
  });

  it("legacy에서 다른 마디만 override", () => {
    const bar = duPattern();
    const own = [...bar];
    own[0] = "X";
    const { rhythmOverride } = rhythmFromLegacyBars([bar, bar, own, bar]);
    expect(rhythmOverride[1]).toBeNull();
    expect(rhythmOverride[2]?.[0]).toBe("X");
    expect(rhythmOverride[3]).toBeNull();
  });
});

function loopDegrees(): Array<number | null> {
  return Array.from({ length: 16 }, (_, i) => [5, 0, 4, 3][i % 4]!);
}

function sheetWithLoop(): SheetState {
  const degrees = loopDegrees();
  return {
    ...createInitialSheet(),
    degrees,
    tones: degrees.map((d) => (d === null ? null : defaultTonesForDegree(d))),
  };
}

describe("compileSheet / toStrudel", () => {
  it("초기 시트는 코드 비움·메트로 off", () => {
    const sheet = createInitialSheet();
    expect(sheet.degrees.every((d) => d === null)).toBe(true);
    expect(sheet.metro).toBe(false);
    expect(compileSheet(sheet).hasHits).toBe(false);
  });

  it("루프 차트는 4분 다운을 @4 이벤트로 만든다", () => {
    const sheet = sheetWithLoop();
    const parts = compileSheet(sheet);
    expect(parts.totalSteps).toBe(64);
    expect(parts.hasHits).toBe(true);
    expect(parts.cps).toBeCloseTo(cyclesPerSecond(96));
    expect(parts.events.filter((e) => e.chord !== null)).toHaveLength(16);
    expect(parts.events.every((e) => e.chord === null || e.steps === 4)).toBe(true);
  });

  it("D·U· 패턴은 박마다 공격 2개(@2) — 상속으로 전 마디", () => {
    const sheet = { ...sheetWithLoop(), rhythm: duPattern() };
    const parts = compileSheet(sheet);
    const hits = parts.events.filter((e) => e.chord !== null);
    expect(hits).toHaveLength(32);
    expect(hits.every((e) => e.steps === 2)).toBe(true);
  });

  it("override 마디만 다른 리듬으로 컴파일", () => {
    let sheet = sheetWithLoop();
    const restBar = Array.from({ length: 16 }, () => "rest" as Articulation);
    sheet = {
      ...sheet,
      rhythmOverride: [null, restBar, null, null],
    };
    const parts = compileSheet(sheet);
    const hits = parts.events.filter((e) => e.chord !== null);
    expect(hits).toHaveLength(12);
  });

  it("도수·리듬이 모두 비면 silence", () => {
    const sheet: SheetState = {
      ...createInitialSheet(),
      degrees: Array(16).fill(null),
      tones: Array(16).fill(null),
      metro: false,
    };
    expect(toStrudel(sheet)).toBe("silence");
  });

  it("메트로는 triangle 클릭", () => {
    const sheet: SheetState = {
      ...createInitialSheet(),
      degrees: Array(16).fill(null),
      tones: Array(16).fill(null),
      metro: true,
    };
    const code = toStrudel(sheet);
    expect(code).toContain("setcps(");
    expect(code).toContain('note("c6 a5 a5 a5');
    expect(code).toContain('.s("triangle")');
    expect(code).toContain(".gain(0.32)");
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
    const sheet = { ...sheetWithLoop(), rhythm: duPattern() };
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
    const sheet = sheetWithLoop();
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
    const sheet = {
      ...createInitialSheet(),
      rhythm: Array(16).fill("rest") as Articulation[],
    };
    const parts = compileSheet(sheet);
    expect(parts.hasHits).toBe(false);
  });
});
