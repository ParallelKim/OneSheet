/**
 * Sheet = 한 조 안의 코드 슬롯 + 비트.
 * 코드 입력 기준: Key → diatonic degrees (I–vi). 임의 사이클 없음.
 */

export type SheetState = {
  bpm: number;
  /** e.g. "C", "G", "Am" */
  key: string;
  /** absolute chord names in slots; "-" = rest */
  chords: string[];
  beats: string[];
  sound: string;
  gain: number;
};

/** 조 → 도수(I ii iii IV V vi) 절대 코드 */
export const KEYS: Record<string, readonly string[]> = {
  C: ["C", "Dm", "Em", "F", "G", "Am"],
  G: ["G", "Am", "Bm", "C", "D", "Em"],
  D: ["D", "Em", "F#m", "G", "A", "Bm"],
  A: ["A", "Bm", "C#m", "D", "E", "F#m"],
  E: ["E", "F#m", "G#m", "A", "B", "C#m"],
  F: ["F", "Gm", "Am", "Bb", "C", "Dm"],
  Am: ["Am", "Bdim", "C", "Dm", "E", "F"],
  Em: ["Em", "F#dim", "G", "Am", "B", "C"],
  Dm: ["Dm", "Edim", "F", "Gm", "A", "Bb"],
} as const;

export const KEY_LIST = Object.keys(KEYS);

export const DEGREES = ["I", "ii", "iii", "IV", "V", "vi"] as const;

export const SOUNDS = ["sawtooth", "square", "triangle", "gm_epiano1"] as const;
export const HITS = ["~", "bd", "sd", "hh", "cp"] as const;

export function createInitialSheet(): SheetState {
  return {
    bpm: 96,
    key: "C",
    chords: ["Am", "C", "G", "F"],
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
    sound: "sawtooth",
    gain: 0.35,
  };
}

export function paletteFor(key: string): readonly string[] {
  return KEYS[key] ?? KEYS.C!;
}

export function degreeOf(key: string, chord: string): string | null {
  if (chord === "-") return null;
  const i = paletteFor(key).indexOf(chord);
  return i >= 0 ? DEGREES[i]! : null;
}

export function nextKey(current: string): string {
  const i = KEY_LIST.indexOf(current);
  return KEY_LIST[((i < 0 ? 0 : i) + 1) % KEY_LIST.length]!;
}

/** 조가 바뀌면 슬롯을 같은 도수 코드로 옮긴다. 없으면 비움. */
export function remapChordsToKey(chords: string[], fromKey: string, toKey: string): string[] {
  const from = paletteFor(fromKey);
  const to = paletteFor(toKey);
  return chords.map((c) => {
    if (c === "-") return "-";
    const i = from.indexOf(c);
    if (i >= 0) return to[i]!;
    const j = to.indexOf(c);
    return j >= 0 ? c : "-";
  });
}

export function nextHit(current: string): string {
  const i = HITS.indexOf(current as (typeof HITS)[number]);
  return HITS[((i < 0 ? 0 : i) + 1) % HITS.length]!;
}

export function nextSound(current: string): string {
  const i = SOUNDS.indexOf(current as (typeof SOUNDS)[number]);
  return SOUNDS[((i < 0 ? 0 : i) + 1) % SOUNDS.length]!;
}

function mini(tokens: string[]): string {
  return tokens
    .map((t) => {
      const s = t.trim();
      return !s || s === "-" ? "~" : s;
    })
    .join(" ");
}

export function toStrudel(sheet: SheetState): string {
  const cps = sheet.bpm / 60 / 4;
  const chordMini = mini(sheet.chords);
  const beatMini = mini(sheet.beats);
  const hasChords = !chordMini.split(/\s+/).every((t) => t === "~");
  const hasBeats = !beatMini.split(/\s+/).every((t) => t === "~");

  const parts: string[] = [];
  if (hasChords) {
    parts.push(
      [
        `chord("<${chordMini}>")`,
        `.voicing('legacy')`,
        `.s("${sheet.sound}")`,
        `.gain(${sheet.gain.toFixed(2)})`,
        `.cutoff(1800)`,
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
