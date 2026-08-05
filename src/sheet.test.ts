import { describe, expect, it } from "vitest";
import {
  chordFromDegree,
  compileSheet,
  createInitialSheet,
  cyclesPerSecond,
  holdRun,
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

describe("compileSheet / toStrudel", () => {
  it("초기 차트는 64스텝과 공격 클립을 만든다", () => {
    const sheet = createInitialSheet();
    const parts = compileSheet(sheet);
    expect(parts.chordSeq).toHaveLength(64);
    expect(parts.hasHits).toBe(true);
    expect(parts.cps).toBeCloseTo(cyclesPerSecond(96));
    // 각 박 시작이 D → 16 공격
    expect(parts.chordSeq.filter((t) => t !== "~")).toHaveLength(16);
    expect(parts.clipSeq[0]).toBe(4); // D + 3 hold
  });

  it("D·U· 패턴은 박마다 공격 2개", () => {
    const sheet = createInitialSheet();
    const bar: Articulation[] = Array.from({ length: 16 }, (_, i) => {
      const sub = i % 4;
      if (sub === 0) return "D";
      if (sub === 2) return "U";
      return "hold";
    });
    sheet.rhythm = [bar, bar, bar, bar];
    const parts = compileSheet(sheet);
    expect(parts.chordSeq.filter((t) => t !== "~")).toHaveLength(32);
    expect(parts.clipSeq[0]).toBe(2); // D + 1 hold
    expect(parts.clipSeq[2]).toBe(2); // U + 1 hold
  });

  it("도수·리듬이 모두 비면 silence", () => {
    const sheet: SheetState = {
      ...createInitialSheet(),
      degrees: Array(16).fill(null),
      metro: false,
    };
    expect(toStrudel(sheet)).toBe("silence");
  });

  it("메트로만 켜도 woodblock 레이어가 나온다", () => {
    const sheet: SheetState = {
      ...createInitialSheet(),
      degrees: Array(16).fill(null),
      metro: true,
    };
    const code = toStrudel(sheet);
    expect(code).toContain("setcps(");
    expect(code).toContain("woodblock");
    expect(code).not.toContain("chord(");
  });

  it("코드 재생 코드는 dict·voicing·setcps를 포함한다", () => {
    const code = toStrudel(createInitialSheet());
    expect(code).toMatch(/^setcps\(/);
    expect(code).toContain('chord("<');
    expect(code).toContain('.dict("triads")');
    expect(code).toContain(".voicing()");
    expect(code).toContain(".s(\"sawtooth\")");
    expect(code).toContain("woodblock");
  });

  it("rest 구간은 공격이 없다", () => {
    const sheet = createInitialSheet();
    sheet.rhythm = sheet.rhythm.map(() => Array(16).fill("rest") as Articulation[]);
    const parts = compileSheet(sheet);
    expect(parts.hasHits).toBe(false);
  });
});
