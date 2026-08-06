/**
 * 차트 = 4행(마디) × 4열(박).
 * 리듬 = 선택 마디의 4×4 (행=4분, 칸=16분).
 * 셀: D / U / X(뮤트) / hold(링) / rest(쉼).
 *
 * toStrudel: SheetState → @strudel/web 평가 코드.
 * 길이는 mini `@n` 가중치로 표현 (clip 남용으로 한 음에 붙는 문제 회피).
 * 주법: D/U = n 순서로 스트럼, X = 뮤트 샘플 + 짧은 clip.
 */

export type Articulation = "D" | "U" | "X" | "hold" | "rest";

export type SheetState = {
  bpm: number;
  key: string;
  /** 16 slots: row-major, each = quarter note. null = chord rest */
  degrees: Array<number | null>;
  /** 4 bars × 16 sixteenths */
  rhythm: Articulation[][];
  /** SOUND 칩 순회 프리셋 */
  sound: SoundId;
  gain: number;
  metro: boolean;
};

/**
 * SOUND 축 — GM 기타 3바디. 이름 = 들릴 소리.
 * n()+chord()+voicing() 스트럼과 맞음 (음높이별 샘플).
 *
 * dirt-samples `gtr` 다중 WAV는 n이 샘플 인덱스로 겹쳐
 * 스트럼(0..3)이 깨지거나 묵음 → 쓰지 않음.
 * (공식 예제도 gtr는 단일 WAV + note() 피치시프트)
 */
export type SoundId = "steel" | "clean" | "nylon";

export type SoundKind = "font";

export type SoundPreset = {
  id: SoundId;
  label: string;
  kind: SoundKind;
  /** .s() 이름 */
  sound: string;
  /** 프리로드용 soundfont 키 */
  font: string;
};

export const SOUND_PRESETS: readonly SoundPreset[] = [
  {
    id: "steel",
    label: "steel",
    kind: "font",
    sound: "gm_acoustic_guitar_steel",
    font: "0250_Aspirin_sf2_file",
  },
  {
    id: "clean",
    label: "clean",
    kind: "font",
    sound: "gm_electric_guitar_clean",
    font: "0270_Aspirin_sf2_file",
  },
  {
    id: "nylon",
    label: "nylon",
    kind: "font",
    sound: "gm_acoustic_guitar_nylon",
    font: "0240_Aspirin_sf2_file",
  },
] as const;

/** 뮤트(X) — palm mute 샘플 (짧은 clip과 짝) */
export const MUTE_SOUND = "gm_electric_guitar_muted";
export const MUTE_FONT = "0280_Aspirin_sf2_file";

/** @deprecated */
export type GuitarBodyId = SoundId;
export type VoiceId = SoundId;
export const GUITAR_BODIES = SOUND_PRESETS;


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
    sound: "steel",
    gain: 0.55,
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

export function nextSound(current: SoundId): SoundId {
  const i = SOUND_PRESETS.findIndex((b) => b.id === current);
  const next = SOUND_PRESETS[((i < 0 ? 0 : i) + 1) % SOUND_PRESETS.length]!;
  return next.id;
}

/** @deprecated nextSound */
export function nextBody(current: SoundId): SoundId {
  return nextSound(current);
}

export function soundById(id: string): SoundPreset {
  const found = SOUND_PRESETS.find((v) => v.id === id);
  if (found) return found;
  // 구 id 호환
  if (id === "gtr" || id === "crunch" || id === "drive" || id === "dist") {
    return SOUND_PRESETS[1]!; // clean electric
  }
  if (id === "buzz" || id === "saw" || id === "square" || id === "tri") {
    return SOUND_PRESETS[0]!; // steel — 신스 슬롯 폐기, 기본 어쿠스틱
  }
  return SOUND_PRESETS[0]!;
}

/** SOUND 칩 탭 시 한 번 튕겨 들을 미리듣기 코드 */
export function previewSoundCode(id: SoundId): string {
  const preset = soundById(id);
  const body = [
    `n("[0 1 2 3]")`,
    `.chord("C")`,
    `.dict("triads")`,
    `.mode("above:c3")`,
    `.voicing()`,
    `.s("${preset.sound}")`,
    `.gain(0.5)`,
    `.clip(0.85)`,
  ].join("");
  return `setcps(1)\n${body}`;
}

/** @deprecated soundById */
export function bodyById(id: SoundId) {
  return soundById(id);
}

