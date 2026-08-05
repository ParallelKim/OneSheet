import { evaluate, hush, initStrudel } from "@strudel/web";

let ready: Promise<unknown> | null = null;

export async function initStrudelEngine(): Promise<void> {
  if (!ready) {
    ready = initStrudel();
  }
  await ready;
}

export async function evaluateStrudel(code: string): Promise<void> {
  await evaluate(code);
}

export function hushStrudel(): void {
  hush();
}
