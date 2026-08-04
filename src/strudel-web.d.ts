declare module '@strudel/web' {
  export function initStrudel(options?: Record<string, unknown>): Promise<unknown>
  export function evaluate(code: string): Promise<unknown>
  export function hush(): void
}
