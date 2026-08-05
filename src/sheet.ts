/**
 * 차트 = 4행(마디) × 4열(박).
 * 리듬 = 선택 마디의 4×4 (행=4분, 칸=16분).
 * 셀: D / U / X(뮤트) / hold(링) / rest(쉼).
 *
 * toStrudel: SheetState → @strudel/web 평가 코드.
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
  { id: "warm", label: "웜", sound: "sawtooth", cutoff: 1400 },
  { id: "bright", label: "샤프", sound: "square", cutoff: 3200 },
  { id: "soft", label: "소프트", sound: "triangle", cutoff: 1800 },
  { id: "keys", label: "피아노", sound: "triangle", cutoff: 2400 },
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
  { id: "D", label: "D", hint: "다운" },
  { id: "U", label: "U", hint: "업" },
  { id: "X", label: "X", hint: "뮤트" },
  { id: "hold", label: "·", hint: "링" },
  { id: "rest", label: "∅", hint: "쉼" },
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
 * dim은 딕셔너리 키 `o` (예: Bo). `dim` 표기는 voicing이 모를 수 있음.
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

/** 손악보용 스트럼 기호 (대략) */
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

function mini(tokens: Array<string | number>): string {
  return tokens.map(String).join(" ");
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

export type StrudelParts = {
  cps: number;
  hasHits: boolean;
  chordSeq: string[];
  clipSeq: number[];
  gainSeq: number[];
  metro: boolean;
  sound: string;
  cutoff: number;
};

/** UI 상태 → 재생에 쓰는 중간 표현 (테스트·디버그용) */
export function compileSheet(sheet: SheetState): StrudelParts {
  const voice = voiceById(sheet.voice);
  const chordSeq: string[] = [];
  const clipSeq: number[] = [];
  const gainSeq: number[] = [];

  for (let bar = 0; bar < BARS; bar++) {
    const barRhythm = sheet.rhythm[bar] ?? defaultBarRhythm();
    for (let step = 0; step < BAR_STEPS; step++) {
      const art = barRhythm[step] ?? "rest";
      const beat = Math.floor(step / SUBDIV);
      const degree = sheet.degrees[bar * BEATS + beat] ?? null;

      if (!isAttack(art) || degree === null) {
        chordSeq.push("~");
        clipSeq.push(1);
        gainSeq.push(0);
        continue;
      }

      const holds = holdRun(barRhythm, step);
      const clip = art === "X" ? 0.45 : 1 + holds;
      const base = sheet.gain;
      const gain = art === "X" ? base * 0.22 : art === "U" ? base * 0.72 : base;

      chordSeq.push(chordFromDegree(sheet.key, degree));
      clipSeq.push(Number(clip.toFixed(2)));
      gainSeq.push(Number(gain.toFixed(3)));
    }
  }

  return {
    cps: cyclesPerSecond(sheet.bpm),
    hasHits: chordSeq.some((t) => t !== "~"),
    chordSeq,
    clipSeq,
    gainSeq,
    metro: sheet.metro,
    sound: voice.sound,
    cutoff: voice.cutoff,
  };
}

/**
 * SheetState → Strudel 코드 문자열.
 * evaluate(code)로 바로 재생 가능.
 */
export function toStrudel(sheet: SheetState): string {
  const parts = compileSheet(sheet);
  const layers: string[] = [];

  if (parts.hasHits) {
    layers.push(
      [
        `chord("<${mini(parts.chordSeq)}>")`,
        `.dict("triads")`,
        `.voicing()`,
        `.s("${parts.sound}")`,
        `.gain("<${mini(parts.gainSeq)}>")`,
        `.cutoff(${parts.cutoff})`,
        `.clip("<${mini(parts.clipSeq)}>")`,
      ].join(""),
    );
  }

  if (parts.metro) {
    // 16분 64스텝 사이클 안에서 4분마다 클릭
    layers.push(`s("woodblock").struct("x*${SLOTS}").gain(0.08)`);
  }

  if (layers.length === 0) return "silence";

  const body =
    layers.length === 1 ? layers[0]! : `stack(\n  ${layers.join(",\n  ")}\n)`;

  return `setcps(${parts.cps})\n${body}`;
}
