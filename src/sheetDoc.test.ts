import { describe, expect, it } from "vitest";
import {
  createInitialSheet,
  defaultTonesForDegree,
  paintDegreeSlot,
  paintToneSlot,
  type Articulation,
} from "./sheet";
import {
  decodeSheetParam,
  docToSheet,
  encodeSheetParam,
  sheetToDoc,
} from "./sheetDoc";
import { readSheetFromSearch, SHARE_QUERY_KEY, sheetToShareUrl } from "./shareQuery";

describe("SheetDoc v1", () => {
  it("빈 시트 왕복", () => {
    const sheet = createInitialSheet();
    const again = decodeSheetParam(encodeSheetParam(sheet));
    expect(again).toEqual(sheet);
  });

  it("도수·구성음·리듬 override 왕복", () => {
    let sheet = createInitialSheet();
    sheet = paintDegreeSlot(sheet, 0, 5);
    sheet = paintToneSlot(sheet, 0, "2");
    sheet = paintToneSlot(sheet, 0, "2"); // add2 (장2)
    sheet = {
      ...sheet,
      bpm: 110,
      key: "G",
      metro: true,
      soundMode: "piano",
      rhythmOverride: [
        null,
        Array.from({ length: 16 }, (_, i) =>
          i % 4 === 0 ? ("U" as Articulation) : ("hold" as Articulation),
        ),
        null,
        null,
      ],
    };
    const doc = sheetToDoc(sheet);
    expect(doc.v).toBe(1);
    expect(doc.deg[0]).toBe(5);
    expect(doc.ton[0]).toContain("2");
    expect(doc.ov[0]?.startsWith("U")).toBe(true);

    const again = docToSheet(doc);
    expect(again.bpm).toBe(110);
    expect(again.key).toBe("G");
    expect(again.metro).toBe(true);
    expect(again.soundMode).toBe("piano");
    expect(again.degrees[0]).toBe(5);
    expect(again.tones[0]).toEqual(["1", "2", "b3", "5"]);
    expect(again.rhythmOverride[1]?.[0]).toBe("U");
    expect(again.rhythmOverride[2]).toBeNull();
  });

  it("깨진 페이로드는 null / 초기값", () => {
    expect(decodeSheetParam("!!!")).toBeNull();
    expect(docToSheet({ v: 99 })).toEqual(createInitialSheet());
  });
});

describe("share query", () => {
  it("?s= 에서 시트를 읽는다", () => {
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
    const loaded = readSheetFromSearch(u.search);
    expect(loaded?.key).toBe("D");
    expect(loaded?.bpm).toBe(100);
    expect(loaded?.degrees[0]).toBe(0);
  });
});
