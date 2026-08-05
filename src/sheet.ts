/**
 * 코드 슬롯 = 근음 × 퀄리티.
 * 같은 근음에서 단음 / M / m / 7 / m7 / dim / aug / 5(pow)를 고른다.
 */

export type Quality = "tone" | "maj" | "min" | "dom7" | "m7" | "dim" | "aug" | "pow";

export type ChordSlot = {
  root: string;
  quality: Quality;
};

export type SheetState = {
  bpm: number;
  /** UI 힌트용 조 — 근음 팔레트 강조 */
  key: string;
  chords: Array<ChordSlot | null>;
  beats: string[];
  voice: VoiceId;
  gain: number;
};

export const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export const QUALITIES: readonly { id: Quality; label: string; hint: string }[] = [
  { id: "tone", label: "단", hint: "단음" },
  { id: "maj", label: "M", hint: "메이저" },
  { id: "min", label: "m", hint: "마이너" },
  { id: "dom7", label: "7", hint: "도미넌트7" },
  { id: "m7", label: "m7", hint: "마이너7" },
  { id: "dim", label: "dim", hint: "디미니시드" },
  { id: "aug", label: "aug", hint: "어그멘티드" },
  { id: "pow", label: "5", hint: "파워" },
] as const;

/** 조 → 근음 강조(이 조 스케일 음) */
export const KEY_ROOTS: Record<string, readonly string[]> = {
  C: ["C", "D", "E", "F", "G", "A", "B"],
  G: ["G", "A", "B", "C", "D", "E", "F#"],
  D: ["D", "E", "F#", "G", "A", "B", "C#"],
  A: ["A", "B", "C#", "D", "E", "F#", "G#"],
  E: ["E", "F#", "G#", "A", "B", "C#", "D#"],
  F: ["F", "G", "A", "A#", "C", "D", "E"],
  Am: ["A", "B", "C", "D", "E", "F", "G"],
  Em: ["E", "F#", "G", "A", "B", "C", "D"],
  Dm: ["D", "E", "F", "G", "A", "A#", "C"],
};

export const KEY_LIST = Object.keys(KEY_ROOTS);

export type VoiceId = "warm" | "bright" | "soft" | "keys";

export const VOICES: readonly {
  id: VoiceId;
  label: string;
  sound: string;
  cutoff: number;
}[] = [
  { id: "warm", label: "따뜻", sound: "sawtooth", cutoff: 1400 },
  { id: "bright", label: "날카", sound: "square", cutoff: 3200 },
  { id: "soft", label: "둥글", sound: "triangle", cutoff: 1800 },
  { id: "keys", label: "건반", sound: "gm_epiano1", cutoff: 2400 },
] as const;

export const HITS = ["~", "bd", "sd", "hh", "cp"] as const;

export function createInitialSheet(): SheetState {
  return {
    bpm: 96,
    key: "C",
    chords: [
      { root: "A", quality: "min" },
      { root: "C", quality: "maj" },
      { root: "G", quality: "maj" },
      { root: "F", quality: "maj" },
    ],
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

export function slotLabel(slot: ChordSlot | null): string {
  if (!slot) return "—";
  const { root, quality } = slot;
  switch (quality) {
    case "tone":
      return root;
    case "maj":
      return root;
    case "min":
      return `${root}m`;
    case "dom7":
      return `${root}7`;
    case "m7":
      return `${root}m7`;
    case "dim":
      return `${root}dim`;
    case "aug":
      return `${root}aug`;
    case "pow":
      return `${root}5`;
  }
}

export function slotHint(slot: ChordSlot | null): string {
  if (!slot) return "쉼";
  if (slot.quality === "tone") return "단음";
  if (slot.quality === "maj") return "M";
  return QUALITIES.find((q) => q.id === slot.quality)?.label ?? "";
}

export function nextKey(current: string): string {
  const i = KEY_LIST.indexOf(current);
  return KEY_LIST[((i < 0 ? 0 : i) + 1) % KEY_LIST.length]!;
}

export function nextHit(current: string): string {
  const i = HITS.indexOf(current as (typeof HITS)[number]);
  return HITS[((i < 0 ? 0 : i) + 1) % HITS.length]!;
}

export function voiceById(id: VoiceId) {
  return VOICES.find((v) => v.id === id) ?? VOICES[0]!;
}

function rootToNoteToken(root: string): string {
  // Strudel note mini: c, c#, db… — octave 3
  const map: Record<string, string> = {
    C: "c3",
    "C#": "c#3",
    D: "d3",
    "D#": "d#3",
    E: "e3",
    F: "f3",
    "F#": "f#3",
    G: "g3",
    "G#": "g#3",
    A: "a3",
    "A#": "a#3",
    B: "b3",
  };
  return map[root] ?? "c3";
}

function chordToken(slot: ChordSlot): string {
  // Strudel chord symbols (no bare maj suffix)
  switch (slot.quality) {
    case "maj":
      return slot.root.replace("#", "#");
    case "min":
      return `${slot.root}m`;
    case "dom7":
      return `${slot.root}7`;
    case "m7":
      return `${slot.root}m7`;
    case "dim":
      return `${slot.root}dim`;
    case "aug":
      return `${slot.root}aug`;
    case "pow":
      return `${slot.root}5`;
    case "tone":
      return "~";
  }
}

function mini(tokens: string[]): string {
  return tokens.join(" ");
}

export function toStrudel(sheet: SheetState): string {
  const cps = sheet.bpm / 60 / 4;
  const voice = voiceById(sheet.voice);

  const chordTokens = sheet.chords.map((s) => (s && s.quality !== "tone" ? chordToken(s) : "~"));
  const noteTokens = sheet.chords.map((s) => (s?.quality === "tone" ? rootToNoteToken(s.root) : "~"));
  const beatMini = sheet.beats.map((t) => (!t.trim() || t === "-" ? "~" : t)).join(" ");

  const hasChords = chordTokens.some((t) => t !== "~");
  const hasTones = noteTokens.some((t) => t !== "~");
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

  if (hasTones) {
    parts.push(
      [
        `note("<${mini(noteTokens)}>")`,
        `.s("${voice.sound}")`,
        `.gain(${(sheet.gain * 0.9).toFixed(2)})`,
        `.cutoff(${voice.cutoff})`,
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
