import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    /** @strudel/web dist 번들 대신 소스 — 의존성 그래프 단일화 */
    alias: {
      '@strudel/web': path.resolve(root, 'node_modules/@strudel/web/web.mjs'),
    },
    dedupe: [
      'superdough',
      '@strudel/core',
      '@strudel/webaudio',
      '@strudel/mini',
      '@strudel/tonal',
      '@strudel/transpiler',
    ],
  },
  optimizeDeps: {
    include: ['@strudel/web', 'superdough'],
  },
})
