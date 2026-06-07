import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Tizen TV remote control handler.
 *
 * Key fixes (Phase 3):
 * - Arrow keys (37-40) pass through unthrottled so norigin-spatial-navigation handles them
 * - Debounce only applies to action keys (Back, MediaPlayPause, etc.)
 * - Channel Up/Down (427/428) for section jumping
 * - Color keys (403-406) for contextual actions
 * - Does NOT preventDefault on arrow keys — spatial nav needs them
 */

// Tizen key codes
const KEY = {
  BACK: 10009,
  EXIT: 10182,
  MEDIA_PLAY_PAUSE: 10252,
  MEDIA_PLAY: 415,
  MEDIA_PAUSE: 19,
  MEDIA_STOP: 413,
  MEDIA_REWIND: 412,
  MEDIA_FAST_FORWARD: 417,
  CHANNEL_UP: 427,
  CHANNEL_DOWN: 428,
  COLOR_RED: 403,
  COLOR_GREEN: 404,
  COLOR_YELLOW: 405,
  COLOR_BLUE: 406,
  // Standard arrow keys (handled by spatial nav, NOT by us)
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
} as const;

// Keys that spatial nav handles — we must NOT interfere
const SPATIAL_NAV_KEYS: Set<number> = new Set([KEY.LEFT, KEY.UP, KEY.RIGHT, KEY.DOWN, KEY.ENTER]);

// Debounce interval for action keys only (ms)
const ACTION_DEBOUNCE_MS = 200;

export function useTizenRemote() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const tizen = (globalThis as unknown as { tizen?: TizenGlobal }).tizen;
    let lastActionKeyTime = 0;

    // Register Tizen TV input device keys
    if (tizen?.tvinputdevice) {
      try {
        // NOTE: 'Exit' is deliberately NOT registered — registering a key
        // takes ownership away from the system, so the TV stopped closing
        // the app on EXIT. Unregistered, the system handles EXIT natively.
        const keys = [
          'Return',
          'Left', 'Up', 'Right', 'Down', 'Enter',
          // Number row (remotes that have one) — lets PIN entry type directly
          '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
          'Menu',
          'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop',
          'MediaRewind', 'MediaFastForward',
          'ChannelUp', 'ChannelDown',
          'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
        ];
        keys.forEach(key => {
          try {
            tizen.tvinputdevice?.registerKey(key);
          } catch {
            // Key may not be available on all models
          }
        });
      } catch (err) {
        console.error('[TizenRemote] Failed to access tvinputdevice:', err);
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const keyCode = e.keyCode || e.which;

      // Arrow keys + Enter: let spatial navigation handle them — do NOT block
      if (SPATIAL_NAV_KEYS.has(keyCode)) {
        return; // pass through, no preventDefault, no debounce
      }

      // Action keys: apply debounce to prevent rapid repeat
      const now = Date.now();
      if (now - lastActionKeyTime < ACTION_DEBOUNCE_MS) return;
      lastActionKeyTime = now;

      // ── Exit: close the app outright (defensive — normally the system
      // handles EXIT since we no longer register the key) ─────────
      if (keyCode === KEY.EXIT) {
        e.preventDefault();
        try {
          tizen?.application?.getCurrentApplication().exit();
        } catch { /* ignore */ }
        return;
      }

      // ── Back / Return ──────────────────────────────────────────
      if (keyCode === KEY.BACK || e.key === 'Backspace' || e.key === 'Escape') {
        e.preventDefault();
        if (location.pathname !== '/' && location.pathname !== '/login') {
          navigate(-1);
        } else if (tizen) {
          try {
            tizen.application?.getCurrentApplication().exit();
          } catch { /* ignore */ }
        }
        return;
      }

      // ── Media keys ─────────────────────────────────────────────
      if (
        keyCode === KEY.MEDIA_PLAY_PAUSE ||
        keyCode === KEY.MEDIA_PLAY ||
        keyCode === KEY.MEDIA_PAUSE ||
        e.key === 'MediaPlayPause'
      ) {
        e.preventDefault();
        const video = document.querySelector('video');
        if (video) {
          if (video.paused) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
        return;
      }

      if (keyCode === KEY.MEDIA_STOP || e.key === 'MediaStop') {
        e.preventDefault();
        const video = document.querySelector('video');
        if (video) {
          video.pause();
          video.currentTime = 0;
        }
        return;
      }

      if (keyCode === KEY.MEDIA_REWIND || e.key === 'MediaRewind') {
        e.preventDefault();
        const video = document.querySelector('video');
        if (video) video.currentTime = Math.max(0, video.currentTime - 10);
        return;
      }

      if (keyCode === KEY.MEDIA_FAST_FORWARD || e.key === 'MediaFastForward') {
        e.preventDefault();
        const video = document.querySelector('video');
        if (video) video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
        return;
      }

      // ── Channel Up/Down — section jump on scrollable pages ─────
      if (keyCode === KEY.CHANNEL_UP) {
        e.preventDefault();
        window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'auto' });
        return;
      }

      if (keyCode === KEY.CHANNEL_DOWN) {
        e.preventDefault();
        window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'auto' });
        return;
      }

      // ── Color keys — contextual actions ────────────────────────
      if (keyCode === KEY.COLOR_RED) {
        e.preventDefault();
        // Red = Back (same as Return for convenience)
        if (location.pathname !== '/' && location.pathname !== '/login') {
          navigate(-1);
        }
        return;
      }

      if (keyCode === KEY.COLOR_GREEN) {
        e.preventDefault();
        // Green = Play focused item (dispatch Enter on focused element)
        const focused = document.activeElement as HTMLElement | null;
        if (focused) {
          focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        }
        return;
      }

      if (keyCode === KEY.COLOR_YELLOW) {
        e.preventDefault();
        // Yellow = Search shortcut
        if (location.pathname !== '/search') {
          navigate('/search');
        }
        return;
      }

      if (keyCode === KEY.COLOR_BLUE) {
        e.preventDefault();
        // Blue = Settings shortcut
        if (location.pathname !== '/settings') {
          navigate('/settings');
        }
        return;
      }
    };

    // Tizen lifecycle — pause/resume video on visibility change
    const handleVisibilityChange = () => {
      const video = document.querySelector('video');
      if (!video) return;

      if (document.hidden) {
        if (!video.paused) {
          video.pause();
          video.dataset.wasPlaying = 'true';
        }
      } else {
        if (video.dataset.wasPlaying === 'true') {
          video.play().catch(() => {});
          delete video.dataset.wasPlaying;
        }
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate, location.pathname]);
}

interface TizenGlobal {
  tvinputdevice?: {
    registerKey(key: string): void;
  };
  application?: {
    getCurrentApplication(): { exit(): void };
  };
}

declare global {
  interface Window {
    tizen?: TizenGlobal;
  }
}
