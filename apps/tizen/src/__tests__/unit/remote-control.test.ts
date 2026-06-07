import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockLocation = { pathname: "/" };

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

vi.mock("react", () => ({
  useEffect: (fn: () => (() => void) | void) => {
    const cleanup = fn();
    if (cleanup) (globalThis as any).__tizenRemoteCleanup = cleanup;
  },
}));

// ── Key codes ──────────────────────────────────────────────────────────

const KEY = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
  BACK: 10009,
  MEDIA_PLAY_PAUSE: 10252,
  MEDIA_STOP: 413,
  MEDIA_REWIND: 412,
  MEDIA_FAST_FORWARD: 417,
  CHANNEL_UP: 427,
  CHANNEL_DOWN: 428,
  COLOR_RED: 403,
  COLOR_GREEN: 404,
  COLOR_YELLOW: 405,
  COLOR_BLUE: 406,
};

// ── Helpers ────────────────────────────────────────────────────────────

function fireKey(keyCode: number, key = "") {
  const event = new KeyboardEvent("keydown", {
    keyCode,
    key,
    bubbles: true,
    cancelable: true,
  } as any);
  globalThis.dispatchEvent(event);
  return event;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("useTizenRemote", () => {
  beforeEach(() => {
    vi.resetModules();
    mockNavigate.mockClear();
    mockLocation.pathname = "/";
    // Remove any previous cleanup
    if ((globalThis as any).__tizenRemoteCleanup) {
      (globalThis as any).__tizenRemoteCleanup();
      delete (globalThis as any).__tizenRemoteCleanup;
    }
  });

  afterEach(() => {
    if ((globalThis as any).__tizenRemoteCleanup) {
      (globalThis as any).__tizenRemoteCleanup();
      delete (globalThis as any).__tizenRemoteCleanup;
    }
  });

  async function loadHook() {
    const mod = await import("../../hooks/useTizenRemote");
    mod.useTizenRemote();
  }

  // ── Arrow keys pass through ──────────────────────────────────

  it("does NOT block arrow key LEFT (37)", async () => {
    await loadHook();
    fireKey(KEY.LEFT);
    // Arrow keys should not be prevented — spatial nav handles them
    // We verify navigate was NOT called (arrows don't trigger navigation)
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("does NOT block arrow key RIGHT (39)", async () => {
    await loadHook();
    fireKey(KEY.RIGHT);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("does NOT block arrow key UP (38)", async () => {
    await loadHook();
    fireKey(KEY.UP);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("does NOT block arrow key DOWN (40)", async () => {
    await loadHook();
    fireKey(KEY.DOWN);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("does NOT block Enter key (13)", async () => {
    await loadHook();
    fireKey(KEY.ENTER);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // ── Back key ─────────────────────────────────────────────────

  it("Back key on non-root page navigates back", async () => {
    mockLocation.pathname = "/details/123";
    await loadHook();
    fireKey(KEY.BACK);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("Back key on root page does not navigate", async () => {
    mockLocation.pathname = "/";
    await loadHook();
    fireKey(KEY.BACK);
    expect(mockNavigate).not.toHaveBeenCalledWith(-1);
  });

  it("Back key on /login does not navigate", async () => {
    mockLocation.pathname = "/login";
    await loadHook();
    fireKey(KEY.BACK);
    expect(mockNavigate).not.toHaveBeenCalledWith(-1);
  });

  // ── Media keys ───────────────────────────────────────────────

  it("MediaPlayPause toggles video playback", async () => {
    const mockVideo = {
      paused: true,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      currentTime: 50,
      duration: 100,
    };
    vi.spyOn(document, "querySelector").mockReturnValue(mockVideo as any);

    await loadHook();
    fireKey(KEY.MEDIA_PLAY_PAUSE);
    expect(mockVideo.play).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it("MediaStop pauses and resets video", async () => {
    const mockVideo = {
      paused: false,
      play: vi.fn(),
      pause: vi.fn(),
      currentTime: 50,
      duration: 100,
    };
    vi.spyOn(document, "querySelector").mockReturnValue(mockVideo as any);

    await loadHook();
    fireKey(KEY.MEDIA_STOP);
    expect(mockVideo.pause).toHaveBeenCalled();
    expect(mockVideo.currentTime).toBe(0);

    vi.restoreAllMocks();
  });

  it("MediaRewind seeks back 10 seconds", async () => {
    const mockVideo = {
      paused: false,
      currentTime: 50,
      duration: 100,
    };
    vi.spyOn(document, "querySelector").mockReturnValue(mockVideo as any);

    await loadHook();
    fireKey(KEY.MEDIA_REWIND);
    expect(mockVideo.currentTime).toBe(40);

    vi.restoreAllMocks();
  });

  it("MediaFastForward seeks forward 10 seconds", async () => {
    const mockVideo = {
      paused: false,
      currentTime: 50,
      duration: 100,
    };
    vi.spyOn(document, "querySelector").mockReturnValue(mockVideo as any);

    await loadHook();
    fireKey(KEY.MEDIA_FAST_FORWARD);
    expect(mockVideo.currentTime).toBe(60);

    vi.restoreAllMocks();
  });

  // ── Channel keys ─────────────────────────────────────────────

  it("ChannelUp scrolls page up", async () => {
    const scrollSpy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    await loadHook();
    fireKey(KEY.CHANNEL_UP);
    expect(scrollSpy).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "auto" }),
    );
    scrollSpy.mockRestore();
  });

  it("ChannelDown scrolls page down", async () => {
    const scrollSpy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    await loadHook();
    fireKey(KEY.CHANNEL_DOWN);
    expect(scrollSpy).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "auto" }),
    );
    scrollSpy.mockRestore();
  });

  // ── Color keys ───────────────────────────────────────────────

  it("Red key navigates back on non-root page", async () => {
    mockLocation.pathname = "/details/456";
    await loadHook();
    fireKey(KEY.COLOR_RED);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("Yellow key navigates to /search", async () => {
    mockLocation.pathname = "/";
    await loadHook();
    fireKey(KEY.COLOR_YELLOW);
    expect(mockNavigate).toHaveBeenCalledWith("/search");
  });

  it("Yellow key does nothing when already on /search", async () => {
    mockLocation.pathname = "/search";
    await loadHook();
    fireKey(KEY.COLOR_YELLOW);
    expect(mockNavigate).not.toHaveBeenCalledWith("/search");
  });

  it("Blue key navigates to /settings", async () => {
    mockLocation.pathname = "/";
    await loadHook();
    fireKey(KEY.COLOR_BLUE);
    expect(mockNavigate).toHaveBeenCalledWith("/settings");
  });

  it("Blue key does nothing when already on /settings", async () => {
    mockLocation.pathname = "/settings";
    await loadHook();
    fireKey(KEY.COLOR_BLUE);
    expect(mockNavigate).not.toHaveBeenCalledWith("/settings");
  });

  // ── Debounce ─────────────────────────────────────────────────

  it("action keys are debounced (rapid Back presses)", async () => {
    mockLocation.pathname = "/details/123";
    await loadHook();
    fireKey(KEY.BACK);
    fireKey(KEY.BACK); // should be debounced
    fireKey(KEY.BACK); // should be debounced
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});
