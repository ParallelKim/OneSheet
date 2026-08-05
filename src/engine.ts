import { evaluate, hush, initStrudel } from "@strudel/web";

type Repl = Awaited<ReturnType<typeof initStrudel>>;

let boot: Promise<Repl> | null = null;
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

export async function initStrudelEngine(): Promise<Repl> {
  if (!boot) {
    boot = initStrudel().catch((err) => {
      boot = null;
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
      // 평가 도중 정지됨 → 방금 올린 패턴을 끊는다
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
