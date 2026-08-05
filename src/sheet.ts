/**
 * 코드 = 조성의 다이아토닉 도수.
 * 기본은 메이저 스케일 도수(I–vii°). 화음 타입은 도수가 정한다.
 */

export type SheetState = {
  bpm: number;
  key: string;
  /** 0–6 diatonic degree, or null = rest */
  degrees: Array<number | null>;
  beats: string[];
  voice: VoiceId;
  gain: number;
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

export const HITS = ["~", "bd", "sd", "hh", "cp"] as const;

/** 리듬: 샘플 사이클이 아니라 패턴 프리셋 + 스텝 존재(on/off) */
export type RhythmPreset = {
  id: string;
  name: string;
  beats: string[];
};

export const RHYTHM_PRESETS: readonly RhythmPreset[] = [
  {
    id: "rock",
    name: "Rock",
    beats: ["bd", "~", "sd", "hh", "bd", "~", "sd", "hh", "bd", "bd", "sd", "hh", "bd", "~", "cp", "hh"],
  },
  {
    id: "four",
    name: "Four",
    beats: ["bd", "~", "~", "~", "bd", "~", "~", "~", "bd", "~", "~", "~", "bd", "~", "~", "~"],
  },
  {
    id: "off",
    name: "Off",
    beats: ["~", "~", "sd", "~", "~", "~", "sd", "~", "~", "~", "sd", "~", "~", "~", "sd", "~"],
  },
  {
    id: "hat",
    name: "Hats",
    beats: ["hh", "hh", "hh", "hh", "hh", "hh", "hh", "hh", "hh", "hh", "hh", "hh", "hh", "hh", "hh", "hh"],
  },
  {
    id: "sparse",
    name: "Thin",
    beats: ["bd", "~", "~", "~", "~", "~", "sd", "~", "bd", "~", "~", "~", "~", "~", "cp", "~"],
  },
  {
    id: "disco",
    name: "Disco",
    beats: ["bd", "hh", "sd", "hh", "bd", "hh", "sd", "hh", "bd", "hh", "sd", "hh", "bd", "hh", "sd", "hh"],
  },
  {
    id: "quiet",
    name: "Mute",
    beats: Array.from({ length: 16 }, () => "~"),
  },
] as const;

/** 스텝 토글: 꺼진 칸을 켤 때 자리 기본 히트 */
export function defaultHitForStep(i: number): string {
  if (i % 4 === 0) return "bd";
  if (i % 4 === 2) return "sd";
  return "hh";
}

export function toggleBeat(beats: string[], index: number): string[] {
  const next = [...beats];
  next[index] = next[index] === "~" ? defaultHitForStep(index) : "~";
  return next;
}

/** 메이저 조 → 스케일 근음 7개 */
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

/** 메이저 다이아토닉 화음 품질 */
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
  degrees: Array<number | null>;
};

export const PRESETS: readonly Preset[] = [
  { id: "pop", name: "Pop", label: "I V vi IV", degrees: [0, 4, 5, 3] },
  { id: "50s", name: "50s", label: "I vi IV V", degrees: [0, 5, 3, 4] },
  { id: "canon", name: "Canon", label: "I V vi iii", degrees: [0, 4, 5, 2] },
  { id: "axis", name: "Axis", label: "vi IV I V", degrees: [5, 3, 0, 4] },
  { id: "folk", name: "Folk", label: "I IV V I", degrees: [0, 3, 4, 0] },
  { id: "turn", name: "Turn", label: "ii V I IV", degrees: [1, 4, 0, 3] },
  { id: "sad", name: "Fall", label: "vi V IV V", degrees: [5, 4, 3, 4] },
  { id: "rise", name: "Rise", label: "I iii IV V", degrees: [0, 2, 3, 4] },
] as const;

export function createInitialSheet(): SheetState {
  return {
    bpm: 96,
    key: "C",
    degrees: [5, 0, 4, 3], // vi I V IV → Am C G F in C
    beats: [
      "bd",
      "~",
      "sd",
      "hh",
      "bd",
      "~",
      "sd",
      "hh",
      "bd",
      "bd",
      "sd",
      "hh",
      "bd",
      "~",
      "cp",
      "hh",
    ],
    voice: "warm",
    gain: 0.35,
  };
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
  if (degree === null) return "rest";
  return DEGREE_META[degree]?.roman ?? "?";
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
  const cps = sheet.bpm / 60 / 4;
  const voice = voiceById(sheet.voice);

  const chordTokens = sheet.degrees.map((d) =>
    d === null ? "~" : chordFromDegree(sheet.key, d),
  );
  const beatMini = sheet.beats.map((t) => (!t.trim() || t === "-" ? "~" : t)).join(" ");

  const hasChords = chordTokens.some((t) => t !== "~");
  const hasBeats = beatMini.split(/\s+/).some((t) => t !== "~");

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

  if (hasBeats) {
    parts.push(
      [`s("<${beatMini}>")`, `.bank("RolandTR909")`, `.gain(0.55)`, `.room(0.12)`].join(""),
    );
  }

  if (parts.length === 0) return "silence";
  if (parts.length === 1) return [`setcps(${cps})`, parts[0]!].join("\n");
  return [`setcps(${cps})`, `stack(\n  ${parts.join(",\n  ")}\n)`].join("\n");
}
