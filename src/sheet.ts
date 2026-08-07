/**
 * 차트 = 4행(마디) × 4열(박).
 * 리듬 = 1마디 기본(rhythm) + 이후 마디 override(또는 상속).
 * 화성 = 근음 도수(위) × 구성음 토글(아래). 퀄리티는 결과.
 *
 * soundMode: strum = 쓸기 / piano = 동시.
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
  /** 슬롯 근음 도수 0–6. null = 쉼 */
  degrees: Array<number | null>;
  /**
   * 슬롯 구성음(근음 기준 간격). degrees[i]==null 이면 null.
   * 예: Maj = 1·3·5, min = 1·b3·5
   */
  tones: Array<ToneSet | null>;
  /** 기본 리듬 = 1마디(bar 0). 16분음표 × 16 */
  rhythm: Articulation[];
  /**
   * 마디별 override. 길이 = BARS.
   * [0]은 항상 null (bar0이 소스).
   * null = `rhythm` 상속, 배열 = 이 마디만 따로.
   */
  rhythmOverride: Array<Articulation[] | null>;
  gain: number;
  metro: boolean;
  soundMode: SoundModeId;
};

/** DEG 하위 8칸 — 근음 기준 구성음 */
/** 저장·심볼·재생용 전체 간격 */
export const CHORD_INTERVALS = [
  "1",
  "b2",
  "2",
  "b3",
  "3",
  "4",
  "b5",
  "5",
  "b6",
  "6",
  "b7",
  "7",
] as const;

export type ChordInterval = (typeof CHORD_INTERVALS)[number];
export type ToneSet = readonly ChordInterval[];

/**
 * DEG 하단: 근음 기준 상대도수 축.
 * 클릭 = 단도 → 장도(·완전) → 해제 순회. 한 축이 여러 의미를 담는다.
 * (슬롯 8칸 중 7축 사용, 나머지 idle)
 */
export const TONE_AXES = [
  { id: "1", steps: ["1"] as const },
  { id: "2", steps: ["b2", "2", null] as const },
  { id: "3", steps: ["b3", "3", null] as const },
  { id: "4", steps: ["4", null] as const },
  { id: "5", steps: ["b5", "5", null] as const },
  { id: "6", steps: ["b6", "6", null] as const },
  { id: "7", steps: ["b7", "7", null] as const },
] as const;

export type ToneAxis = (typeof TONE_AXES)[number];
export type ToneAxisId = ToneAxis["id"];

const INTERVAL_ST: Record<ChordInterval, number> = {
  "1": 0,
  b2: 1,
  "2": 2,
  b3: 3,
  "3": 4,
  "4": 5,
  b5: 6,
  "5": 7,
  b6: 8,
  "6": 9,
  b7: 10,
  "7": 11,
};

const TONES_MAJ: ToneSet = ["1", "3", "5"];
const TONES_MIN: ToneSet = ["1", "b3", "5"];
const TONES_DIM: ToneSet = ["1", "b3", "b5"];

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
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  "E#": 5,
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
  Cb: 11,
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
 * 오픈 테이블 우선, 없으면 구성음 간격으로 쌓기.
 */
export function guitarShape(chord: string): string[] {
  const hit = OPEN_SHAPES[chord];
  if (hit) return [...hit];
  const { root, tones } = decodeChordToTones(chord);
  if (tones === TONES_DIM || decodeIsDim(chord)) {
    return dimShape(root);
  }
  const baseQ = hasTone(tones, "b3") ? "min" : "maj";
  // 단순 triad/open 계열은 E/Em 바레
  if (
    artsToneEqual(tones, TONES_MAJ) ||
    artsToneEqual(tones, TONES_MIN)
  ) {
    const base = baseQ === "min" ? OPEN_SHAPES.Em! : OPEN_SHAPES.E!;
    const semitones = (PC[root]! - PC.E! + 12) % 12;
    if (semitones === 0) return [...base];
    return transposeNotes(base, semitones);
  }
  return buildIntervalShape(root, tones);
}

function decodeIsDim(chord: string): boolean {
  return /o$|dim$/.test(chord) && !chord.includes("7");
}

function artsToneEqual(a: ToneSet, b: ToneSet): boolean {
  const na = normTones(a);
  const nb = normTones(b);
  return na.length === nb.length && na.every((t, i) => t === nb[i]);
}

