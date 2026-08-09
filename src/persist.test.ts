import { describe, expect, it } from "vitest";
import { createInitialSheet, type Articulation } from "./sheet";
import { normalizeSheet } from "./persist";

describe("normalizeSheet", () => {
  it("깨진 입력은 초기 시트로 채운다", () => {
    const sheet = normalizeSheet(null);
    expect(sheet.soundMode).toBe("strum");
    expect(sheet.degrees).toHaveLength(16);
    expect(sheet.tones).toHaveLength(16);
    expect(sheet.rhythm).toHaveLength(16);
    expect(sheet.rhythmOverride).toHaveLength(4);
  });

  it("tones 없으면 degrees에서 기본 구성음", () => {
    const sheet = normalizeSheet({
      bpm: 96,
      key: "C",
      degrees: [5, 0, 4, 3],
      rhythm: createInitialSheet().rhythm,
      rhythmOverride: [null, null, null, null],
      gain: 0.55,
      metro: true,
      soundMode: "strum",
    });
    expect(sheet.tones[0]).toEqual(["1", "b3", "5"]);
    expect(sheet.tones[1]).toEqual(["1", "3", "5"]);
  });

  it("옛 soundMode는 strum으로 내린다", () => {
    const sheet = normalizeSheet({
      ...createInitialSheet(),
      soundMode: "docs",
    });
    expect(sheet.soundMode).toBe("strum");
  });

  it("유효한 piano는 유지", () => {
    expect(
      normalizeSheet({ ...createInitialSheet(), soundMode: "piano" }).soundMode,
    ).toBe("piano");
  });

  it("v1 rhythm[][]를 base+상속으로 올린다", () => {
    const bar = createInitialSheet().rhythm;
    const sheet = normalizeSheet({
      ...createInitialSheet(),
      rhythm: [bar, bar, bar, bar],
    });
    expect(sheet.rhythm).toEqual(bar);
    expect(sheet.rhythmOverride.every((r) => r == null)).toBe(true);
  });

  it("v1에서 다른 마디는 override로 남긴다", () => {
    const bar = createInitialSheet().rhythm;
    const own = [...bar];
    own[0] = "X" as Articulation;
    const sheet = normalizeSheet({
      bpm: 96,
      key: "C",
      degrees: createInitialSheet().degrees,
      rhythm: [bar, own, bar, bar],
      gain: 0.55,
      metro: true,
      soundMode: "strum",
    });
    expect(sheet.rhythmOverride[1]?.[0]).toBe("X");
    expect(sheet.rhythmOverride[2]).toBeNull();
  });
});
