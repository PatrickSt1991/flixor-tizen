/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11', 'chrome 60'],
    }),
  ],
  base: './',
  build: {
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
