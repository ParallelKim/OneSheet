import {
  ARTICULATIONS,
  BARS,
  BAR_STEPS,
  BPM_MAX,
  BPM_MIN,
  CHORD_INTERVALS,
  createInitialSheet,
  defaultTonesForDegree,
  KEY_LIST,
  rhythmFromLegacyBars,
  SLOTS,
  SOUND_MODES,
  type Articulation,
  type ChordInterval,
  type SheetState,
  type SoundModeId,
  type ToneSet,
} from "./sheet";

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

function normalizeToneSet(raw: unknown, degree: number | null): ToneSet | null {
  if (degree === null) return null;
  if (!Array.isArray(raw)) return defaultTonesForDegree(degree);
  const tones = CHORD_INTERVALS.filter((id) =>
    raw.includes(id),
  ) as ChordInterval[];
  if (tones.length === 0) return defaultTonesForDegree(degree);
  if (!tones.includes("1")) return ["1", ...tones];
  return tones;
}

function normalizeRhythmFields(
  o: Record<string, unknown>,
  base: SheetState,
): Pick<SheetState, "rhythm" | "rhythmOverride"> {
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

  const bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(asNumber(o.bpm, base.bpm))));
  const key =
    typeof o.key === "string" && KEY_SET.has(o.key) ? o.key : base.key;
  const gain = Math.min(1, Math.max(0.05, asNumber(o.gain, base.gain)));
  const metro = asBool(o.metro, base.metro);
  const soundMode = normalizeSoundMode(o.soundMode);

  const degreesIn = Array.isArray(o.degrees) ? o.degrees : [];
  const degrees = Array.from({ length: SLOTS }, (_, i) =>
    normalizeDegree(degreesIn[i]),
  );

  const tonesIn = Array.isArray(o.tones) ? o.tones : [];
  const tones = Array.from({ length: SLOTS }, (_, i) =>
    normalizeToneSet(tonesIn[i], degrees[i] ?? null),
  );

  const { rhythm, rhythmOverride } = normalizeRhythmFields(o, base);

  return {
    bpm,
    key,
    degrees,
    tones,
    rhythm,
    rhythmOverride,
    gain,
    metro,
    soundMode,
  };
}
