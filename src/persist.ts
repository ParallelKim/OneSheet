import {
  ARTICULATIONS,
  BARS,
  BAR_STEPS,
  createInitialSheet,
  KEY_LIST,
  SLOTS,
  SOUND_MODES,
  type Articulation,
  type SheetState,
  type SoundModeId,
} from "./sheet";

/** 스키마가 바뀌면 키/버전을 올린다. 서버 동기화 전 로컬 캐시. */
export const SHEET_STORAGE_KEY = "onesheet.sheet.v1";

type StoredBlob = {
  v: 1;
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
  // 옛 실험 모드 → 기본 strum
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

  const rhythmIn = Array.isArray(o.rhythm) ? o.rhythm : [];
  const rhythm = Array.from({ length: BARS }, (_, bar) => {
    const row = Array.isArray(rhythmIn[bar]) ? rhythmIn[bar]! : [];
    return Array.from({ length: BAR_STEPS }, (_, step) =>
      normalizeArt(row[step]),
    );
  });

  return { bpm, key, degrees, rhythm, gain, metro, soundMode };
}

export function loadStoredSheet(): SheetState | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(SHEET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBlob;
    if (!parsed || parsed.v !== 1) return null;
    return normalizeSheet(parsed.sheet);
  } catch {
    return null;
  }
}

export function saveStoredSheet(sheet: SheetState): void {
  try {
    if (typeof localStorage === "undefined") return;
    const blob: StoredBlob = { v: 1, sheet };
    localStorage.setItem(SHEET_STORAGE_KEY, JSON.stringify(blob));
  } catch (err) {
    console.warn("sheet cache save failed", err);
  }
}

export function loadSheetState(): SheetState {
  return loadStoredSheet() ?? createInitialSheet();
}
