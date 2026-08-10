import { describe, expect, it } from "vitest";
import { createInitialSheet, toStrudel, toStrudelChain } from "./sheet";
import {
  createDefaultStudio,
  decodeStudioParam,
  encodeStudioParam,
  filledOrder,
  setActiveSlot,
  sheetsForChain,
  STUDIO_SLOT_COUNT,
  updateActiveSheet,
} from "./studioDoc";

describe("studioDoc", () => {
  it("기본 스튜디오는 슬롯0만 채운다", () => {
    const s = createDefaultStudio();
    expect(s.slots).toHaveLength(STUDIO_SLOT_COUNT);
    expect(s.slots[0]).not.toBeNull();
    expect(s.slots.slice(1).every((x) => x == null)).toBe(true);
    expect(filledOrder(s.slots)).toEqual([0]);
  });

  it("왕복 encode/decode", () => {
    let s = createDefaultStudio();
    s = setActiveSlot(s, 2);
    s = updateActiveSheet(s, { ...createInitialSheet(), bpm: 128, key: "G" });
    s = { ...s, chain: true };
    const again = decodeStudioParam(encodeStudioParam(s));
    expect(again?.active).toBe(2);
    expect(again?.chain).toBe(true);
    expect(again?.slots[2]?.bpm).toBe(128);
    expect(again?.slots[2]?.key).toBe("G");
    expect(again?.slots[0]).not.toBeNull();
  });

  it("체인 시트 목록은 채운 순서", () => {
    let s = createDefaultStudio();
    s = setActiveSlot(s, 3);
    s = updateActiveSheet(s, { ...createInitialSheet(), bpm: 100 });
    expect(sheetsForChain(s).map((x) => x.bpm)).toEqual([96, 100]);
  });
});

describe("toStrudelChain", () => {
  it("한 장이면 toStrudel과 같다", () => {
    const sheet = createInitialSheet();
    expect(toStrudelChain([sheet])).toBe(toStrudel(sheet));
  });

  it("여러 장은 cat 으로 잇는다", () => {
    const a = { ...createInitialSheet(), bpm: 96 };
    const b = { ...createInitialSheet(), bpm: 120, key: "G" };
    const code = toStrudelChain([a, b]);
    expect(code.startsWith("setcps(")).toBe(true);
    expect(code).toContain("cat(");
  });
});
