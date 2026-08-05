import { evaluate, hush, initStrudel } from "@strudel/web";

type Repl = Awaited<ReturnType<typeof initStrudel>>;

let boot: Promise<Repl> | null = null;
/** evaluate 직렬화 — 재생 중 연속 편집 시 레이스 방지 */
let queue: Promise<void> = Promise.resolve();
let lastCode = "";

export function getLastStrudelCode(): string {
  return lastCode;
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
 * init이 안 끝났으면 기다린 뒤 실행. 호출은 큐에 쌓인다.
 */
export async function evaluateStrudel(code: string): Promise<void> {
  lastCode = code;
  const run = async () => {
    const repl = await initStrudelEngine();
    if (!repl) throw new Error("Strudel 엔진이 준비되지 않았습니다");
    await evaluate(code);
  };

  const next = queue.then(run, run);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  await next;
}

export function hushStrudel(): void {
  try {
    hush();
  } catch (err) {
    console.warn("hush failed", err);
  }
}
