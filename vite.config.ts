import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    /**
     * @strudel/web dist는 webaudio/superdough를 이미 묶은 번들.
     * soundfonts가 별도 @strudel/webaudio를 쓰면 soundMap이 둘로 갈라져
     * gm_* 등록이 재생 쪽에 안 보인다 → 소스 web.mjs로 한 그래프에 묶는다.
     */
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
    include: ['@strudel/web', '@strudel/soundfonts', 'superdough'],
  },
})
