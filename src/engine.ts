import { getFontBufferSource, registerSoundfonts } from "@strudel/soundfonts";
import {
  evaluate,
  getAudioContext,
  hush,
  initAudio,
  initStrudel,
} from "@strudel/web";
import {
  bodyById,
  MUTE_FONT,
  type GuitarBodyId,
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

/** 바디별 프리로드 완료 키 */
const preloadedBodies = new Set<string>();

/**
 * 폰트 파일 + 대표 존만 워밍.
 * (많이 돌리면 첫 Play가 길어져 제스처/컨텍스트가 식음)
 */
const PRELOAD_MIDI = [60, 67];

export function getLastStrudelCode(): string {
  return lastCode;
}

export function getPlaybackEpoch(): number {
  return epoch;
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
 * superdough initAudio의 resume 조건이 깨져 있어(`(!ctx) instanceof …`)
 * 여기서 명시적으로 resume + silent unlock 한다.
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
  // 일부 브라우저는 resume만으로 부족 — 무음 노드로 destination unlock
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
      // GM 기타 샘플 (nylon/steel/clean/muted) — 기본 번들은 신스만 등록
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

/**
 * 기타 soundfont를 미리 받아 디코드한다.
 * 실패해도 재생은 시도할 수 있게 true/false만 게이트용으로 쓴다.
 * @returns 이 호출이 여전히 유효한지 (로딩 중 정지면 false)
 */
export async function preloadGuitarSamples(
  bodyId: GuitarBodyId,
  gateEpoch: number,
): Promise<boolean> {
  if (gateEpoch !== epoch) return false;
  await initStrudelEngine();
  if (gateEpoch !== epoch) return false;

  await ensureAudioRunning();
  if (gateEpoch !== epoch) return false;

  if (preloadedBodies.has(bodyId)) return true;

  const ctx = getAudioContext() as AudioContext;
  const openFont = bodyById(bodyId).font;
  const fonts = [openFont, MUTE_FONT];

  await Promise.all(
    fonts.flatMap((font) =>
      PRELOAD_MIDI.map((midi) =>
        getFontBufferSource(font, { note: midi }, ctx).catch((err: unknown) => {
          console.warn("soundfont preload", font, midi, err);
          return null;
        }),
      ),
    ),
  );

  if (gateEpoch !== epoch) return false;
  preloadedBodies.add(bodyId);
  return true;
}

/** 바디 바꿀 때 워밍 캐시 무효 (다음 Play에서 다시 받음) */
export function invalidateBodyPreload(bodyId?: GuitarBodyId): void {
  if (bodyId) preloadedBodies.delete(bodyId);
  else preloadedBodies.clear();
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

/** 재생 중지. 진행 중/대기 중 evaluate·프리로드는 epoch로 무효화된다. */
export function hushStrudel(): void {
  epoch += 1;
  try {
    hush();
  } catch (err) {
    console.warn("hush failed", err);
  }
}
