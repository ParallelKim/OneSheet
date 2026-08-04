import { evaluate, hush, initStrudel } from '@strudel/web'
import { toStrudel, type Sheet } from './sheet'

let ready: Promise<unknown> | null = null
let playing = false
let lastCode = ''

export function isPlaying(): boolean {
  return playing
}

export async function ensureEngine(): Promise<void> {
  if (!ready) {
    ready = initStrudel()
  }
  await ready
}

export async function playSheet(sheet: Sheet): Promise<void> {
  await ensureEngine()
  const code = toStrudel(sheet)
  lastCode = code
  await evaluate(code)
  playing = true
}

/** Live update while playing — Strudel-style re-eval. */
export async function updateSheet(sheet: Sheet): Promise<void> {
  if (!playing) return
  const code = toStrudel(sheet)
  if (code === lastCode) return
  lastCode = code
  await evaluate(code)
}

export function stopSheet(): void {
  hush()
  playing = false
  lastCode = ''
}
