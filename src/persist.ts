import {
  ARTICULATIONS,
  BARS,
  BAR_STEPS,
  createInitialSheet,
  KEY_LIST,
  rhythmFromLegacyBars,
  SLOTS,
  SOUND_MODES,
  type Articulation,
  type SheetState,
  type SoundModeId,
} from "./sheet";

/** v2: rhythm base + overrides. v1도 읽어 마이그레이션. */
export const SHEET_STORAGE_KEY = "onesheet.sheet.v2";
const LEGACY_STORAGE_KEY = "onesheet.sheet.v1";

type StoredBlob = {
  v: 1 | 2;
  sheet: unknown;
};

const ART_SET = new Set(ARTICULATIONS.map((a) => a.id));
const KEY_SET = new Set(KEY_LIST);
const MODE_SET = new Set(SOUND_MODES.map((m) => m.id));

function asNumber(n: unknown, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function asBool(n: unknown, fallback: boolean): boolean {
  return typeof n === "boolean" ? n : fallback;
}

function normalizeSoundMode(id: unknown): SoundModeId {
  if (typeof id === "string" && MODE_SET.has(id)) {
    return id as SoundModeId;
  }
  return "strum";
}

function normalizeDegree(d: unknown): number | null {
  if (d === null) return null;
  if (typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6) {
    return d;
  }
  return null;
}

function normalizeArt(a: unknown): Articulation {
  if (typeof a === "string" && ART_SET.has(a as Articulation)) {
    return a as Articulation;
  }
  return "rest";
}

function normalizeBarArts(row: unknown): Articulation[] {
  const src = Array.isArray(row) ? row : [];
  return Array.from({ length: BAR_STEPS }, (_, step) =>
    normalizeArt(src[step]),
  );
}

function normalizeRhythmFields(
  o: Record<string, unknown>,
  base: SheetState,
): Pick<SheetState, "rhythm" | "rhythmOverride"> {
  // v2: rhythm = Articulation[], rhythmOverride = (Articulation[]|null)[]
  if (Array.isArray(o.rhythm) && !Array.isArray(o.rhythm[0])) {
    const rhythm = normalizeBarArts(o.rhythm);
    const ovIn = Array.isArray(o.rhythmOverride) ? o.rhythmOverride : [];
    const rhythmOverride = Array.from({ length: BARS }, (_, bar) => {
      if (bar === 0) return null;
      const cell = ovIn[bar];
      if (cell == null) return null;
      return normalizeBarArts(cell);
    });
    return { rhythm, rhythmOverride };
  }

  // v1 legacy: rhythm = Articulation[][]
  if (Array.isArray(o.rhythm) && Array.isArray(o.rhythm[0])) {
    const legacy = o.rhythm as unknown[];
    const rows = Array.from({ length: BARS }, (_, bar) =>
      normalizeBarArts(legacy[bar]),
    );
    return rhythmFromLegacyBars(rows);
  }

  return {
    rhythm: [...base.rhythm],
    rhythmOverride: base.rhythmOverride.map(() => null),
  };
}

/**
 * 부분·옛 데이터를 현재 SheetState로 맞춘다.
 * 깨진 필드는 초기값으로 채운다.
 */
export function normalizeSheet(raw: unknown): SheetState {
  const base = createInitialSheet();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;

  const bpm = Math.min(140, Math.max(70, Math.round(asNumber(o.bpm, base.bpm))));
  const key =
    typeof o.key === "string" && KEY_SET.has(o.key) ? o.key : base.key;
  const gain = Math.min(1, Math.max(0.05, asNumber(o.gain, base.gain)));
  const metro = asBool(o.metro, base.metro);
  const soundMode = normalizeSoundMode(o.soundMode);

  const degreesIn = Array.isArray(o.degrees) ? o.degrees : [];
  const degrees = Array.from({ length: SLOTS }, (_, i) =>
    normalizeDegree(degreesIn[i]),
  );

  const { rhythm, rhythmOverride } = normalizeRhythmFields(o, base);

  return { bpm, key, degrees, rhythm, rhythmOverride, gain, metro, soundMode };
}

function readBlob(key: string): StoredBlob | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBlob;
    if (!parsed || (parsed.v !== 1 && parsed.v !== 2)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadStoredSheet(): SheetState | null {
  const blob = readBlob(SHEET_STORAGE_KEY) ?? readBlob(LEGACY_STORAGE_KEY);
  if (!blob) return null;
  return normalizeSheet(blob.sheet);
}

export function saveStoredSheet(sheet: SheetState): void {
  try {
    if (typeof localStorage === "undefined") return;
    const blob: StoredBlob = { v: 2, sheet };
    localStorage.setItem(SHEET_STORAGE_KEY, JSON.stringify(blob));
  } catch (err) {
    console.warn("sheet cache save failed", err);
  }
}

export function loadSheetState(): SheetState {
  return loadStoredSheet() ?? createInitialSheet();
}
