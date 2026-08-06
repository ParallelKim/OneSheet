import { getFontBufferSource, registerSoundfonts } from "@strudel/soundfonts";
import {
  evaluate,
  getAudioContext,
  hush,
  initAudio,
  initStrudel,
} from "@strudel/web";
import {
  MUTE_FONT,
  SOUND_PRESETS,
  soundById,
  type SoundId,
} from "./sheet";

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

/** 워밍 완료된 font 파일 */
const warmedFonts = new Set<string>();
let warmPromise: Promise<void> | null = null;
let gestureWarmed = false;

/** 폰트 파일 + 대표 존 */
const PRELOAD_MIDI = [48, 55, 60, 67];

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

export async function initStrudelEngine(): Promise<Repl> {
  if (!boot) {
    boot = initStrudel({
      prebake: async () => {
        registerSoundfonts();
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

async function warmFont(font: string, ctx: AudioContext): Promise<void> {
  if (warmedFonts.has(font)) return;
  await Promise.all(
    PRELOAD_MIDI.map((midi) =>
      getFontBufferSource(font, { note: midi }, ctx).catch((err: unknown) => {
        console.warn("soundfont preload", font, midi, err);
        return null;
      }),
    ),
  );
  warmedFonts.add(font);
}

/**
 * 첫 포인터 제스처에서 호출.
 * 오디오 unlock + 모든 GM 기타/뮤트 폰트를 백그라운드 워밍.
 * Play를 막지 않는다.
 */
export function warmOnGesture(preferred?: SoundId): Promise<void> {
  if (warmPromise) return warmPromise;
  warmPromise = (async () => {
    await initStrudelEngine();
    await ensureAudioRunning();
    gestureWarmed = true;
    const ctx = getAudioContext() as AudioContext;

    // 현재 SOUND 우선
    const prefer = preferred ? soundById(preferred).font : null;
    if (prefer) await warmFont(prefer, ctx);
    await warmFont(MUTE_FONT, ctx);

    // 나머지 font 프리셋 idle에 가깝게 이어서
    for (const p of SOUND_PRESETS) {
      if (p.font && p.font !== prefer) await warmFont(p.font, ctx);
    }
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
 * Strudel 코드 평가·재생.
 * @returns 이 호출이 여전히 유효한 재생인지 (정지 레이스면 false)
 */
export async function evaluateStrudel(code: string): Promise<boolean> {
  const my = epoch;
  lastCode = code;

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
  try {
    hush();
  } catch (err) {
    console.warn("hush failed", err);
  }
}
