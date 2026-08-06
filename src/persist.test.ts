import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInitialSheet } from "./sheet";
import {
  loadSheetState,
  loadStoredSheet,
  normalizeSheet,
  saveStoredSheet,
  SHEET_STORAGE_KEY,
} from "./persist";

function installMemoryStorage() {
  const store = new Map<string, string>();
  const memory = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: memory,
    configurable: true,
  });
  return memory;
}

beforeEach(() => {
  installMemoryStorage();
});

afterEach(() => {
  localStorage.clear();
});

describe("normalizeSheet", () => {
  it("깨진 입력은 초기 시트로 채운다", () => {
    const sheet = normalizeSheet(null);
    expect(sheet.soundMode).toBe("strum");
    expect(sheet.degrees).toHaveLength(16);
    expect(sheet.rhythm).toHaveLength(4);
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
});

describe("localStorage sheet cache", () => {
  it("저장 후 로드한다", () => {
    const sheet = { ...createInitialSheet(), bpm: 110, key: "G", metro: false };
    saveStoredSheet(sheet);
    const loaded = loadStoredSheet();
    expect(loaded?.bpm).toBe(110);
    expect(loaded?.key).toBe("G");
    expect(loaded?.metro).toBe(false);
    expect(localStorage.getItem(SHEET_STORAGE_KEY)).toContain('"v":1');
  });

  it("없으면 초기 시트", () => {
    expect(loadStoredSheet()).toBeNull();
    expect(loadSheetState().bpm).toBe(96);
  });

  it("깨진 JSON은 null", () => {
    localStorage.setItem(SHEET_STORAGE_KEY, "{not-json");
    expect(loadStoredSheet()).toBeNull();
  });
});
