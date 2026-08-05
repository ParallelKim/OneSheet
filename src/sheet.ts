/**
 * Sheet model = Strudel 편집 상태.
 * UI는 이 상태를 만지는 렌즈일 뿐, PO 기능 복제가 아니다.
 *
 * TE에서 빌린 것: 소수 렌즈, 색=매핑, 즉시 반응, 제약된 표면.
 * 빌리지 않은 것: PO의 패드/실크/PCB 외형과 기능 복제.
 */

export type LayerKind = "harmony" | "beat";

export type Lens = "steps" | "sound" | "fx";

export type Layer = {
  id: string;
  label: string;
  kind: LayerKind;
  /** cycle steps — harmony: 4, beat: 16 */
  steps: string[];
  /** .s() / default paint token */
  sound: string;
  gain: number;
  /** harmony → cutoff, beat → room */
  spice: number;
  muted: boolean;
};

export type SheetState = {
  bpm: number;
  layers: Layer[];
};

export function createId(): string {
  return crypto.randomUUID();
}

export const HARMONY_SOUNDS = ["sawtooth", "square", "triangle", "gm_epiano1"] as const;
export const BEAT_SOUNDS = ["bd", "sd", "hh", "cp", "rim", "oh"] as const;
export const HARMONY_CHORDS = ["Am", "C", "G", "F", "Em", "Dm", "E7", "Am7", "-"] as const;

export function isHarmonyLayer(layer: Layer): boolean {
  return layer.kind === "harmony";
}

export function isBeatLayer(layer: Layer): boolean {
  return layer.kind === "beat";
}

export function stepCount(kind: LayerKind): number {
  return kind === "harmony" ? 4 : 16;
}

export function createEmptyLayer(kind: LayerKind): Layer {
  const n = stepCount(kind);
  if (kind === "harmony") {
    return {
      id: createId(),
      label: "Harmony",
      kind,
      steps: Array.from({ length: n }, () => "-"),
      sound: "sawtooth",
      gain: 0.32,
      spice: 0.45,
      muted: false,
    };
  }
  return {
    id: createId(),
    label: "Beat",
    kind,
    steps: Array.from({ length: n }, () => "~"),
    sound: "bd",
    gain: 0.55,
    spice: 0.15,
    muted: false,
  };
}

export function createInitialSheet(): SheetState {
  const harmony = createEmptyLayer("harmony");
  harmony.steps = ["Am", "C", "G", "F"];
  const beat = createEmptyLayer("beat");
  beat.steps = [
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
  ];
  return {
    bpm: 96,
    layers: [harmony, beat],
  };
}

function stepsToMini(steps: string[]): string {
  return steps
    .map((s) => {
      const t = s.trim();
      if (t === "" || t === "-") return "~";
      return t;
    })
    .join(" ");
}

function compileLayer(layer: Layer): string | null {
  if (layer.muted) return null;
  const mini = stepsToMini(layer.steps);
  if (mini.split(/\s+/).every((t) => t === "~")) return null;

  if (layer.kind === "harmony") {
    const cutoff = Math.round(300 + layer.spice * 4700);
    return [
      `chord("<${mini}>")`,
      `.voicing('legacy')`,
      `.s("${layer.sound}")`,
      `.gain(${layer.gain.toFixed(2)})`,
      `.cutoff(${cutoff})`,
      `.clip(0.85)`,
    ].join("");
  }

  const room = Number(layer.spice.toFixed(2));
  return [
    `s("<${mini}>")`,
    `.bank("RolandTR909")`,
    `.gain(${layer.gain.toFixed(2)})`,
    `.room(${room})`,
  ].join("");
}

/** Compile sheet → Strudel (stack of layers). */
export function toStrudel(sheet: SheetState): string {
  const parts = sheet.layers.map(compileLayer).filter((x): x is string => Boolean(x));

  if (parts.length === 0) return "silence";

  const cps = sheet.bpm / 60 / 4;
  if (parts.length === 1) {
    return [`setcps(${cps})`, parts[0]!].join("\n");
  }
  return [`setcps(${cps})`, `stack(\n  ${parts.join(",\n  ")}\n)`].join("\n");
}

export function layerMini(layer: Layer): string {
  return stepsToMini(layer.steps);
}
