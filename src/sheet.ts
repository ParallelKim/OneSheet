/**
 * 차트 = 4행(마디) × 4열(박).
 * 리듬 = 선택 마디의 4×4 (행=4분, 칸=16분).
 * 셀: D / U / X(뮤트) / hold(링) / rest(쉼).
 *
 * soundMode: 차트 리듬·오픈셰이프를 공유하고, 타격 축만 바꾼다.
 * strum = 짧은 쓸기 후 링 / piano = 전음 동시.
 */

export type Articulation = "D" | "U" | "X" | "hold" | "rest";
export type AttackArt = "D" | "U" | "X";

export type SoundMode = {
  id: string;
  label: string;
};

/**
 * MODE — strum(기본) / piano(동시).
 */
export const SOUND_MODES: readonly SoundMode[] = [
  {
    id: "strum",
    label: "strum",
  },
  {
    id: "piano",
    label: "piano",
  },
] as const;

export type SoundModeId = (typeof SOUND_MODES)[number]["id"];

export type SheetState = {
  bpm: number;
  key: string;
  degrees: Array<number | null>;
  rhythm: Articulation[][];
  gain: number;
  metro: boolean;
  soundMode: SoundModeId;
};

/** strum — GM clean 기타 */
const TONE_STRUM = "gm_electric_guitar_clean:5";
/** piano — 전음 동시, GM 피아노 */
const TONE_PIANO = "gm_piano";

/**
 * 오픈(·바레) 셰이프 — 저→고 절대음.
 * 뮤트 현은 목록에서 빠짐 (예: C는 6현 없음).
 * 출처: 표준 오픈코드 / Splice MIDI-guitar 가이드.
 */
const OPEN_SHAPES: Record<string, readonly string[]> = {
  C: ["c3", "e3", "g3", "c4", "e4"],
  D: ["a2", "d3", "a3", "d4", "f#4"],
  E: ["e2", "b2", "e3", "g#3", "b3", "e4"],
  F: ["f2", "c3", "f3", "a3", "c4", "f4"],
  G: ["g2", "b2", "d3", "g3", "b3", "g4"],
  A: ["a2", "e3", "a3", "c#4", "e4"],
  B: ["b2", "f#3", "b3", "d#4", "f#4", "b4"],
  Am: ["a2", "e3", "a3", "c4", "e4"],
  Dm: ["a2", "d3", "a3", "d4", "f4"],
  Em: ["e2", "b2", "e3", "g3", "b3", "e4"],
  Fm: ["f2", "c3", "f3", "ab3", "c4", "f4"],
  Gm: ["g2", "d3", "g3", "bb3", "d4", "g4"],
  Bm: ["b2", "f#3", "b3", "d4", "f#4", "b4"],
  Cm: ["c3", "g3", "c4", "eb4", "g4"],
};

const PC: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

const PC_NAME = [
  "c",
  "c#",
  "d",
  "eb",
  "e",
  "f",
  "f#",
  "g",
  "ab",
  "a",
  "bb",
  "b",
] as const;

/** 현 사이 쓸기 간격(초). 너무 길면 마지막(1번줄)이 묻힘 */
const STRUM_GAP_SEC = 0.008;

