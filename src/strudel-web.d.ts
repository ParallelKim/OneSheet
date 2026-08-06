declare module '@strudel/web' {
  export function initStrudel(options?: Record<string, unknown>): Promise<unknown>
  export function evaluate(code: string): Promise<unknown>
  export function hush(): void
  export function getAudioContext(): AudioContext
  export function initAudio(options?: Record<string, unknown>): Promise<AudioContext>
  export function samples(
    sampleMap: Record<string, unknown> | string,
    baseUrl?: string,
    options?: Record<string, unknown>,
  ): Promise<void>
}
