/**
 * 차트 = 4행 × 4열.
 * 각 칸 = 4분음표, 각 행 = 한 마디(4/4).
 * 리듬 머신 없음 — 메트로놈만.
 */

export type SheetState = {
  bpm: number;
  key: string;
  /** 16 slots: row-major, each = quarter note. null = rest */
  degrees: Array<number | null>;
  voice: VoiceId;
  gain: number;
  metro: boolean;
};

export type VoiceId = "warm" | "bright" | "soft" | "keys";

export const VOICES: readonly {
  id: VoiceId;
  label: string;
  sound: string;
  cutoff: number;
}[] = [
  { id: "warm", label: "웜", sound: "sawtooth", cutoff: 1400 },
  { id: "bright", label: "샤프", sound: "square", cutoff: 3200 },
  { id: "soft", label: "소프트", sound: "triangle", cutoff: 1800 },
  { id: "keys", label: "피아노", sound: "gm_epiano1", cutoff: 2400 },
] as const;

export const BARS = 4;
export const BEATS = 4;
export const SLOTS = BARS * BEATS; // 16

export const MAJOR_KEYS: Record<string, readonly string[]> = {
  C: ["C", "D", "E", "F", "G", "A", "B"],
  G: ["G", "A", "B", "C", "D", "E", "F#"],
  D: ["D", "E", "F#", "G", "A", "B", "C#"],
  A: ["A", "B", "C#", "D", "E", "F#", "G#"],
  E: ["E", "F#", "G#", "A", "B", "C#", "D#"],
  F: ["F", "G", "A", "Bb", "C", "D", "E"],
  Bb: ["Bb", "C", "D", "Eb", "F", "G", "A"],
};

export const KEY_LIST = Object.keys(MAJOR_KEYS);

export const DEGREE_META = [
  { roman: "I", quality: "maj" },
  { roman: "ii", quality: "min" },
  { roman: "iii", quality: "min" },
  { roman: "IV", quality: "maj" },
  { roman: "V", quality: "maj" },
  { roman: "vi", quality: "min" },
  { roman: "vii°", quality: "dim" },
] as const;

export type Preset = {
  id: string;
  name: string;
  label: string;
  /** one bar (4 quarters); repeated across all bars */
  bar: Array<number | null>;
};

export const PRESETS: readonly Preset[] = [
  { id: "pop", name: "Pop", label: "I V vi IV", bar: [0, 4, 5, 3] },
  { id: "50s", name: "50s", label: "I vi IV V", bar: [0, 5, 3, 4] },
  { id: "canon", name: "Canon", label: "I V vi iii", bar: [0, 4, 5, 2] },
  { id: "axis", name: "Axis", label: "vi IV I V", bar: [5, 3, 0, 4] },
  { id: "folk", name: "Folk", label: "I IV V I", bar: [0, 3, 4, 0] },
  { id: "turn", name: "Turn", label: "ii V I IV", bar: [1, 4, 0, 3] },
  { id: "fall", name: "Fall", label: "vi V IV V", bar: [5, 4, 3, 4] },
  { id: "rise", name: "Rise", label: "I iii IV V", bar: [0, 2, 3, 4] },
] as const;

function repeatBar(bar: Array<number | null>): Array<number | null> {
  return Array.from({ length: SLOTS }, (_, i) => bar[i % BEATS] ?? null);
}

export function createInitialSheet(): SheetState {
  return {
    bpm: 96,
    key: "C",
    degrees: repeatBar([5, 0, 4, 3]), // vi I V IV
    voice: "warm",
    gain: 0.35,
    metro: true,
  };
}

export function applyPreset(bar: Array<number | null>): Array<number | null> {
  return repeatBar(bar);
}

export function scaleOf(key: string): readonly string[] {
  return MAJOR_KEYS[key] ?? MAJOR_KEYS.C!;
}

export function chordFromDegree(key: string, degree: number): string {
  const root = scaleOf(key)[degree] ?? "C";
  const q = DEGREE_META[degree]?.quality ?? "maj";
  if (q === "maj") return root;
  if (q === "min") return `${root}m`;
  return `${root}dim`;
}

export function slotLabel(key: string, degree: number | null): string {
  if (degree === null) return "—";
  return chordFromDegree(key, degree);
}

export function slotRoman(degree: number | null): string {
  if (degree === null) return "";
  return DEGREE_META[degree]?.roman ?? "";
}

export function nextKey(current: string): string {
  const i = KEY_LIST.indexOf(current);
  return KEY_LIST[((i < 0 ? 0 : i) + 1) % KEY_LIST.length]!;
}

export function voiceById(id: VoiceId) {
  return VOICES.find((v) => v.id === id) ?? VOICES[0]!;
}

function mini(tokens: string[]): string {
  return tokens.join(" ");
}

export function toStrudel(sheet: SheetState): string {
  // 16 quarters = 4 bars → one cycle spans 16 beats
  const cps = sheet.bpm / 60 / SLOTS;
  const voice = voiceById(sheet.voice);

  const chordTokens = sheet.degrees.map((d) =>
    d === null ? "~" : chordFromDegree(sheet.key, d),
  );
  const hasChords = chordTokens.some((t) => t !== "~");

  const parts: string[] = [];

  if (hasChords) {
    parts.push(
      [
        `chord("<${mini(chordTokens)}>")`,
        `.voicing('legacy')`,
        `.s("${voice.sound}")`,
        `.gain(${sheet.gain.toFixed(2)})`,
        `.cutoff(${voice.cutoff})`,
        `.clip(0.85)`,
      ].join(""),
    );
  }

  if (sheet.metro) {
    // quiet quarter click through the 16-beat cycle
    parts.push(`s("woodblock").struct("x*${SLOTS}").gain(0.08)`);
  }

  if (parts.length === 0) return "silence";
  if (parts.length === 1) return [`setcps(${cps})`, parts[0]!].join("\n");
  return [`setcps(${cps})`, `stack(\n  ${parts.join(",\n  ")}\n)`].join("\n");
}
