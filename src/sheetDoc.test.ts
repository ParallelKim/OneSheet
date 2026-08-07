import { describe, expect, it } from "vitest";
import {
  createInitialSheet,
  defaultTonesForDegree,
  paintDegreeSlot,
  paintToneSlot,
  type Articulation,
} from "./sheet";
import {
  decodeSheetDoc,
  decodeSheetParam,
  docToSheet,
  encodeSheetDoc,
  encodeSheetParam,
  encodeSheetV2,
  sheetToDoc,
} from "./sheetDoc";
import { readSheetFromSearch, SHARE_QUERY_KEY, sheetToShareUrl } from "./shareQuery";

function richSheet() {
  let sheet = createInitialSheet();
  sheet = paintDegreeSlot(sheet, 0, 5);
  sheet = paintToneSlot(sheet, 0, "2");
  sheet = paintToneSlot(sheet, 0, "2"); // add2
  return {
    ...sheet,
    bpm: 110,
    key: "G",
    metro: true,
    soundMode: "piano" as const,
    rhythmOverride: [
      null,
      Array.from({ length: 16 }, (_, i) =>
        i % 4 === 0 ? ("U" as Articulation) : ("hold" as Articulation),
      ),
      null,
      null,
    ],
  };
}

describe("SheetDoc v1 (legacy read)", () => {
  it("v1 JSON 페이로드를 읽는다", () => {
    const sheet = richSheet();
    const v1 = encodeSheetDoc(sheetToDoc(sheet));
    expect(v1.startsWith("eyJ")).toBe(true); // {"...
    const again = decodeSheetParam(v1);
    expect(again?.bpm).toBe(110);
    expect(again?.key).toBe("G");
    expect(again?.metro).toBe(true);
    expect(again?.soundMode).toBe("piano");
    expect(again?.degrees[0]).toBe(5);
    expect(again?.tones[0]).toEqual(["1", "2", "b3", "5"]);
    expect(again?.rhythmOverride[1]?.[0]).toBe("U");
  });

  it("sheetToDoc는 여전히 v1 모델", () => {
    const doc = sheetToDoc(richSheet());
    expect(doc.v).toBe(1);
    expect(doc.deg[0]).toBe(5);
  });

  it("깨진 페이로드는 null / 초기값", () => {
    expect(decodeSheetParam("!!!")).toBeNull();
    expect(docToSheet({ v: 99 })).toEqual(createInitialSheet());
    expect(decodeSheetDoc("!!!")).toBeNull();
  });
});

describe("SheetDoc v2", () => {
  it("빈 시트 왕복", () => {
    const sheet = createInitialSheet();
    const again = decodeSheetParam(encodeSheetParam(sheet));
    expect(again).toEqual(sheet);
  });

  it("도수·구성음·리듬 override 왕복", () => {
    const sheet = richSheet();
    const again = decodeSheetParam(encodeSheetParam(sheet));
    expect(again?.bpm).toBe(110);
    expect(again?.key).toBe("G");
    expect(again?.metro).toBe(true);
    expect(again?.soundMode).toBe("piano");
    expect(again?.degrees[0]).toBe(5);
    expect(again?.tones[0]).toEqual(["1", "2", "b3", "5"]);
    expect(again?.rhythmOverride[1]?.[0]).toBe("U");
    expect(again?.rhythmOverride[2]).toBeNull();
    expect(again?.gain).toBeCloseTo(sheet.gain, 2);
  });

  it("쓰기는 v2이며 v1 JSON보다 짧다", () => {
    const sheet = richSheet();
    const v2 = encodeSheetParam(sheet);
    const v1 = encodeSheetDoc(sheetToDoc(sheet));
    expect(encodeSheetV2(sheet)[0]).toBe(2);
    expect(v2.startsWith("eyJ")).toBe(false);
    expect(v2.length).toBeLessThan(v1.length);
    expect(v2.length).toBeLessThan(120);
  });

  it("실사용급 차트도 v2가 훨씬 짧다", () => {
    // 예전 공유 링크에 가깝게: 16칸 채움 + ov
    const degrees = [0, 0, 4, 4, 5, 5, 2, 2, 3, 3, 4, 4, 0, 0, 5, 4];
    const sheet = {
      ...createInitialSheet(),
      bpm: 81,
      key: "C",
      metro: false,
      soundMode: "strum" as const,
      gain: 0.55,
      degrees,
      tones: degrees.map((d) =>
        d === 5 || d === 1 || d === 2
          ? (["1", "b3", "5"] as const)
          : (["1", "3", "5"] as const),
      ),
      rhythm: Array.from({ length: 16 }, (_, i) => {
        const sub = i % 4;
        if (sub === 0) return "D" as Articulation;
        if (sub === 2) return "U" as Articulation;
        return "hold" as Articulation;
      }),
      rhythmOverride: [
        null,
        null,
        null,
        Array.from({ length: 16 }, (_, i) =>
          i < 12
            ? i % 4 === 0
              ? ("D" as Articulation)
              : i % 4 === 2
                ? ("U" as Articulation)
                : ("hold" as Articulation)
            : ("hold" as Articulation),
        ),
      ],
    };
    const v2 = encodeSheetParam(sheet);
    const v1 = encodeSheetDoc(sheetToDoc(sheet));
    expect(v2.length).toBeLessThan(100);
    expect(v2.length / v1.length).toBeLessThan(0.35);
    const again = decodeSheetParam(v2);
    expect(again?.degrees).toEqual(degrees);
    expect(again?.bpm).toBe(81);
  });
});

describe("share query", () => {
  it("쿼리 키는 s 유지", () => {
    expect(SHARE_QUERY_KEY).toBe("s");
  });

  it("?s= 에서 시트를 읽는다 (v2 쓰기)", () => {
    const sheet = {
      ...createInitialSheet(),
      degrees: Array.from({ length: 16 }, (_, i) => (i === 0 ? 0 : null)),
      tones: Array.from({ length: 16 }, (_, i) =>
        i === 0 ? defaultTonesForDegree(0) : null,
      ),
      key: "D",
      bpm: 100,
    };
    const url = sheetToShareUrl(sheet, "https://gridplay.web.app/");
    const u = new URL(url);
    expect(u.searchParams.has(SHARE_QUERY_KEY)).toBe(true);
    const raw = u.searchParams.get(SHARE_QUERY_KEY)!;
    expect(raw.startsWith("eyJ")).toBe(false);
    const loaded = readSheetFromSearch(u.search);
    expect(loaded?.key).toBe("D");
    expect(loaded?.bpm).toBe(100);
    expect(loaded?.degrees[0]).toBe(0);
  });
});
