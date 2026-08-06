/**
 * 차트 = 4행(마디) × 4열(박).
 * 리듬 = 선택 마디의 4×4 (행=4분, 칸=16분).
 * 셀: D / U / X(뮤트) / hold(링) / rest(쉼).
 *
 * soundMode: 차트 리듬을 공유하고, 한 축만 바꾼다.
 * strum = 6현 짧은 쓸기 후 동시 링 (도수 아르페지오 아님).
 */

export type Articulation = "D" | "U" | "X" | "hold" | "rest";
export type AttackArt = "D" | "U" | "X";

export type SoundModeKind = "chart" | "example";

export type SoundMode = {
  id: string;
  label: string;
  kind: SoundModeKind;
  code?: string;
};

/**
 * MODE — block/strum/arp/gm = 차트. docs = recipes 원문 1개.
 */
export const SOUND_MODES: readonly SoundMode[] = [
  {
    id: "block",
    label: "block",
    kind: "chart",
  },
  {
    id: "strum",
    label: "strum",
    kind: "chart",
  },
  {
    id: "arp",
    label: "arp",
    kind: "chart",
  },
  {
    id: "gm",
    label: "gm",
    kind: "chart",
  },
  {
    id: "docs",
    label: "docs",
    kind: "example",
    code: `n("0 1 2 3").chord("Cm").mode("above:c3").voicing()
.clip(2).s("gm_electric_guitar_clean")`,
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

const TONE_SAW = { sound: "sawtooth", cutoff: 1400 } as const;
const TONE_GM = "gm_electric_guitar_clean:5";
/** strum — GM clean 기타 (피아노 SF는 톤이 너무 피아노) */
const TONE_STRUM = "gm_electric_guitar_clean:5";

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

/** 현 사이 쓸기 간격(초). late(cycles) = sec * cps */
const STRUM_GAP_SEC = 0.012;

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
    soundMode: "block",
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

function timedChord(events: TimedEvent[]): string {
  return events
    .map((e) => {
      const tok = e.chord ?? "~";
      return e.steps === 1 ? tok : `${tok}@${e.steps}`;
    })
    .join(" ");
}

function timedGain(events: TimedEvent[]): string {
  return events
    .map((e) => {
      const g = e.chord ? e.gain : 0;
      return e.steps === 1 ? String(g) : `${g}@${e.steps}`;
    })
    .join(" ");
}

/**
 * D/U를 hold 길이에 펼침 (recipes arp 축 — 스트로크 아님).
 */
function timedArpN(events: TimedEvent[]): string {
  return events
    .map((e) => {
      if (!e.chord || !e.art) {
        return e.steps === 1 ? "~" : `~@${e.steps}`;
      }
      if (e.art === "X") {
        return e.steps === 1 ? "[0,1,2]" : `[0,1,2]@${e.steps}`;
      }
      const order = e.art === "D" ? "[0 1 2 3]" : "[3 2 1 0]";
      return e.steps === 1 ? order : `${order}@${e.steps}`;
    })
    .join(" ");
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

/** 한꺼번에 — 동시 보이싱 */
function layerBlock(parts: StrudelParts): string {
  return [
    `chord("${timedChord(parts.events)}")`,
    `.dict("triads")`,
    `.voicing()`,
    `.s("${TONE_SAW.sound}")`,
    `.gain("${timedGain(parts.events)}")`,
    `.cutoff(${TONE_SAW.cutoff})`,
    `.clip(0.95)`,
  ].join("");
}

/**
 * 한 음씩 — recipes arp (스트로크 아님).
 */
function layerArp(
  parts: StrudelParts,
  sound: string,
  opts: { cutoff?: number; clip: number },
): string {
  const out = [
    `n("${timedArpN(parts.events)}")`,
    `.chord("${timedChord(parts.events)}")`,
    `.dict("triads")`,
    `.mode("above:c3")`,
    `.voicing()`,
    `.s("${sound}")`,
    `.gain("${timedGain(parts.events)}")`,
  ];
  if (opts.cutoff != null) out.push(`.cutoff(${opts.cutoff})`);
  out.push(`.clip(${opts.clip})`);
  return out.join("");
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
 * 오픈셰이프 note + late 스트럼.
 * - onset만 수 ms 어긋남 → 먼저 친 현이 같은 길이만큼 먼저 끝남
 * - hold가 길수록 gain↓ (지속∝작아짐)
 * - 기본 사운드폰트(그랜드) — GM 기타 바디 배제
 */
function layerStrum(parts: StrudelParts): string {
  const maxVoices = Math.max(
    1,
    ...parts.events.map((e) =>
      e.chord && e.art ? strokeNotes(e.chord, e.art).length : 0,
    ),
  );
  const gap = Number((STRUM_GAP_SEC * parts.cps).toFixed(5));
  const voices: string[] = [];

  for (let slot = 0; slot < maxVoices; slot++) {
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

    // 지속 시간에 반비례한 gain (긴 hold → 작음) + 저현 살짝 억제
    const gainPat = parts.events
      .map((e) => {
        if (!e.chord || !e.art) {
          return e.steps === 1 ? "0" : `0@${e.steps}`;
        }
        const durScale = Math.min(1, 2 / Math.max(1, e.steps));
        const stringLift =
          0.72 + (0.28 * slot) / Math.max(1, maxVoices - 1);
        const g = Number((e.gain * durScale * stringLift).toFixed(3));
        return e.steps === 1 ? String(g) : `${g}@${e.steps}`;
      })
      .join(" ");

    const clip = parts.events
      .map((e) => {
        if (!e.chord || !e.art) {
          return e.steps === 1 ? "0" : `0@${e.steps}`;
        }
        // X 짧게. D/U는 clip1 — late된 현도 동일 길이(먼저 시작=먼저 끝)
        const c = e.art === "X" ? 0.18 : 1;
        return e.steps === 1 ? String(c) : `${c}@${e.steps}`;
      })
      .join(" ");

    let line = [
      `note("${toks}")`,
      `.s("${TONE_STRUM}")`,
      `.gain("${gainPat}")`,
      `.clip("${clip}")`,
      // 울리는 동안 작아짐 (지속∝감쇠)
      `.decay(0.12)`,
      `.sustain(0.35)`,
    ].join("");
    if (slot > 0 && gap > 0) {
      line += `.late(${(slot * gap).toFixed(5)})`;
    }
    voices.push(line);
  }

  return stackBody(voices);
}

function chartToStrudel(sheet: SheetState, modeId: SoundModeId): string {
  const parts = compileSheet(sheet);
  const layers: string[] = [];

  if (parts.hasHits) {
    if (modeId === "strum") {
      layers.push(layerStrum(parts));
    } else if (modeId === "arp") {
      layers.push(
        layerArp(parts, TONE_SAW.sound, {
          cutoff: TONE_SAW.cutoff,
          clip: 1.2,
        }),
      );
    } else if (modeId === "gm") {
      layers.push(layerArp(parts, TONE_GM, { clip: 2 }));
    } else {
      layers.push(layerBlock(parts));
    }
  }

  if (parts.metro) layers.push(metroLayer());

  const body = stackBody(layers);
  if (body === "silence") return "silence";
  return `setcps(${parts.cps})\n${body}`;
}

/**
 * Play/재평가용 코드.
 * chart MODE = 리듬·코드·BPM 반영. docs만 원문.
 */
export function toStrudel(sheet: SheetState): string {
  const mode = soundModeById(sheet.soundMode);
  if (mode.kind === "example" && mode.code) {
    return mode.code;
  }
  return chartToStrudel(sheet, mode.id);
}
