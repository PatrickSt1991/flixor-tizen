import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Simulates the old Tizen engines (Chrome 47 / 56) by deleting the APIs the
 * polyfill module covers, then re-importing it. Regression tests for
 * #58 (t.scrollTo is not a function) and #59 (IntersectionObserver missing).
 */
type Proto = Record<string, unknown>;

const elProto = Element.prototype as unknown as Proto;
const mediaProto = HTMLMediaElement.prototype as unknown as Proto;
const g = globalThis as unknown as Proto;

let saved: Record<string, unknown>;

beforeEach(() => {
  saved = {
    scrollTo: elProto.scrollTo,
    scrollBy: elProto.scrollBy,
    play: mediaProto.play,
  };
  delete elProto.scrollTo;
  delete elProto.scrollBy;
  vi.resetModules();
});

afterEach(() => {
  const restore = (obj: Proto, key: string, value: unknown) => {
    if (value === undefined) delete obj[key];
    else obj[key] = value;
  };
  restore(elProto, 'scrollTo', saved.scrollTo);
  restore(elProto, 'scrollBy', saved.scrollBy);
  restore(mediaProto, 'play', saved.play);
});

describe('legacy Tizen polyfills', () => {
  it('adds Element.scrollTo/scrollBy supporting the options form', async () => {
    await import('../../polyfills');
    const el = document.createElement('div');
    expect(typeof el.scrollTo).toBe('function');

    el.scrollTo({ top: 120, left: 30, behavior: 'auto' });
    expect(el.scrollTop).toBe(120);
    expect(el.scrollLeft).toBe(30);

    el.scrollTo({ top: 50 }); // left untouched
    expect(el.scrollTop).toBe(50);
    expect(el.scrollLeft).toBe(30);

    el.scrollTo(5, 6);
    expect(el.scrollLeft).toBe(5);
    expect(el.scrollTop).toBe(6);

    el.scrollBy({ top: 10 });
    expect(el.scrollTop).toBe(16);
    el.scrollBy(1, 1);
    expect(el.scrollLeft).toBe(6);
    expect(el.scrollTop).toBe(17);
  });

  // jsdom has no native IntersectionObserver, like Tizen 3.0. (The w3c
  // polyfill is CJS and runs once per worker, so it is not deleted/reset.)
  it('provides IntersectionObserver', async () => {
    await import('../../polyfills');
    expect(typeof g.IntersectionObserver).toBe('function');
    const io = new IntersectionObserver(() => {}, { rootMargin: '200px' });
    io.observe(document.createElement('div'));
    io.disconnect();
  });

  it('makes HTMLMediaElement.play() always return a promise', async () => {
    mediaProto.play = function () {
      return undefined; // Chrome < 50 behaviour
    };
    await import('../../polyfills');
    const video = document.createElement('video');
    const result = video.play();
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeUndefined();
  });

  it('keeps native implementations when present', async () => {
    const native = function nativeScrollTo() {};
    elProto.scrollTo = native;
    await import('../../polyfills');
    expect(elProto.scrollTo).toBe(native);
  });
});
