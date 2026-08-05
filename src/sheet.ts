/**
 * Sheet = Strudel로 컴파일되는 한 장.
 * UI는 레이어/렌즈 없이 코드 4칸 + 비트 점만 만진다.
 */

export type SheetState = {
  bpm: number;
  chords: string[];
  /** 16 steps: "~" or sample token */
  beats: string[];
  sound: string;
  gain: number;
};

export const CHORDS = ["Am", "C", "G", "F", "Em", "Dm", "E7", "Am7", "-"] as const;
export const SOUNDS = ["sawtooth", "square", "triangle", "gm_epiano1"] as const;
export const HITS = ["~", "bd", "sd", "hh", "cp"] as const;

export function createInitialSheet(): SheetState {
  return {
    bpm: 96,
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

export function nextChord(current: string): string {
  const i = CHORDS.indexOf(current as (typeof CHORDS)[number]);
  return CHORDS[((i < 0 ? 0 : i) + 1) % CHORDS.length];
}

export function nextHit(current: string): string {
  const i = HITS.indexOf(current as (typeof HITS)[number]);
  return HITS[((i < 0 ? 0 : i) + 1) % HITS.length];
}

export function nextSound(current: string): string {
  const i = SOUNDS.indexOf(current as (typeof SOUNDS)[number]);
  return SOUNDS[((i < 0 ? 0 : i) + 1) % SOUNDS.length];
}
