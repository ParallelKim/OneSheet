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
  blurb: string;
  kind: SoundModeKind;
  source?: string;
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
    blurb: "한꺼번에 · saw · 차트 리듬",
  },
  {
    id: "strum",
    label: "strum",
    kind: "chart",
    blurb: "6현 짧은 쓸기→링 · D↓U↑ · GM · 차트",
  },
  {
    id: "arp",
    label: "arp",
    kind: "chart",
    blurb: "한 음씩 펼침(아르페지오) · saw · 차트",
  },
  {
    id: "gm",
    label: "gm",
    kind: "chart",
    blurb: "한 음씩 펼침 · GM · 차트",
  },
  {
    id: "docs",
    label: "docs",
    kind: "example",
    source: "https://strudel.cc/recipes/recipes/",
    blurb: "recipes 원문 · 차트 무시 (기준선)",
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

/** 기타 6현. n = 현 인덱스(저→고), 스케일 도수 아님 */
export const GTR_STRINGS = 6;
/**
 * 오픈형 6음 보이싱 (근음 기준 반음).
 * R–3–5를 옥타브에 펼친 형태 — 연속 도수 클러스터가 아님.
 */
export const GTR6_DICT: Record<string, string[]> = {
  "": ["0 4 7 12 16 19"],
  M: ["0 4 7 12 16 19"],
  m: ["0 3 7 12 15 19"],
  o: ["0 3 6 12 15 18"],
};
export const GTR6_NAME = "gtr6";
export const GTR6_ANCHOR = "e2";

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

/**
 * 6현 스트로크: 첫 스텝에 전현을 짧게 쓸고, 나머지는 재공격 없음.
 * `~` = 새 공격 없음. 링은 clip이 담당 (침묵으로 링을 흉내 내지 않음).
 * n = 현 인덱스 0..5 (저→고), 도수 아님.
 */
function timedStrumN(events: TimedEvent[]): string {
  return events
    .map((e) => {
      if (!e.chord || !e.art) {
        return e.steps === 1 ? "~" : `~@${e.steps}`;
      }
      if (e.art === "X") {
        // 뮤트: 중현 동시·짧게
        return e.steps === 1 ? "[1,2,3]" : `[[1,2,3] ~@${e.steps - 1}]@${e.steps}`;
      }
      const seq = e.art === "D" ? "0 1 2 3 4 5" : "5 4 3 2 1 0";
      if (e.steps <= 1) return `[${seq}]`;
      return `[[${seq}] ~@${e.steps - 1}]@${e.steps}`;
    })
    .join(" ");
}

/**
 * 스트로크 서브이벤트(첫 스텝/6) × clip ≥ hold 길이.
 * X는 짧게.
 */
function timedStrumClip(events: TimedEvent[]): string {
  return events
    .map((e) => {
      if (!e.chord || !e.art) {
        return e.steps === 1 ? "0" : `0@${e.steps}`;
      }
      const clip =
        e.art === "X" ? 0.22 : Math.max(GTR_STRINGS, e.steps * GTR_STRINGS);
      return e.steps === 1 ? String(clip) : `${clip}@${e.steps}`;
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
 * 6현 스트로크 — 짧은 쓸기 후 전현 링.
 * dict gtr6: n=현. GM 바디.
 */
function layerStrum(parts: StrudelParts): string {
  return [
    `n("${timedStrumN(parts.events)}")`,
    `.chord("${timedChord(parts.events)}")`,
    `.dict("${GTR6_NAME}")`,
    `.mode("above:${GTR6_ANCHOR}")`,
    `.voicing()`,
    `.s("${TONE_GM}")`,
    `.gain("${timedGain(parts.events)}")`,
    `.clip("${timedStrumClip(parts.events)}")`,
  ].join("");
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
