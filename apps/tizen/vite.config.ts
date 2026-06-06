/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      // Tizen 5.0 ships Chromium 63. It supports ES modules, so it would load the
      // modern (type="module") bundle — which contains optional chaining (?.) from
      // hls.js/dashjs that Chrome 63 can't parse, killing the whole module graph
      // (blank app stuck on the static "FLIXOR LOADING..." placeholder in index.html).
      // renderModernChunks:false emits a single fully-transpiled SystemJS bundle for
      // all browsers, so the TV never receives unparseable syntax.
      targets: ['chrome >= 63'],
      renderModernChunks: false,
    }),
    {
      // Tizen serves the packaged widget from a local scheme with no CORS
      // headers. `crossorigin` on local <script>/<link> tags makes the WebView
      // treat them as cross-origin requests; with no Access-Control-Allow-Origin
      // they are refused, SystemJS never loads, and the app hangs on the OS
      // launch splash. Strip crossorigin from the generated HTML.
      name: 'tizen-strip-crossorigin',
      enforce: 'post',
      transformIndexHtml(html) {
        return html.replace(/ crossorigin(?:="[^"]*")?/g, '')
      },
    },
  ],
  base: './',
  build: {
    target: ['chrome63'],
    modulePreload: false,
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600, // vendor-streaming (hls.js + dashjs) is ~1.5MB
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-spatial': ['@noriginmedia/norigin-spatial-navigation'],
          'vendor-streaming': ['hls.js', 'dashjs'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/__tests__/**', 'src/main.tsx', 'src/**/*.test.{ts,tsx}'],
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
    },
  },
})
