/**
 * 차트 = 4행(마디) × 4열(박).
 * 리듬 = 선택 마디의 4×4 (행=4분, 칸=16분).
 * 셀: D / U / X(뮤트) / hold(링) / rest(쉼).
 *
 * toStrudel: SheetState → @strudel/web 평가 코드.
 * 길이는 mini `@n` 가중치로 표현 (clip 남용으로 한 음에 붙는 문제 회피).
 */

export type Articulation = "D" | "U" | "X" | "hold" | "rest";

export type SheetState = {
  bpm: number;
  key: string;
  /** 16 slots: row-major, each = quarter note. null = chord rest */
  degrees: Array<number | null>;
  /** 4 bars × 16 sixteenths */
  rhythm: Articulation[][];
  voice: VoiceId;
  gain: number;
  metro: boolean;
};

export type VoiceId = "warm" | "bright" | "soft" | "keys";

/** WebAudio 신스만 사용 (soundfont 미포함 번들) */
export const VOICES: readonly {
  id: VoiceId;
  label: string;
  sound: string;
  cutoff: number;
}[] = [
  { id: "warm", label: "warm", sound: "sawtooth", cutoff: 1400 },
  { id: "bright", label: "bright", sound: "square", cutoff: 3200 },
  { id: "soft", label: "soft", sound: "triangle", cutoff: 1800 },
  { id: "keys", label: "keys", sound: "triangle", cutoff: 2400 },
] as const;

export const BARS = 4;
export const BEATS = 4;
export const SLOTS = BARS * BEATS; // 16 quarters
export const SUBDIV = 4; // sixteenths per quarter
export const BAR_STEPS = BEATS * SUBDIV; // 16 sixteenths per bar
export const TOTAL_STEPS = BARS * BAR_STEPS; // 64

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

/** 한 박: 다운 후 링 ×3 → 4분 스트로크 */
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
    degrees: repeatBar([5, 0, 4, 3]), // vi I V IV
    rhythm: defaultRhythm(),
    voice: "warm",
    gain: 0.35,
    metro: true,
  };
}

export function scaleOf(key: string): readonly string[] {
  return MAJOR_KEYS[key] ?? MAJOR_KEYS.C!;
}

/**
 * Strudel chord() 심볼.
 * dim은 딕셔너리 키 `o` (예: Bo).
 */
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

export function voiceById(id: VoiceId) {
  return VOICES.find((v) => v.id === id) ?? VOICES[0]!;
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

/** 공격 뒤 이어지는 hold 개수 (rest·다음 공격 전) */
export function holdRun(barRhythm: Articulation[], from: number): number {
  let n = 0;
  for (let i = from + 1; i < barRhythm.length; i++) {
    if (barRhythm[i] !== "hold") break;
    n++;
  }
  return n;
}

/** 한 사이클 = 4마디 = 16박. cps = bpm/60/16 */
export function cyclesPerSecond(bpm: number): number {
  return bpm / 60 / SLOTS;
}

export type TimedEvent = {
  /** null = rest */
  chord: string | null;
  /** 16분음표 개수 (mini @n) */
  steps: number;
  gain: number;
};

export type StrudelParts = {
  cps: number;
  hasHits: boolean;
  events: TimedEvent[];
  totalSteps: number;
  metro: boolean;
  sound: string;
  cutoff: number;
};

/** 리듬 그리드를 길이 가중 이벤트로 펼친다 */
export function compileSheet(sheet: SheetState): StrudelParts {
  const voice = voiceById(sheet.voice);
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
        // 뮤트는 짧게, 나머지는 hold까지 이어서 한 음
        const steps = art === "X" ? 1 : 1 + holds;
        const base = sheet.gain;
        const gain = art === "X" ? base * 0.22 : art === "U" ? base * 0.72 : base;
        events.push({
          chord: chordFromDegree(sheet.key, degree),
          steps,
          gain: Number(gain.toFixed(3)),
        });
        // X도 그리드상 hold가 있으면 나머진 쉼으로 소비
        if (art === "X" && holds > 0) {
          events.push({ chord: null, steps: holds, gain: 0 });
        }
        step += 1 + holds;
        continue;
      }

      // rest / orphan hold / 도수 없는 공격 → 쉼 구간 병합
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
      events.push({ chord: null, steps: span, gain: 0 });
    }
  }

  const totalSteps = events.reduce((n, e) => n + e.steps, 0);

  return {
    cps: cyclesPerSecond(sheet.bpm),
    hasHits: events.some((e) => e.chord !== null),
    events,
    totalSteps,
    metro: sheet.metro,
    sound: voice.sound,
    cutoff: voice.cutoff,
  };
}

function timedMini(events: TimedEvent[], field: "chord" | "gain"): string {
  return events
    .map((e) => {
      if (field === "chord") {
        const tok = e.chord ?? "~";
        return e.steps === 1 ? tok : `${tok}@${e.steps}`;
      }
      const g = e.chord ? e.gain : 0;
      return e.steps === 1 ? String(g) : `${g}@${e.steps}`;
    })
    .join(" ");
}

/**
 * SheetState → Strudel 코드.
 * `Am@4 C@4 …` 가중 시퀀스 = 한 사이클(4마디) 안에서 박이 진행된다.
 */
export function toStrudel(sheet: SheetState): string {
  const parts = compileSheet(sheet);
  const layers: string[] = [];

  if (parts.hasHits) {
    layers.push(
      [
        `chord("${timedMini(parts.events, "chord")}")`,
        `.dict("triads")`,
        `.voicing()`,
        `.s("${parts.sound}")`,
        `.gain("${timedMini(parts.events, "gain")}")`,
        `.cutoff(${parts.cutoff})`,
        `.clip(0.95)`,
      ].join(""),
    );
  }

  if (parts.metro) {
    layers.push(
      `note("g5").s("triangle").struct("x*${SLOTS}").gain(0.07).clip(0.08)`,
    );
  }

  if (layers.length === 0) return "silence";

  const body =
    layers.length === 1 ? layers[0]! : `stack(\n  ${layers.join(",\n  ")}\n)`;

  return `setcps(${parts.cps})\n${body}`;
}
