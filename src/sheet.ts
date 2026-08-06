/**
 * 차트 = 4행(마디) × 4열(박).
 * 리듬 = 선택 마디의 4×4 (행=4분, 칸=16분).
 * 셀: D / U / X(뮤트) / hold(링) / rest(쉼).
 *
 * soundMode: 기본(block) + 실험 모드. 유저 청취 피드백용.
 */

export type Articulation = "D" | "U" | "X" | "hold" | "rest";
export type AttackArt = "D" | "U" | "X";

/**
 * 사운드 실험 모드.
 * block = 현재 기본 (동시 보이싱). 나머지는 조사 기반 A/B.
 */
export type SoundModeId =
  | "block"
  | "strum-saw"
  | "strum-gm"
  | "arp-saw"
  | "dirt";

export type SoundMode = {
  id: SoundModeId;
  /** LCD에 짧게 */
  label: string;
  /** 무엇이 다른지 (피드백용) */
  blurb: string;
};

export const SOUND_MODES: readonly SoundMode[] = [
  {
    id: "block",
    label: "block",
    blurb: "동시 보이싱+saw — 기본. 피아노감?",
  },
  {
    id: "strum-saw",
    label: "strum",
    blurb: "D/U 짧은 쓸기+saw+clip2 — recipes식",
  },
  {
    id: "strum-gm",
    label: "gm",
    blurb: "쓸기+GM clean:5+above:c3 — 공식 기타 예제",
  },
  {
    id: "arp-saw",
    label: "arp",
    blurb: "D/U를 hold 전체에 펼침 — 아르페지오",
  },
  {
    id: "dirt",
    label: "dirt",
    blurb: "단일 gtr WAV+쓸기 — docs 샘플",
  },
] as const;

export type SheetState = {
  bpm: number;
  key: string;
  degrees: Array<number | null>;
  rhythm: Articulation[][];
  gain: number;
  metro: boolean;
  /** 사운드 실험 모드 (기본 block) */
  soundMode: SoundModeId;
};

const TONE_SAW = { sound: "sawtooth", cutoff: 1400 } as const;
/** GM clean Strat 뱅크 — voicing 후 n이 지워져도 :5로 고정 */
const TONE_GM = "gm_electric_guitar_clean:5";
const TONE_DIRT = "gtr";

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
  soundMode: SoundModeId;
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
    soundMode: sheet.soundMode,
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

/** 쓸기: 앞 1스텝에 몰고 나머지는 링 자리(음 연장은 clip이 담당) */
function strumN(art: AttackArt, steps: number, style: "rolled" | "spread"): string {
  if (art === "X") {
    return steps === 1 ? "[0,1,2]" : `[0,1,2]@${steps}`;
  }
  const order = art === "D" ? "[0 1 2 3]" : "[3 2 1 0]";
  if (steps <= 1) return order;
  if (style === "spread") {
    // hold 전체에 균등 배치 (아르페지오)
    return `${order}@${steps}`;
  }
  // rolled: 첫 1/steps 구간에 몰기
  if (steps === 1) return order;
  return `[${order}@1 ~@${steps - 1}]@${steps}`;
}

function timedN(
  events: TimedEvent[],
  style: "rolled" | "spread",
): string {
  return events
    .map((e) => {
      if (!e.chord || !e.art) {
        return e.steps === 1 ? "~" : `~@${e.steps}`;
      }
      return strumN(e.art, e.steps, style);
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

/** block: 동시 보이싱 (현재 기본) */
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

/** 쓸기 + 신스 — clip(2)로 링 시도 */
function layerStrumSaw(parts: StrudelParts): string {
  return [
    `n("${timedN(parts.events, "rolled")}")`,
    `.chord("${timedChord(parts.events)}")`,
    `.dict("triads")`,
    `.mode("above:c3")`,
    `.voicing()`,
    `.s("${TONE_SAW.sound}")`,
    `.gain("${timedGain(parts.events)}")`,
    `.cutoff(${TONE_SAW.cutoff})`,
    `.clip(2)`,
  ].join("");
}

/** 쓸기 + GM clean:5 (공식 recipes) */
function layerStrumGm(parts: StrudelParts): string {
  return [
    `n("${timedN(parts.events, "rolled")}")`,
    `.chord("${timedChord(parts.events)}")`,
    `.dict("triads")`,
    `.mode("above:c3")`,
    `.voicing()`,
    `.s("${TONE_GM}")`,
    `.gain("${timedGain(parts.events)}")`,
    `.clip(2)`,
  ].join("");
}

/** 아르페지오 — hold 전체에 펼침 */
function layerArpSaw(parts: StrudelParts): string {
  return [
    `n("${timedN(parts.events, "spread")}")`,
    `.chord("${timedChord(parts.events)}")`,
    `.dict("triads")`,
    `.mode("above:c3")`,
    `.voicing()`,
    `.s("${TONE_SAW.sound}")`,
    `.gain("${timedGain(parts.events)}")`,
    `.cutoff(${TONE_SAW.cutoff})`,
    `.clip(1.2)`,
  ].join("");
}

/** dirt 단일 gtr — n은 보이싱용, 샘플은 파일 1개라 인덱스 충돌 없음 */
function layerDirt(parts: StrudelParts): string {
  return [
    `n("${timedN(parts.events, "rolled")}")`,
    `.chord("${timedChord(parts.events)}")`,
    `.dict("triads")`,
    `.mode("above:c3")`,
    `.voicing()`,
    `.s("${TONE_DIRT}")`,
    `.gain("${timedGain(parts.events)}")`,
    `.clip(1)`,
  ].join("");
}

export function toStrudel(sheet: SheetState): string {
  const parts = compileSheet(sheet);
  const layers: string[] = [];

  if (parts.hasHits) {
    switch (parts.soundMode) {
      case "strum-saw":
        layers.push(layerStrumSaw(parts));
        break;
      case "strum-gm":
        layers.push(layerStrumGm(parts));
        break;
      case "arp-saw":
        layers.push(layerArpSaw(parts));
        break;
      case "dirt":
        layers.push(layerDirt(parts));
        break;
      case "block":
      default:
        layers.push(layerBlock(parts));
        break;
    }
  }

  if (parts.metro) layers.push(metroLayer());

  const body = stackBody(layers);
  if (body === "silence") return "silence";
  return `setcps(${parts.cps})\n${body}`;
}
