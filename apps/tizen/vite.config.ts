/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import type { Plugin as PostcssPlugin, Rule as PostcssRule } from 'postcss'

/**
 * Tizen WebViews predate `gap` in FLEXBOX (Chrome 84) — it is silently
 * ignored and every flex layout collapses together. Grid gap works since
 * Chrome 57, so grid rules are left alone. This plugin REPLACES flex gap
 * with child-margin rules, which render identically on every engine from
 * Chrome 47 to current — no @supports gymnastics, no double spacing.
 *
 *   row (default):        .sel > * + * { margin-left: <gap> }
 *   flex-direction:column .sel > * + * { margin-top: <gap> }
 *   flex-wrap:wrap        .sel > *     { margin: 0 <gap> <gap> 0 }
 */
function tizenFlexGapFallback(): PostcssPlugin {
  return {
    postcssPlugin: 'tizen-flex-gap-fallback',
    OnceExit(root, { Rule, Declaration }) {
      root.walkRules((rule) => {
        if (!rule.selector || rule.selector.includes('>')) return
        let display: string | undefined
        let gap: string | undefined
        let rowGap: string | undefined
        let colGap: string | undefined
        let column = false
        let wrap = false
        rule.walkDecls((d) => {
          if (d.prop === 'display') display = d.value
          else if (d.prop === 'gap') gap = d.value
          else if (d.prop === 'row-gap') rowGap = d.value
          else if (d.prop === 'column-gap') colGap = d.value
          else if (d.prop === 'flex-direction' && d.value.includes('column')) column = true
          else if (d.prop === 'flex-wrap' && d.value.includes('wrap')) wrap = true
        })
        if (!gap && !rowGap && !colGap) return
        if (display && /grid/.test(display)) {
          // GRID: the modern `gap`/`row-gap`/`column-gap` shorthands only work
          // on a grid from Chrome 66; Chrome 47–65 need the `grid-*` names
          // (still honored by modern browsers). Verified in Chromium 63:
          // `gap` on a grid → 0px, `grid-gap` → applied. Rename in place.
          rule.walkDecls((d) => {
            if (d.prop === 'gap') d.prop = 'grid-gap'
            else if (d.prop === 'row-gap') d.prop = 'grid-row-gap'
            else if (d.prop === 'column-gap') d.prop = 'grid-column-gap'
          })
          return
        }
        if (!display || !/flex/.test(display)) return
        const parts = (gap || '').trim().split(/\s+/)
        const rg = rowGap || parts[0]
        const cg = colGap || parts[1] || parts[0]
        rule.walkDecls((d) => {
          if (d.prop === 'gap' || d.prop === 'row-gap' || d.prop === 'column-gap') d.remove()
        })
        const childRule: PostcssRule = new Rule({
          selector: rule.selectors.map((s) => (wrap ? `${s} > *` : `${s} > * + *`)).join(',\n'),
        })
        if (wrap) {
          childRule.append(new Declaration({ prop: 'margin', value: `0 ${cg} ${rg} 0` }))
        } else {
          childRule.append(
            new Declaration({ prop: column ? 'margin-top' : 'margin-left', value: column ? rg : cg })
          )
        }
        rule.after(childRule)
      })
    },
  }
}

/**
 * `inset` shorthand is Chrome 87+ — older WebViews drop the declaration and
 * fixed/absolute overlays land in the wrong place. Expand to longhands.
 */
function tizenInsetLonghand(): PostcssPlugin {
  return {
    postcssPlugin: 'tizen-inset-longhand',
    Declaration: {
      inset(decl, { Declaration }) {
        const v = decl.value.trim().split(/\s+/)
        const [top, right = v[0], bottom = v[0], left = right] = v
        decl.replaceWith(
          new Declaration({ prop: 'top', value: top }),
          new Declaration({ prop: 'right', value: right }),
          new Declaration({ prop: 'bottom', value: bottom }),
          new Declaration({ prop: 'left', value: left })
        )
      },
    },
  }
}

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
  css: {
    postcss: {
      plugins: [tizenFlexGapFallback(), tizenInsetLonghand()],
    },
  },
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
