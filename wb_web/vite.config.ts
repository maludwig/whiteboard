import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  // viteSingleFile inlines all JS and CSS into dist/index.html so the build
  // is a single portable file that works from the filesystem, no server needed.
  plugins: [react(), viteSingleFile()],
  // The app lives at /whiteboard/ and calls its API relative to that (api/upload).
  base: '/whiteboard/',
  build: {
    target: 'es2022',
  },
  server: {
    // Cross-origin isolated, for a finer performance.now() (as wb_server sends for static files).
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    // `npm run dev` talks to a locally running wb_server (whiteboard serve).
    proxy: {
      '/whiteboard/api': 'http://127.0.0.1:8181',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
