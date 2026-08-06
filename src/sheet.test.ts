import { describe, expect, it } from "vitest";
import {
  chordFromDegree,
  compileSheet,
  createInitialSheet,
  cyclesPerSecond,
  holdRun,
  nextSoundMode,
  SOUND_MODES,
  soundModeById,
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

  it("기본 block은 차트→동시 보이싱·sawtooth", () => {
    const sheet = createInitialSheet();
    expect(sheet.soundMode).toBe("block");
    const code = toStrudel(sheet);
    expect(code).toMatch(/^setcps\(/);
    expect(code).toContain('chord("Am@4');
    expect(code).toContain('.dict("triads")');
    expect(code).toContain(".voicing()");
    expect(code).toContain('.s("sawtooth")');
    expect(code).toContain(".clip(0.95)");
    expect(code).not.toContain("gm_");
    expect(code).not.toMatch(/\bn\("/);
  });

  it("예제 MODE는 docs 원문을 그대로 낸다", () => {
    for (const mode of SOUND_MODES) {
      if (mode.kind !== "example") continue;
      const code = toStrudel({
        ...createInitialSheet(),
        soundMode: mode.id,
        // 차트·BPM이 달라도 원문 불변
        bpm: 40,
        degrees: Array(16).fill(null),
        metro: true,
      });
      expect(code).toBe(mode.code);
      expect(code).not.toContain("setcps(");
      expect(code).not.toContain("sawtooth");
    }
  });

  it("recipes arp 원문이 포함된다", () => {
    const mode = soundModeById("ex-arp");
    expect(mode.code).toContain('n("0 1 2 3")');
    expect(mode.code).toContain('.chord("Cm")');
    expect(mode.code).toContain('.mode("above:c3")');
    expect(mode.code).toContain('.s("gm_electric_guitar_clean")');
    expect(mode.code).not.toContain(":5");
    expect(toStrudel({ ...createInitialSheet(), soundMode: "ex-arp" })).toBe(
      mode.code,
    );
  });

  it("MODE 칩은 SOUND_MODES를 순환한다", () => {
    expect(SOUND_MODES[0]!.id).toBe("block");
    let id: SoundModeId = "block";
    const seen = new Set<SoundModeId>();
    for (let i = 0; i < SOUND_MODES.length; i++) {
      seen.add(id);
      id = nextSoundMode(id);
    }
    expect(seen.size).toBe(SOUND_MODES.length);
    expect(id).toBe("block");
  });

  it("rest 구간은 공격이 없다", () => {
    const sheet = createInitialSheet();
    sheet.rhythm = sheet.rhythm.map(() => Array(16).fill("rest") as Articulation[]);
    const parts = compileSheet(sheet);
    expect(parts.hasHits).toBe(false);
  });
});
