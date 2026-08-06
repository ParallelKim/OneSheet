import {
  evaluate,
  getAudioContext,
  hush,
  initAudio,
  initStrudel,
  samples,
} from "@strudel/web";
import { previewSoundCode, type SoundId } from "./sheet";

/** initStrudel 반환 타입이 느슨해서 scheduler만 느슨히 잡는다 */
// deno-lint-ignore no-explicit-any
type Repl = any;

let boot: Promise<Repl> | null = null;
let replRef: Repl | null = null;
/** evaluate 직렬화 — 재생 중 연속 편집 시 레이스 방지 */
let queue: Promise<void> = Promise.resolve();
let lastCode = "";
/**
 * 재생 세대. hush 때마다 증가.
 * 진행 중이던 evaluate가 끝난 뒤 세트가 다르면 즉시 다시 stop.
 */
let epoch = 0;

let warmPromise: Promise<void> | null = null;
let gestureWarmed = false;
let dirtGtrLoaded = false;

/** SOUND 미리듣기 세대 — 연속 탭 시 이전 타이머 무효화 */
let previewGen = 0;

/** dirt-samples 실기타 WAV (strudel docs 예제와 동일) */
const DIRT_GTR = {
  gtr: [
    "gtr/0001_cleanC.wav",
    "gtr/0002_ovrdC.wav",
    "gtr/0003_distC.wav",
  ],
} as const;
const DIRT_BASE =
  "https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/";

export function getLastStrudelCode(): string {
  return lastCode;
}

export function getPlaybackEpoch(): number {
  return epoch;
}

export function isEngineReady(): boolean {
  return replRef != null;
}

export function isGestureWarmed(): boolean {
  return gestureWarmed;
}

/**
 * 현재 사이클 위상 0..1 (한 사이클 = 차트 전체 16박).
 * 엔진 미준비·정지 직후면 null.
 */
export function getCyclePhase(): number | null {
  const now = replRef?.scheduler?.now;
  if (typeof now !== "function") return null;
  try {
    const t = now.call(replRef.scheduler) as number;
    if (!Number.isFinite(t)) return null;
    return ((t % 1) + 1) % 1;
  } catch {
    return null;
  }
}

/**
 * AudioContext running 보장.
 * superdough initAudio의 resume 조건이 깨져 있어 여기서 명시 resume.
 */
export async function ensureAudioRunning(): Promise<void> {
  const ctx = getAudioContext() as AudioContext;
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  await initAudio();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  if (ctx.state === "running") {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const osc = ctx.createOscillator();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    osc.start(t);
    osc.stop(t + 0.05);
  }
}

export function getAudioState(): string {
  try {
    return (getAudioContext() as AudioContext).state;
  } catch {
    return "missing";
  }
}

async function loadDirtGtr(): Promise<void> {
  if (dirtGtrLoaded) return;
  await samples({ ...DIRT_GTR }, DIRT_BASE);
  dirtGtrLoaded = true;
}

export async function initStrudelEngine(): Promise<Repl> {
  if (!boot) {
    boot = initStrudel({
      prebake: async () => {
        await loadDirtGtr();
      },
    })
      .then((repl: Repl) => {
        replRef = repl;
        return repl;
      })
      .catch((err: unknown) => {
        boot = null;
        replRef = null;
        throw err;
      });
  }
  return boot;
}

/**
 * 첫 포인터 제스처에서 호출.
 * 오디오 unlock + gtr 워밍. Play를 막지 않는다.
 */
export function warmOnGesture(_preferred?: SoundId): Promise<void> {
  if (warmPromise) return warmPromise;
  warmPromise = (async () => {
    await initStrudelEngine();
    await ensureAudioRunning();
    gestureWarmed = true;
    await loadDirtGtr();
  })().catch((err) => {
    console.warn("warmOnGesture failed", err);
    warmPromise = null;
  });
  return warmPromise;
}

/** @deprecated warmOnGesture 사용 */
export async function preloadGuitarSamples(
  bodyId: SoundId,
  _gateEpoch: number,
): Promise<boolean> {
  await warmOnGesture(bodyId);
  return true;
}

/**
 * SOUND 칩 탭 미리듣기 (정지 중만 호출).
 * 짧은 C 스트럼 후 hush. 연속 탭·Play가 오면 세대/epoch로 무효화.
 */
export function previewSound(id: SoundId): void {
  const my = ++previewGen;
  const code = previewSoundCode(id);
  void (async () => {
    try {
      await warmOnGesture(id);
      if (my !== previewGen) return;
      await ensureAudioRunning();
      if (my !== previewGen) return;
      lastCode = code;
      await evaluate(code);
      await new Promise((r) => setTimeout(r, 700));
      if (my !== previewGen) return;
      // Play가 이미 잡았으면 epoch가 바뀌었을 수 있음 — hush는 재생을 끊지 않게 epoch 확인
      // preview는 epoch를 올리지 않으므로, 재생 중이 아닐 때만 hush
      try {
        hush();
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.warn("previewSound failed", err);
    }
  })();
}

/** 미리듣기 취소 (Play/Stop 시) */
export function cancelPreview(): void {
  previewGen += 1;
}

/**
 * Strudel 코드 평가·재생.
 * @returns 이 호출이 여전히 유효한 재생인지 (정지 레이스면 false)
 */
export async function evaluateStrudel(code: string): Promise<boolean> {
  const my = epoch;
  lastCode = code;
  cancelPreview();

  const run = async (): Promise<boolean> => {
    if (my !== epoch) return false;
    await initStrudelEngine();
    if (my !== epoch) return false;
    await ensureAudioRunning();
    if (my !== epoch) return false;
    await evaluate(code);
    if (my !== epoch) {
      try {
        hush();
      } catch {
        /* ignore */
      }
      return false;
    }
    return true;
  };

  const next = queue.then(run, run);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** 재생 중지. 진행 중/대기 중 evaluate는 epoch로 무효화된다. */
export function hushStrudel(): void {
  epoch += 1;
  cancelPreview();
  try {
    hush();
  } catch (err) {
    console.warn("hush failed", err);
  }
}
