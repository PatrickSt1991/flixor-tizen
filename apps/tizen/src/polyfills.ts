/**
 * DOM API polyfills for old Tizen WebViews.
 *
 * @vitejs/plugin-legacy (core-js) only covers ECMAScript built-ins — DOM/Web
 * APIs are NOT polyfilled. Tizen engines: 3.0 = Chrome 47, 4.0 = Chrome 56,
 * 5.x = Chrome 63. Everything here is feature-detected, so newer TVs (and
 * jsdom in tests) keep their native implementations.
 *
 * Imported first in main.tsx so it runs before any component code.
 */

// IntersectionObserver — Chrome 51. Missing on Tizen 3.0 (issue #59).
// The w3c polyfill is a no-op when the native API exists.
import "intersection-observer";

type ScrollFn = (this: unknown, ...args: unknown[]) => void;

function toNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Element.prototype.scrollTo / scrollBy — Chrome 61. Missing on Tizen 3.0 and
 * 4.0, where `el.scrollTo(...)` throws "scrollTo is not a function" (#58).
 * `behavior` is ignored: smooth scrolling is a no-op on Tizen anyway.
 */
function polyfillElementScroll(): void {
  if (typeof Element === "undefined") return;
  const proto = Element.prototype as unknown as Record<string, ScrollFn>;

  if (typeof proto.scrollTo !== "function") {
    proto.scrollTo = function (this: Element, a?: unknown, b?: unknown) {
      if (a !== null && typeof a === "object") {
        const o = a as ScrollToOptions;
        if (o.left !== undefined) this.scrollLeft = toNumber(o.left, this.scrollLeft);
        if (o.top !== undefined) this.scrollTop = toNumber(o.top, this.scrollTop);
      } else {
        this.scrollLeft = toNumber(a, this.scrollLeft);
        this.scrollTop = toNumber(b, this.scrollTop);
      }
    } as ScrollFn;
  }

  if (typeof proto.scrollBy !== "function") {
    proto.scrollBy = function (this: Element, a?: unknown, b?: unknown) {
      if (a !== null && typeof a === "object") {
        const o = a as ScrollToOptions;
        this.scrollLeft += toNumber(o.left, 0);
        this.scrollTop += toNumber(o.top, 0);
      } else {
        this.scrollLeft += toNumber(a, 0);
        this.scrollTop += toNumber(b, 0);
      }
    } as ScrollFn;
  }
}

/**
 * window.scrollTo / scrollBy with an options object. Old engines only accept
 * (x, y); an options object coerces to NaN and the call does nothing. Wrap
 * once, translating options to coordinates. Detected via
 * `scrollBehavior in documentElement.style` (shipped alongside the options
 * overloads).
 */
function polyfillWindowScroll(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if ("scrollBehavior" in document.documentElement.style) return;

  const nativeTo = window.scrollTo;
  const nativeBy = window.scrollBy;
  if (typeof nativeTo !== "function" || typeof nativeBy !== "function") return;

  const curX = () => window.pageXOffset || 0;
  const curY = () => window.pageYOffset || 0;

  window.scrollTo = function (a?: unknown, b?: unknown) {
    if (a !== null && typeof a === "object") {
      const o = a as ScrollToOptions;
      nativeTo.call(window, toNumber(o.left, curX()), toNumber(o.top, curY()));
    } else {
      nativeTo.call(window, toNumber(a, curX()), toNumber(b, curY()));
    }
  } as typeof window.scrollTo;

  window.scrollBy = function (a?: unknown, b?: unknown) {
    if (a !== null && typeof a === "object") {
      const o = a as ScrollToOptions;
      nativeBy.call(window, toNumber(o.left, 0), toNumber(o.top, 0));
    } else {
      nativeBy.call(window, toNumber(a, 0), toNumber(b, 0));
    }
  } as typeof window.scrollBy;
}

/**
 * HTMLMediaElement.play() returns a Promise only from Chrome 50. On Tizen 3.0
 * it returns undefined, so `video.play().catch(...)` throws a TypeError.
 */
function polyfillMediaPlayPromise(): void {
  if (typeof HTMLMediaElement === "undefined") return;
  const proto = HTMLMediaElement.prototype;
  const nativePlay = proto.play;
  if (typeof nativePlay !== "function") return;
  // Can't feature-detect without actually playing; wrapping is harmless
  // because a native Promise result is passed straight through.
  proto.play = function (this: HTMLMediaElement) {
    const result = nativePlay.call(this) as Promise<void> | undefined;
    return result && typeof result.then === "function" ? result : Promise.resolve();
  };
}

polyfillElementScroll();
polyfillWindowScroll();
polyfillMediaPlayPromise();
