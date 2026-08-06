declare module "@strudel/web" {
  export function initStrudel(
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  export function evaluate(code: string): Promise<unknown>;
  export function hush(): void;
  export function getAudioContext(): AudioContext;
  export function initAudio(
    options?: Record<string, unknown>,
  ): Promise<AudioContext>;
  export function samples(
    sampleMap: Record<string, unknown> | string,
    baseUrl?: string,
    options?: Record<string, unknown>,
  ): Promise<void>;
  export function registerVoicings(
    name: string,
    dictionary: Record<string, string[]>,
    options?: Record<string, unknown>,
  ): void;
}

declare module "@strudel/soundfonts" {
  export function registerSoundfonts(): void;
  export function loadSoundfont(url: string): Promise<unknown>;
  export function setSoundfontUrl(url: string): void;
  export function getFontBufferSource(
    font: string,
    hap: { note?: string | number; freq?: number },
    ctx: AudioContext,
  ): Promise<AudioBufferSourceNode>;
}
