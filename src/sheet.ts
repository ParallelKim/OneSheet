/**
 * 차트 = 4행(마디) × 4열(박).
 * 리듬 = 선택 마디의 4×4 (행=4분, 칸=16분).
 * 셀: D / U / X(뮤트) / hold(링) / rest(쉼).
 *
 * soundMode: block(차트) + docs/recipes 원문 예제.
 * 예제는 해석·번역 없이 그대로 evaluate — 청취 기준선용.
 */

export type Articulation = "D" | "U" | "X" | "hold" | "rest";
export type AttackArt = "D" | "U" | "X";

export type SoundModeKind = "chart" | "example";

export type SoundMode = {
  id: string;
  /** LCD에 짧게 */
  label: string;
  /** 무엇이 다른지 (피드백용) */
  blurb: string;
  kind: SoundModeKind;
  /** 출처 URL (예제만) */
  source?: string;
  /** 예제 원문 코드 (예제만). 차트/BPM/메트로 무시 */
  code?: string;
};

/**
 * MODE 슬롯.
 * block만 차트→toStrudel. 나머지는 strudel.cc 원문 복제.
 */
export const SOUND_MODES: readonly SoundMode[] = [
  {
    id: "block",
    label: "block",
    kind: "chart",
    blurb: "차트 기본 — 동시 보이싱+saw",
  },
  {
    id: "ex-note",
    label: "note",
    kind: "example",
    source: "https://strudel.cc/recipes/recipes/",
    blurb: "recipes · note 아르페지오",
    code: `note("c eb g c4")
.clip(2).s("gm_electric_guitar_clean")`,
  },
  {
    id: "ex-scale",
    label: "scale",
    kind: "example",
    source: "https://strudel.cc/recipes/recipes/",
    blurb: "recipes · scale 아르페지오",
    code: `n("0 2 4 7").scale("C:minor")
.clip(2).s("gm_electric_guitar_clean")`,
  },
  {
    id: "ex-arp",
    label: "arp",
    kind: "example",
    source: "https://strudel.cc/recipes/recipes/",
    blurb: "recipes · chord+voicing 아르페지오",
    code: `n("0 1 2 3").chord("Cm").mode("above:c3").voicing()
.clip(2).s("gm_electric_guitar_clean")`,
  },
  {
    id: "ex-n4",
    label: "n4",
    kind: "example",
    source: "https://strudel.cc/learn/tonal/",
    blurb: "tonal · n+chord 진행",
    code: `n("0 1 2 3").chord("<C Am F G>").voicing()`,
  },
  {
    id: "ex-clip",
    label: "clip",
    kind: "example",
    source: "https://strudel.cc/understand/voicings/",
    blurb: "voicings · n 선택+clip 길이",
    code: `n("0 3 1 2").chord("<C <Fm Db>>").voicing()
.clip("4 3 2 1").room(.5)`,
  },
  {
    id: "ex-gtr",
    label: "gtr",
    kind: "example",
    source: "https://strudel.cc/learn/samples/",
    blurb: "samples · dirt gtr(+moog) 피치",
    code: `samples({
'gtr': 'gtr/0001_cleanC.wav',
'moog': { 'g3': 'moog/005_Mighty%20Moog%20G3.wav' },
}, 'github:tidalcycles/dirt-samples');
note("g3 [bb3 c4] <g4 f4 eb4 f3>@2").s("gtr,moog").clip(1)
.gain(.5)`,
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
  /** 사운드 모드 (기본 block) */
  soundMode: SoundModeId;
};

const TONE_SAW = { sound: "sawtooth", cutoff: 1400 } as const;

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

/** block: 차트 → 동시 보이싱 (제품 기본) */
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

function chartToStrudel(sheet: SheetState): string {
  const parts = compileSheet(sheet);
  const layers: string[] = [];
  if (parts.hasHits) layers.push(layerBlock(parts));
  if (parts.metro) layers.push(metroLayer());
  const body = stackBody(layers);
  if (body === "silence") return "silence";
  return `setcps(${parts.cps})\n${body}`;
}

/**
 * Play/재평가용 코드.
 * example MODE는 docs 원문만 — 차트·BPM·메트로 개입 없음.
 */
export function toStrudel(sheet: SheetState): string {
  const mode = soundModeById(sheet.soundMode);
  if (mode.kind === "example" && mode.code) {
    return mode.code;
  }
  return chartToStrudel(sheet);
}