/** @deprecated soundById */
export function voiceById(id: SoundId) {
  return soundById(id);
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

export type AttackArt = "D" | "U" | "X";

export type TimedEvent = {
  /** null = rest */
  chord: string | null;
  /** 16분음표 개수 (mini @n) */
  steps: number;
  gain: number;
  /** 공격 주법. rest면 null */
  art: AttackArt | null;
};

export type StrudelParts = {
  cps: number;
  hasHits: boolean;
  events: TimedEvent[];
  totalSteps: number;
  metro: boolean;
  preset: SoundPreset;
};

/** 리듬 그리드를 길이 가중 이벤트로 펼친다 */
export function compileSheet(sheet: SheetState): StrudelParts {
  const preset = soundById(sheet.sound);
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
        const gain =
          art === "X" ? base * 0.55 : art === "U" ? base * 0.82 : base;
        events.push({
          chord: chordFromDegree(sheet.key, degree),
          steps,
          gain: Number(gain.toFixed(3)),
          art: art as AttackArt,
        });
        // X도 그리드상 hold가 있으면 나머진 쉼으로 소비
        if (art === "X" && holds > 0) {
          events.push({ chord: null, steps: holds, gain: 0, art: null });
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
      events.push({ chord: null, steps: span, gain: 0, art: null });
    }
  }

  const totalSteps = events.reduce((n, e) => n + e.steps, 0);

  return {
    cps: cyclesPerSecond(sheet.bpm),
    hasHits: events.some((e) => e.chord !== null),
    events,
    totalSteps,
    metro: sheet.metro,
    preset,
  };
}

/**
 * 스트럼 n 패턴.
 * D: 저→고, U: 고→저 — 첫 16분 안에 몰아 치고 나머지는 링(~).
 * X: 동시 타현 (뮤트 샘플과 짝).
 */
export function strumN(art: AttackArt, steps: number): string {
  if (art === "X") {
    return steps === 1 ? "[0,1,2]" : `[0,1,2]@${steps}`;
  }
  const order = art === "D" ? "[0 1 2 3]" : "[3 2 1 0]";
  if (steps <= 1) return order;
  return `[${order}@1 ~@${steps - 1}]@${steps}`;
}

function timedChord(events: TimedEvent[]): string {
  return events
    .map((e) => {
      const tok = e.chord ?? "~";
      return e.steps === 1 ? tok : `${tok}@${e.steps}`;
    })
    .join(" ");
}

function timedN(events: TimedEvent[]): string {
  return events
    .map((e) => {
      if (!e.chord || !e.art) {
        return e.steps === 1 ? "~" : `~@${e.steps}`;
      }
      return strumN(e.art, e.steps);
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

function timedSound(events: TimedEvent[], preset: SoundPreset): string {
  return events
    .map((e) => {
      if (!e.chord) return e.steps === 1 ? "~" : `~@${e.steps}`;
      const s = e.art === "X" ? MUTE_SOUND : preset.sound;
      return e.steps === 1 ? s : `${s}@${e.steps}`;
    })
    .join(" ");
}

/** 오픈은 길게 울리고, 뮤트는 짧게 끊는다 */
function timedClip(events: TimedEvent[]): string {
  return events
    .map((e) => {
      if (!e.chord) return e.steps === 1 ? "0" : `0@${e.steps}`;
      const c = e.art === "X" ? 0.12 : 0.95;
      return e.steps === 1 ? String(c) : `${c}@${e.steps}`;
    })
    .join(" ");
}

/**
 * SheetState → Strudel 코드.
 * n + chord + voicing + GM guitar — 스트럼 n과 샘플 인덱스가 안 겹침.
 */
export function toStrudel(sheet: SheetState): string {
  const parts = compileSheet(sheet);
  const layers: string[] = [];
  const preset = parts.preset;

  if (parts.hasHits) {
    layers.push(
      [
        `n("${timedN(parts.events)}")`,
        `.chord("${timedChord(parts.events)}")`,
        `.dict("triads")`,
        `.mode("above:c3")`,
        `.voicing()`,
        `.s("${timedSound(parts.events, preset)}")`,
        `.gain("${timedGain(parts.events)}")`,
        `.clip("${timedClip(parts.events)}")`,
      ].join(""),
    );
  }

  if (parts.metro) {
    // square 메트로는 8bit처럼 들림 → 짧고 조용한 triangle 클릭
    const clicks = Array.from({ length: SLOTS }, (_, i) =>
      i % BEATS === 0 ? "c6" : "a5",
    ).join(" ");
    layers.push(
      `note("${clicks}").s("triangle").gain(0.12).clip(0.03).cutoff(6000)`,
    );
  }

  if (layers.length === 0) return "silence";

  const body =
    layers.length === 1 ? layers[0]! : `stack(\n  ${layers.join(",\n  ")}\n)`;

  return `setcps(${parts.cps})\n${body}`;
}