export function parseChordSymbol(sym: string): {
  root: string;
  quality: "maj" | "min" | "dim";
} {
  const m = sym.match(/^([A-G][#b]?)(m|o)?$/);
  if (!m) return { root: "C", quality: "maj" };
  const root = m[1]!;
  if (m[2] === "m") return { root, quality: "min" };
  if (m[2] === "o") return { root, quality: "dim" };
  return { root, quality: "maj" };
}

function noteToMidi(note: string): number {
  const m = note.match(/^([a-gA-G][#b]?)(-?\d+)$/);
  if (!m) return 60;
  let name = m[1]!;
  name = name[0]!.toUpperCase() + name.slice(1);
  if (name.length > 1 && name[1] === "b") {
    /* Db */
  } else if (name.length > 1 && name[1] === "#") {
    /* C# */
  }
  const pc = PC[name] ?? PC[name[0]!] ?? 0;
  const oct = Number(m[2]);
  return (oct + 1) * 12 + pc;
}

function midiToNote(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${PC_NAME[pc]}${oct}`;
}

function transposeNotes(notes: readonly string[], semitones: number): string[] {
  return notes.map((n) => midiToNote(noteToMidi(n) + semitones));
}

function dimShape(root: string): string[] {
  const pc = PC[root] ?? 0;
  // A2(45) 근처에서 근음 배치
  let midi = 45 + ((pc - 9 + 12) % 12);
  if (midi < 42) midi += 12;
  return [midi, midi + 3, midi + 6, midi + 12].map(midiToNote);
}

/**
 * 코드 심볼 → 기타 지판 음 (저→고).
 * 오픈 테이블 우선, 없으면 E/Em 바레 이조, dim은 감3화음.
 */
export function guitarShape(chord: string): string[] {
  const hit = OPEN_SHAPES[chord];
  if (hit) return [...hit];
  const { root, quality } = parseChordSymbol(chord);
  if (quality === "dim") return dimShape(root);
  const base = quality === "min" ? OPEN_SHAPES.Em! : OPEN_SHAPES.E!;
  const semitones = (PC[root]! - PC.E! + 12) % 12;
  if (semitones === 0) return [...base];
  return transposeNotes(base, semitones);
}

export const BARS = 4;
export const BEATS = 4;
export const SLOTS = BARS * BEATS;
export const SUBDIV = 4;
export const BAR_STEPS = BEATS * SUBDIV;
export const TOTAL_STEPS = BARS * BAR_STEPS;

export const ARTICULATIONS: readonly {
  id: Articulation;
  label: string;
  hint: string;
}[] = [
  { id: "D", label: "D", hint: "↓" },
  { id: "U", label: "U", hint: "↑" },
  { id: "X", label: "X", hint: "✕" },
  { id: "hold", label: "·", hint: "—" },
  { id: "rest", label: "∅", hint: "ø" },
] as const;

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

const QUARTER_DOWN: Articulation[] = ["D", "hold", "hold", "hold"];

function defaultBarRhythm(): Articulation[] {
  return Array.from({ length: BEATS }, () => [...QUARTER_DOWN]).flat();
}

function defaultRhythm(): Articulation[][] {
  return Array.from({ length: BARS }, () => defaultBarRhythm());
}

function repeatBar(bar: Array<number | null>): Array<number | null> {
  return Array.from({ length: SLOTS }, (_, i) => bar[i % BEATS] ?? null);
}

export function createInitialSheet(): SheetState {
  return {
    bpm: 96,
    key: "C",
    degrees: repeatBar([5, 0, 4, 3]),
    rhythm: defaultRhythm(),
    gain: 0.55,
    metro: true,
    soundMode: "strum",
  };
}

export function soundModeById(id: string): SoundMode {
  return SOUND_MODES.find((m) => m.id === id) ?? SOUND_MODES[0]!;
}

export function nextSoundMode(current: SoundModeId): SoundModeId {
  const i = SOUND_MODES.findIndex((m) => m.id === current);
  const next = SOUND_MODES[((i < 0 ? 0 : i) + 1) % SOUND_MODES.length]!;
  return next.id;
}

export function scaleOf(key: string): readonly string[] {
  return MAJOR_KEYS[key] ?? MAJOR_KEYS.C!;
}

export function chordFromDegree(key: string, degree: number): string {
  const root = scaleOf(key)[degree] ?? "C";
  const q = DEGREE_META[degree]?.quality ?? "maj";
  if (q === "maj") return root;
  if (q === "min") return `${root}m`;
  return `${root}o`;
}

export function slotLabel(key: string, degree: number | null): string {
  if (degree === null) return "—";
  const q = DEGREE_META[degree]?.quality ?? "maj";
  const root = scaleOf(key)[degree] ?? "C";
  if (q === "maj") return root;
  if (q === "min") return `${root}m`;
  return `${root}dim`;
}

export function slotRoman(degree: number | null): string {
  if (degree === null) return "";
  return DEGREE_META[degree]?.roman ?? "";
}

export function nextKey(current: string): string {
  const i = KEY_LIST.indexOf(current);
  return KEY_LIST[((i < 0 ? 0 : i) + 1) % KEY_LIST.length]!;
}

export function barIndex(slot: number): number {
  return Math.floor(slot / BEATS);
}

export function artLabel(art: Articulation): string {
  if (art === "hold") return "·";
  if (art === "rest") return "∅";
  return art;
}

export function strumGlyph(art: Articulation): string {
  if (art === "D") return "↓";
  if (art === "U") return "↑";
  if (art === "X") return "x";
  if (art === "hold") return "·";
  return " ";
}

export function setBarArticulation(
  rhythm: Articulation[][],
  bar: number,
  step: number,
  art: Articulation,
): Articulation[][] {
  return rhythm.map((row, bi) => {
    if (bi !== bar) return row;
    return row.map((cell, si) => (si === step ? art : cell));
  });
}

function isAttack(art: Articulation): boolean {
  return art === "D" || art === "U" || art === "X";
}

export function holdRun(barRhythm: Articulation[], from: number): number {
  let n = 0;
  for (let i = from + 1; i < barRhythm.length; i++) {
    if (barRhythm[i] !== "hold") break;
    n++;
  }
  return n;
}

export function cyclesPerSecond(bpm: number): number {
  return bpm / 60 / SLOTS;
}

export type TimedEvent = {
  chord: string | null;
  steps: number;
  gain: number;
  art: AttackArt | null;
};

export type StrudelParts = {
  cps: number;
  hasHits: boolean;
  events: TimedEvent[];
  totalSteps: number;
  metro: boolean;
};

export function compileSheet(sheet: SheetState): StrudelParts {
  const events: TimedEvent[] = [];

  for (let bar = 0; bar < BARS; bar++) {
    const barRhythm = sheet.rhythm[bar] ?? defaultBarRhythm();
    let step = 0;
    while (step < BAR_STEPS) {
      const art = barRhythm[step] ?? "rest";
      const beat = Math.floor(step / SUBDIV);
      const degree = sheet.degrees[bar * BEATS + beat] ?? null;

      if (isAttack(art) && degree !== null) {
        const holds = holdRun(barRhythm, step);
        const steps = art === "X" ? 1 : 1 + holds;
        const base = sheet.gain;
        const gain =
          art === "X" ? base * 0.22 : art === "U" ? base * 0.72 : base;
        events.push({
          chord: chordFromDegree(sheet.key, degree),
          steps,
          gain: Number(gain.toFixed(3)),
          art: art as AttackArt,
        });
        if (art === "X" && holds > 0) {
          events.push({ chord: null, steps: holds, gain: 0, art: null });
        }
        step += 1 + holds;
        continue;
      }

      let span = 1;
      step += 1;
      while (step < BAR_STEPS) {
        const a2 = barRhythm[step] ?? "rest";
        const b2 = Math.floor(step / SUBDIV);
        const d2 = sheet.degrees[bar * BEATS + b2] ?? null;
        if (isAttack(a2) && d2 !== null) break;
        span += 1;
        step += 1;
      }
      events.push({ chord: null, steps: span, gain: 0, art: null });
    }
  }

  return {
    cps: cyclesPerSecond(sheet.bpm),
    hasHits: events.some((e) => e.chord !== null),
    events,
    totalSteps: events.reduce((n, e) => n + e.steps, 0),
    metro: sheet.metro,
  };
}

function metroLayer(): string {
  const clicks = Array.from({ length: SLOTS }, (_, i) =>
    i % BEATS === 0 ? "c6" : "a5",
  ).join(" ");
  return `note("${clicks}").s("triangle").gain(0.12).clip(0.03).cutoff(6000)`;
}

function stackBody(layers: string[]): string {
  if (layers.length === 0) return "silence";
  if (layers.length === 1) return layers[0]!;
  return `stack(\n  ${layers.join(",\n  ")}\n)`;
}

/**
 * 쓸기 순서로 배치된 음열 (D=저→고, U=고→저).
 * X=중현만.
 */
function strokeNotes(chord: string, art: AttackArt): string[] {
  const shape = guitarShape(chord);
  if (art === "X") {
    const mid = Math.floor(shape.length / 2);
    return shape.slice(Math.max(0, mid - 1), mid + 2);
  }
  return art === "U" ? [...shape].reverse() : [...shape];
}

/**
 * piano — 오픈셰이프 전음을 한꺼번에 (쉼표 = 동시).
 * X는 중현만·짧게.
 */
function layerPiano(parts: StrudelParts): string {
  const toks = parts.events
    .map((e) => {
      if (!e.chord || !e.art) {
        return e.steps === 1 ? "~" : `~@${e.steps}`;
      }
      const notes =
        e.art === "X" ? strokeNotes(e.chord, e.art) : guitarShape(e.chord);
      const chord = notes.join(",");
      return e.steps === 1 ? chord : `${chord}@${e.steps}`;
    })
    .join(" ");

  const gainPat = parts.events
    .map((e) => {
      if (!e.chord || !e.art) {
        return e.steps === 1 ? "0" : `0@${e.steps}`;
      }
      const durScale = Math.min(1, 2 / Math.max(1, e.steps));
      // 5~6음 동시 → 헤드룸
      const g = Number((e.gain * durScale * 0.42).toFixed(3));
      return e.steps === 1 ? String(g) : `${g}@${e.steps}`;
    })
    .join(" ");

  const clip = parts.events
    .map((e) => {
      if (!e.chord || !e.art) {
        return e.steps === 1 ? "0" : `0@${e.steps}`;
      }
      const c = e.art === "X" ? 0.18 : 0.92;
      return e.steps === 1 ? String(c) : `${c}@${e.steps}`;
    })
    .join(" ");

  return [
    `note("${toks}")`,
    `.s("${TONE_PIANO}")`,
    `.gain("${gainPat}")`,
    `.clip("${clip}")`,
    `.decay(0.15)`,
    `.sustain(0.45)`,
  ].join("");
}

/**
 * 오픈셰이프 note + late 스트럼.
 * - 코드마다 5~6음 (C/Am 오픈은 6번줄 뮤트 → 5)
 * - late로 onset만 어긋남. clip을 late만큼 줄여 다음 코드와 안 겹침
 * - 피치별 gain: 저현↓ / **1번줄(고현)↑** — GM이 고현을 작게 내는 보정
 * - hpf로 저역 머드 컷
 */
function noteMidi(tok: string): number {
  const m = tok.match(/^([a-g])([#b]?)(-?\d+)$/i);
  if (!m) return 60;
  const letter = m[1]!.toLowerCase();
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  const oct = Number(m[3]);
  const base: Record<string, number> = {
    c: 0,
    d: 2,
    e: 4,
    f: 5,
    g: 7,
    a: 9,
    b: 11,
  };
  return (oct + 1) * 12 + (base[letter] ?? 0) + acc;
}

/** GM clean 보정 — 저현 억제, 1번줄(e4~) 부스트 */
function pitchGain(midi: number): number {
  if (midi >= 67) return 1.55; // g4+ (G/F 1번줄)
  if (midi >= 64) return 1.45; // e4 (C/Am 1번줄)
  if (midi >= 60) return 1.1; // c4
  if (midi >= 55) return 0.82; // g3
  if (midi >= 52) return 0.58; // e3
  if (midi >= 48) return 0.38; // c3
  if (midi >= 45) return 0.26; // a2
  return 0.2; // e2~g2
}

function layerStrum(parts: StrudelParts): string {
  const maxVoices = Math.max(
    1,
    ...parts.events.map((e) =>
      e.chord && e.art ? strokeNotes(e.chord, e.art).length : 0,
    ),
  );
  const gap = Number((STRUM_GAP_SEC * parts.cps).toFixed(5));
  const total = Math.max(1, parts.totalSteps);
  const voices: string[] = [];

  for (let slot = 0; slot < maxVoices; slot++) {
    const lateAmt = slot * gap;
    const toks = parts.events
      .map((e) => {
        if (!e.chord || !e.art) {
          return e.steps === 1 ? "~" : `~@${e.steps}`;
        }
        const n = strokeNotes(e.chord, e.art)[slot];
        if (!n) return e.steps === 1 ? "~" : `~@${e.steps}`;
        return e.steps === 1 ? n : `${n}@${e.steps}`;
      })
      .join(" ");

    const gainPat = parts.events
      .map((e) => {
        if (!e.chord || !e.art) {
          return e.steps === 1 ? "0" : `0@${e.steps}`;
        }
        const n = strokeNotes(e.chord, e.art)[slot];
        if (!n) return e.steps === 1 ? "0" : `0@${e.steps}`;
        const durScale = Math.min(1, 2 / Math.max(1, e.steps));
        const g = Number(
          (e.gain * durScale * pitchGain(noteMidi(n))).toFixed(3),
        );
        return e.steps === 1 ? String(g) : `${g}@${e.steps}`;
      })
      .join(" ");

    // late만큼 clip↓ — 바닥을 더 높여 마지막 현(1번줄)이 너무 짧아지지 않게
    const clip = parts.events
      .map((e) => {
        if (!e.chord || !e.art) {
          return e.steps === 1 ? "0" : `0@${e.steps}`;
        }
        if (e.art === "X") {
          return e.steps === 1 ? "0.18" : `0.18@${e.steps}`;
        }
        const dur = e.steps / total;
        const room = Math.max(0.55, (dur - lateAmt) / dur);
        const c = Number((room * 0.92).toFixed(3));
        return e.steps === 1 ? String(c) : `${c}@${e.steps}`;
      })
      .join(" ");

    let line = [
      `note("${toks}")`,
      `.s("${TONE_STRUM}")`,
      `.gain("${gainPat}")`,
      `.clip("${clip}")`,
      `.hpf(180)`,
      `.decay(0.08)`,
      `.sustain(0.4)`,
    ].join("");
    if (slot > 0 && gap > 0) {
      line += `.late(${lateAmt.toFixed(5)})`;
    }
    voices.push(line);
  }

  return stackBody(voices);
}

function chartToStrudel(sheet: SheetState, modeId: SoundModeId): string {
  const parts = compileSheet(sheet);
  const layers: string[] = [];

  if (parts.hasHits) {
    if (modeId === "piano") {
      layers.push(layerPiano(parts));
    } else {
      layers.push(layerStrum(parts));
    }
  }

  if (parts.metro) layers.push(metroLayer());

  const body = stackBody(layers);
  if (body === "silence") return "silence";
  return `setcps(${parts.cps})\n${body}`;
}

/**
 * Play/재평가용 코드 — 차트 리듬·코드·BPM 반영.
 */
export function toStrudel(sheet: SheetState): string {
  return chartToStrudel(sheet, soundModeById(sheet.soundMode).id);
}