function decodeChordToTones(sym: string): { root: string; tones: ToneSet } {
  const m = sym.match(/^([A-G][#b]?)(.*)$/);
  const root = m?.[1] ?? "C";
  const suf = m?.[2] ?? "";
  if (suf === "m") return { root, tones: TONES_MIN };
  if (suf === "o" || suf === "dim") return { root, tones: TONES_DIM };
  if (suf === "m7") return { root, tones: ["1", "b3", "5", "b7"] };
  if (suf === "7") return { root, tones: ["1", "3", "5", "b7"] };
  if (suf === "maj7") return { root, tones: ["1", "3", "5", "7"] };
  if (suf === "sus4") return { root, tones: ["1", "4", "5"] };
  if (suf === "7sus4") return { root, tones: ["1", "4", "5", "b7"] };
  if (suf === "sus2") return { root, tones: ["1", "2", "5"] };
  if (suf === "7sus2") return { root, tones: ["1", "2", "5", "b7"] };
  if (suf === "add2" || suf === "add9") return { root, tones: ["1", "2", "3", "5"] };
  if (suf === "madd2" || suf === "madd9") return { root, tones: ["1", "2", "b3", "5"] };
  if (suf === "9") return { root, tones: ["1", "2", "3", "5", "b7"] };
  if (suf === "m9") return { root, tones: ["1", "2", "b3", "5", "b7"] };
  if (suf === "maj9") return { root, tones: ["1", "2", "3", "5", "7"] };
  if (suf === "6") return { root, tones: ["1", "3", "5", "6"] };
  if (suf === "m6") return { root, tones: ["1", "b3", "5", "6"] };
  if (suf === "aug") return { root, tones: ["1", "3", "b6"] };
  if (suf === "5") return { root, tones: ["1", "5"] };
  if (suf === "ø" || suf === "m7b5") return { root, tones: ["1", "b3", "b5", "b7"] };
  if (suf === "mMaj7") return { root, tones: ["1", "b3", "5", "7"] };
  if (suf === "b5") return { root, tones: ["1", "3", "b5"] };
  return { root, tones: TONES_MAJ };
}

function buildIntervalShape(root: string, tones: ToneSet): string[] {
  const pc = PC[root] ?? 0;
  let midi = 45 + ((pc - 9 + 12) % 12);
  if (midi < 40) midi += 12;
  const sts = normTones(tones).map((id) => INTERVAL_ST[id]);
  const notes: number[] = [];
  let prev = midi - 1;
  for (const st of sts) {
    let n = midi + st;
    while (n <= prev) n += 12;
    notes.push(n);
    prev = n;
  }
  if (notes.length >= 2 && notes.length <= 4) {
    notes.push(notes[0]! + 12);
  }
  return notes.map(midiToNote);
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
  B: ["B", "C#", "D#", "E", "F#", "G#", "A#"],
  "F#": ["F#", "G#", "A#", "B", "C#", "D#", "E#"],
  Db: ["Db", "Eb", "F", "Gb", "Ab", "Bb", "C"],
  Ab: ["Ab", "Bb", "C", "Db", "Eb", "F", "G"],
  Eb: ["Eb", "F", "G", "Ab", "Bb", "C", "D"],
  Bb: ["Bb", "C", "D", "Eb", "F", "G", "A"],
  F: ["F", "G", "A", "Bb", "C", "D", "E"],
};

/**
 * 5도권 (시계방향 = 조표 ♯·완전5도 위).
 * C→G→…→F#→Db→…→F→C — 메이저 12조 전부.
 */
export const CIRCLE_OF_FIFTHS = [
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "Db",
  "Ab",
  "Eb",
  "Bb",
  "F",
] as const;

export type MajorKey = (typeof CIRCLE_OF_FIFTHS)[number];

export const KEY_LIST: readonly string[] = CIRCLE_OF_FIFTHS;

/** 조표처럼 5도권으로 steps칸 이동 (+ = ♯쪽, − = ♭쪽) */
export function shiftKey(current: string, steps: number): string {
  const i = CIRCLE_OF_FIFTHS.indexOf(current as MajorKey);
  const from = i < 0 ? 0 : i;
  const n = CIRCLE_OF_FIFTHS.length;
  return CIRCLE_OF_FIFTHS[((from + steps) % n + n) % n]!;
}

/** @deprecated shiftKey(current, 1) — 5도권 ♯쪽 */
export function nextKey(current: string): string {
  return shiftKey(current, 1);
}

/** 화면용 키 이름 (F# → F♯) */
export function formatKeyGlyph(key: string): string {
  return key.replace("#", "♯").replace("b", "♭");
}

export const DEGREE_META = [
  { roman: "I", quality: "maj" as const },
  { roman: "ii", quality: "min" as const },
  { roman: "iii", quality: "min" as const },
  { roman: "IV", quality: "maj" as const },
  { roman: "V", quality: "maj" as const },
  { roman: "vi", quality: "min" as const },
  { roman: "vii°", quality: "dim" as const },
] as const;

/** 도수 기본 구성음 (키 다이아토닉 퀄리티) */
export function defaultTonesForDegree(degree: number): ToneSet {
  const q = DEGREE_META[degree]?.quality ?? "maj";
  if (q === "min") return TONES_MIN;
  if (q === "dim") return TONES_DIM;
  return TONES_MAJ;
}

/** 자주 쓰는 구성음 프리셋 (도수 퀄리티별, 사용 빈도순) */
const PRESETS_MAJ: readonly ToneSet[] = [
  TONES_MAJ,
  ["1", "3", "5", "b7"],
  ["1", "3", "5", "7"],
  ["1", "2", "3", "5"],
  ["1", "3", "5", "6"],
  ["1", "4", "5"],
];

const PRESETS_MIN: readonly ToneSet[] = [
  TONES_MIN,
  ["1", "b3", "5", "b7"],
  ["1", "2", "b3", "5"],
  ["1", "b3", "5", "6"],
];

const PRESETS_DIM: readonly ToneSet[] = [
  TONES_DIM,
  ["1", "b3", "b5", "b7"],
];

export function degreeTonePresets(degree: number): readonly ToneSet[] {
  const q = DEGREE_META[degree]?.quality ?? "maj";
  if (q === "min") return PRESETS_MIN;
  if (q === "dim") return PRESETS_DIM;
  return PRESETS_MAJ;
}

/** 같은 근음 재클릭용 — 다음 자주 쓰는 구성음 */
export function cycleDegreeTones(degree: number, current: ToneSet): ToneSet {
  const presets = degreeTonePresets(degree);
  const idx = presets.findIndex((p) => artsToneEqual(p, current));
  return [...presets[(idx + 1) % presets.length]!] as ChordInterval[];
}

const QUARTER_DOWN: Articulation[] = ["D", "hold", "hold", "hold"];

function defaultBarRhythm(): Articulation[] {
  return Array.from({ length: BEATS }, () => [...QUARTER_DOWN]).flat();
}

function emptyOverrides(): Array<Articulation[] | null> {
  return Array.from({ length: BARS }, () => null);
}

function artsEqual(a: Articulation[], b: Articulation[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function createInitialSheet(): SheetState {
  return {
    bpm: 96,
    key: "C",
    degrees: Array.from({ length: SLOTS }, () => null),
    tones: Array.from({ length: SLOTS }, () => null),
    rhythm: defaultBarRhythm(),
    rhythmOverride: emptyOverrides(),
    gain: 0.55,
    metro: false,
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

export function rootFromDegree(key: string, degree: number): string {
  return scaleOf(key)[degree] ?? "C";
}

function hasTone(tones: ToneSet, id: ChordInterval): boolean {
  return tones.includes(id);
}

function normTones(tones: ToneSet): ChordInterval[] {
  return CHORD_INTERVALS.filter((id) => tones.includes(id));
}

/**
 * 구성음 → 코드 심볼 (오픈셰이프 룩업·표시용).
 * 1·3·5 = G / +2 = add2 / 1·2·5 = sus2 / +6 = 6 / +b7 = 7·9 …
 */
export function chordSymbolFromParts(root: string, tones: ToneSet): string {
  const t = new Set(normTones(tones));
  const has2 = t.has("2") || t.has("b2");
  const has6 = t.has("6");
  const third = t.has("3")
    ? "maj"
    : t.has("b3")
      ? "min"
      : t.has("4")
        ? "sus4"
        : t.has("2") || t.has("b2")
          ? "sus2"
          : "no3";
  const fifth = t.has("5")
    ? "p"
    : t.has("b5")
      ? "dim5"
      : t.has("b6")
        ? "aug"
        : "no5";
  const sev = t.has("7") ? "maj7" : t.has("b7") ? "7" : null;

  if (third === "sus4") {
    if (sev === "7") return `${root}7sus4`;
    return `${root}sus4`;
  }
  if (third === "sus2") {
    if (sev === "7") return `${root}7sus2`;
    return `${root}sus2`;
  }
  if (third === "min" && fifth === "dim5") {
    return sev === "7" ? `${root}ø` : `${root}o`;
  }
  if (third === "min") {
    if (sev === "7") return has2 ? `${root}m9` : `${root}m7`;
    if (sev === "maj7") return has2 ? `${root}mMaj9` : `${root}mMaj7`;
    if (has6) return `${root}m6`;
    return has2 ? `${root}madd2` : `${root}m`;
  }
  if (third === "maj") {
    if (fifth === "aug") return `${root}aug`;
    if (sev === "7") return has2 ? `${root}9` : `${root}7`;
    if (sev === "maj7") return has2 ? `${root}maj9` : `${root}maj7`;
    if (fifth === "dim5") return `${root}b5`;
    if (has6) return `${root}6`;
    return has2 ? `${root}add2` : root;
  }
  // no3
  if (t.has("5") || t.has("b5")) return `${root}5`;
  return root;
}

export function chordFromDegree(key: string, degree: number): string {
  return chordSymbolFromParts(rootFromDegree(key, degree), defaultTonesForDegree(degree));
}

/** 슬롯 → 재생·표시용 코드 심볼 */
export function chordFromSlot(
  key: string,
  degree: number | null,
  tones: ToneSet | null,
): string | null {
  if (degree === null) return null;
  const t = tones && tones.length > 0 ? tones : defaultTonesForDegree(degree);
  return chordSymbolFromParts(rootFromDegree(key, degree), t);
}

export function slotLabel(
  key: string,
  degree: number | null,
  tones?: ToneSet | null,
): string {
  const sym = chordFromSlot(key, degree, tones ?? null);
  if (!sym) return "—";
  // dim 표기 정리
  if (sym.endsWith("o")) return `${sym.slice(0, -1)}dim`;
  if (sym.endsWith("ø")) return `${sym.slice(0, -1)}m7b5`;
  return sym;
}

export function slotRoman(degree: number | null): string {
  if (degree === null) return "";
  return DEGREE_META[degree]?.roman ?? "";
}

/** 근음+간격 → 화면용 음이름 (G, Bb …) — 테스트·디버그용 */
export function intervalNoteLabel(
  key: string,
  degree: number,
  interval: ChordInterval,
): string {
  const root = rootFromDegree(key, degree);
  const pc = ((PC[root] ?? 0) + INTERVAL_ST[interval]) % 12;
  return pitchClassLabel(pc, key);
}

/** 키의 임시표 취향에 맞춘 피치클래스 라벨 */
function pitchClassLabel(pc: number, key: string): string {
  const flatKeys = new Set(["C", "F", "Bb", "Eb", "Ab", "Db", "Gb"]);
  const flats = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const sharps = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return (flatKeys.has(key) ? flats : sharps)[pc]!;
}

export function tonesInclude(tones: ToneSet | null, interval: ChordInterval): boolean {
  return tones != null && hasTone(tones, interval);
}

function axisMembers(axis: ToneAxis): ChordInterval[] {
  return axis.steps.filter((s): s is ChordInterval => s != null);
}

/** 축에서 현재 켜진 단계 (없으면 null = 해제) */
export function activeToneStep(
  tones: ToneSet | null,
  axis: ToneAxis,
): ChordInterval | null {
  if (tones == null) return null;
  for (const step of axis.steps) {
    if (step != null && hasTone(tones, step)) return step;
  }
  return null;
}

/** 화면용 음정 글리프 — b→♭, #→♯ (내부 id는 ASCII 유지) */
export function formatIntervalGlyph(interval: string): string {
  if (interval.startsWith("b")) return `♭${interval.slice(1)}`;
  if (interval.startsWith("#")) return `♯${interval.slice(1)}`;
  return interval;
}

/** 패드 라벨: 켜진 상대도수, 해제면 축 이름(1…7) */
export function toneAxisLabel(
  tones: ToneSet | null,
  axis: ToneAxis,
): string {
  const step = activeToneStep(tones, axis);
  return formatIntervalGlyph(step ?? axis.id);
}

export function toneAxisOn(tones: ToneSet | null, axis: ToneAxis): boolean {
  if (axis.id === "1") return tones != null;
  return activeToneStep(tones, axis) != null;
}

/** 장·단(또는 감·완전) 쌍이 있는 축 — 정/역 회전 대상 */
export function isPolarToneAxis(axis: ToneAxis): boolean {
  return axisMembers(axis).length >= 2;
}

/**
 * 아르카나 극성.
 * min = 단·감 (역방향), maj = 장·완전 (정방향), on = 단극 축, off = 해제
 */
export type TonePolarity = "off" | "min" | "maj" | "on";

export function toneAxisPolarity(
  tones: ToneSet | null,
  axis: ToneAxis,
): TonePolarity {
  const step = activeToneStep(tones, axis);
  if (axis.id === "1") return tones != null ? "on" : "off";
  if (step == null) return "off";
  const members = axisMembers(axis);
  if (members.length < 2) return "on";
  if (step === members[0]) return "min";
  return "maj";
}

/**
 * 카드 양면 라벨.
 * 단·장 쌍 → min/maj 각각. 단도 없으면 위·아래 모두 장(유일)도.
 */
export function toneAxisFaces(axis: ToneAxis): {
  min: string;
  maj: string;
  polar: boolean;
} {
  const members = axisMembers(axis);
  if (members.length >= 2) {
    return {
      min: formatIntervalGlyph(members[0]!),
      maj: formatIntervalGlyph(members[1]!),
      polar: true,
    };
  }
  const only = formatIntervalGlyph(members[0] ?? axis.id);
  return { min: only, maj: only, polar: false };
}

/** 축을 특정 단계로 고정. step=null 이면 그 축 해제. 근음(1)은 유지. */
export function setToneAxisStep(
  tones: ToneSet,
  axis: ToneAxis,
  step: ChordInterval | null,
): ToneSet {
  const set = new Set(normTones(tones));
  for (const m of axisMembers(axis)) set.delete(m);
  if (!set.has("1")) set.add("1");
  if (step != null) set.add(step);
  const next = CHORD_INTERVALS.filter((id) => set.has(id));
  return next.length > 0 ? next : ["1"];
}

/**
 * 단도 → 장도(·완전) → 해제 순회.
 * 근음 축은 그대로.
 */
export function cycleToneAxis(tones: ToneSet, axis: ToneAxis): ToneSet {
  if (axis.steps.length <= 1) return normTones(tones).length ? normTones(tones) : ["1"];
  const cur = activeToneStep(tones, axis);
  let idx = axis.steps.findIndex((s) => s === cur);
  if (idx < 0) idx = axis.steps.length - 1; // treat missing as 해제 위치
  const next = axis.steps[(idx + 1) % axis.steps.length]!;
  return setToneAxisStep(tones, axis, next);
}

/** @deprecated 축 순회 이전 호환 — 배타 토글 */
export function toggleChordTone(
  tones: ToneSet,
  interval: ChordInterval,
): ToneSet {
  const axis = TONE_AXES.find((a) => axisMembers(a).includes(interval));
  if (!axis) return normTones(tones);
  if (axis.id === "1") return normTones(tones).length ? normTones(tones) : ["1"];
  if (hasTone(tones, interval)) return setToneAxisStep(tones, axis, null);
  return setToneAxisStep(tones, axis, interval);
}

/** 도수 칠하기 — ∅만 비움. 같은 근음 재클릭은 자주 쓰는 구성음 순회 */
export function paintDegreeSlot(
  sheet: SheetState,
  slot: number,
  degree: number | null,
): SheetState {
  const degrees = [...sheet.degrees];
  const tones = [...sheet.tones];
  if (degree === null) {
    degrees[slot] = null;
    tones[slot] = null;
  } else if (degrees[slot] === degree) {
    const cur = tones[slot] ?? defaultTonesForDegree(degree);
    tones[slot] = cycleDegreeTones(degree, cur);
  } else {
    degrees[slot] = degree;
    tones[slot] = defaultTonesForDegree(degree);
  }
  return { ...sheet, degrees, tones };
}

/** 상대도수 축 순회 — 선택 슬롯에만 적용 */
export function paintToneSlot(
  sheet: SheetState,
  slot: number,
  axisId: ToneAxisId,
): SheetState {
  const axis = TONE_AXES.find((a) => a.id === axisId);
  if (!axis) return sheet;
  const degree = sheet.degrees[slot] ?? null;
  if (degree === null) return sheet;
  if (axis.id === "1") return sheet;
  const cur = sheet.tones[slot] ?? defaultTonesForDegree(degree);
  const tones = [...sheet.tones];
  tones[slot] = cycleToneAxis(cur, axis);
  return { ...sheet, tones };
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

/** 재생·표시용: bar0=기본, 이후는 override 없으면 상속 */
export function barRhythm(sheet: SheetState, bar: number): Articulation[] {
  if (bar <= 0) return sheet.rhythm;
  return sheet.rhythmOverride[bar] ?? sheet.rhythm;
}

/** bar0은 소스(override 아님). bar≥1은 override 배열이 있으면 true */
export function isRhythmOverridden(sheet: SheetState, bar: number): boolean {
  return bar > 0 && sheet.rhythmOverride[bar] != null;
}

export type RhythmBarKind = "base" | "link" | "own";

export function rhythmBarKind(sheet: SheetState, bar: number): RhythmBarKind {
  if (bar <= 0) return "base";
  return isRhythmOverridden(sheet, bar) ? "own" : "link";
}

/**
 * 한 칸 칠하기.
 * bar0 → 기본 리듬 수정(상속 마디에 전파).
 * bar≥1 → 첫 편집 시 base를 복사해 override로 분기.
 */
export function paintRhythmStep(
  sheet: SheetState,
  bar: number,
  step: number,
  art: Articulation,
): SheetState {
  if (bar <= 0) {
    const rhythm = sheet.rhythm.map((cell, i) => (i === step ? art : cell));
    return { ...sheet, rhythm };
  }
  const src = barRhythm(sheet, bar);
  const next = src.map((cell, i) => (i === step ? art : cell));
  const rhythmOverride = sheet.rhythmOverride.map((row, i) =>
    i === bar ? next : row,
  );
  return { ...sheet, rhythmOverride };
}

/** override 버리고 1마디 리듬으로 되돌림 */
export function clearRhythmOverride(
  sheet: SheetState,
  bar: number,
): SheetState {
  if (bar <= 0 || sheet.rhythmOverride[bar] == null) return sheet;
  const rhythmOverride = sheet.rhythmOverride.map((row, i) =>
    i === bar ? null : row,
  );
  return { ...sheet, rhythmOverride };
}

/**
 * 옛 4×마디 rhythm[][] → base + override.
 * bar0과 같으면 상속(null), 다르면 own.
 */
export function rhythmFromLegacyBars(
  rows: Articulation[][],
): Pick<SheetState, "rhythm" | "rhythmOverride"> {
  const rhythm =
    rows[0] && rows[0].length === BAR_STEPS
      ? [...rows[0]]
      : defaultBarRhythm();
  const rhythmOverride = Array.from({ length: BARS }, (_, bar) => {
    if (bar === 0) return null;
    const row = rows[bar];
    if (!row || row.length !== BAR_STEPS) return null;
    return artsEqual(row, rhythm) ? null : [...row];
  });
  return { rhythm, rhythmOverride };
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
    const barRhythmRow = barRhythm(sheet, bar);
    let step = 0;
    while (step < BAR_STEPS) {
      const art = barRhythmRow[step] ?? "rest";
      const beat = Math.floor(step / SUBDIV);
      const degree = sheet.degrees[bar * BEATS + beat] ?? null;
      const toneSet = sheet.tones[bar * BEATS + beat] ?? null;
      const chord = chordFromSlot(sheet.key, degree, toneSet);

      if (isAttack(art) && chord !== null) {
        const holds = holdRun(barRhythmRow, step);
        const steps = art === "X" ? 1 : 1 + holds;
        const base = sheet.gain;
        const gain =
          art === "X" ? base * 0.22 : art === "U" ? base * 0.72 : base;
        events.push({
          chord,
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
        const a2 = barRhythmRow[step] ?? "rest";
        const b2 = Math.floor(step / SUBDIV);
        const d2 = sheet.degrees[bar * BEATS + b2] ?? null;
        const t2 = sheet.tones[bar * BEATS + b2] ?? null;
        if (isAttack(a2) && chordFromSlot(sheet.key, d2, t2) !== null) break;
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
  return `note("${clicks}").s("triangle").gain(0.32).clip(0.045).cutoff(6000)`;
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
    `.attack(0.004)`,
    `.decay(0.12)`,
    `.sustain(0.32)`,
    `.release(0.05)`,
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
      `.attack(0.003)`,
      `.decay(0.1)`,
      `.sustain(0.28)`,
      `.release(0.045)`,
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
