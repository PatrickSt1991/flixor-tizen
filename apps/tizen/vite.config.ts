/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      // Tizen TVs run old Chromium WebViews (Tizen 3.0 = Chrome 47,
      // 4.0 = 56, 5.x = 63). Chrome 63 supports <script type="module">, so
      // with dual output it picks the MODERN bundle and chokes on newer
      // syntax (import.meta in Vite's inline detector, ?./?? in deps).
      // NOTE: renderModernChunks:false is NOT used — it silently drops the
      // CSS asset from the build (vitejs/vite#10782, #14324). Instead the
      // tizen-legacy-only plugin below rewrites index.html to serve ONLY the
      // fully transpiled SystemJS bundle, keeping the normal CSS pipeline.
      targets: ['chrome >= 47'],
    }),
    {
      // 1. Drop every modern/module tag from index.html: Chrome 63 would
      //    pick the modern bundle and die on import.meta / ?. syntax.
      // 2. Un-gate the legacy scripts (remove `nomodule`) so every WebView
      //    generation runs the same transpiled SystemJS bundle.
      // 3. Strip `crossorigin`: the widget is served from a local scheme
      //    with no CORS headers, so the WebView REFUSES any local
      //    script/stylesheet tagged crossorigin (incl. the CSS link!) —
      //    silent hang on the static splash.
      // 4. Delete the now-unreferenced modern JS chunks from the bundle.
      // Verified in headless Chromium 63.0.3239.0 (same engine as Tizen 5.0).
      name: 'tizen-legacy-only',
      enforce: 'post',
      transformIndexHtml(html: string) {
        return html
          .replace(/<script type="module"[^>]*src="[^"]*"[^>]*><\/script>\s*/g, '')
          .replace(/<script type="module">[\s\S]*?<\/script>\s*/g, '')
          .replace(/<link rel="modulepreload"[^>]*>\s*/g, '')
          .replace(/<script nomodule/g, '<script')
          .replace(/ crossorigin(?:="[^"]*")?/g, '')
      },
      generateBundle(_options: unknown, bundle: Record<string, { type: string }>) {
        for (const fileName of Object.keys(bundle)) {
          if (
            fileName.endsWith('.js') &&
            bundle[fileName].type === 'chunk' &&
            !fileName.includes('-legacy')
          ) {
            delete bundle[fileName]
          }
        }
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
