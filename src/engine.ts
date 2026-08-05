import { registerSoundfonts } from "@strudel/soundfonts";
import { evaluate, hush, initStrudel } from "@strudel/web";

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
