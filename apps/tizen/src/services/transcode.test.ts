import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  startTranscode,
  stopTranscode,
  updateTranscode,
  getActiveSessionId,
  stopActiveSession,
} from "./transcode";

// Mock the flixor service
vi.mock("./flixor", () => ({
  flixor: {
    plexServer: {
      makeTranscodeDecision: vi.fn().mockResolvedValue({
        url: "http://plex/transcode/decision",
        status: 200,
        ok: true,
        body: "",
      }),
      getTranscodeUrl: vi.fn().mockReturnValue({
        url: "http://plex/session/abc/base/index.m3u8",
        startUrl: "http://plex/transcode/start.m3u8",
        sessionUrl: "http://plex/session/abc/base/index.m3u8",
        sessionId: "abc-123",
      }),
      startTranscodeSession: vi.fn().mockResolvedValue(undefined),
      stopTranscode: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

const { flixor } = await import("./flixor");

beforeEach(() => {
  vi.clearAllMocks();
  // Reset active session by stopping any leftover
  stopActiveSession();
});

describe("startTranscode", () => {
  it("makes the decision then starts the session on the same session id", async () => {
    const result = await startTranscode("12345", {
      maxVideoBitrate: 8000,
      videoResolution: "1920x1080",
      audioStreamID: "201",
      mediaIndex: 0,
    });

    // The decision must run (it registers the subtitle-burn choice) and must
    // share the SAME session id that the start request then replays.
    expect(flixor.plexServer.makeTranscodeDecision).toHaveBeenCalledWith("12345", {
      audioStreamID: "201",
      subtitleStreamID: undefined,
      mediaIndex: 0,
      sessionId: expect.any(String),
      maxVideoBitrate: 8000,
      videoResolution: "1920x1080",
    });
    expect(flixor.plexServer.getTranscodeUrl).toHaveBeenCalledWith("12345", {
      maxVideoBitrate: 8000,
      videoResolution: "1920x1080",
      directStream: undefined,
      audioStreamID: "201",
      subtitleStreamID: undefined,
      offset: undefined,
      mediaIndex: 0,
      sessionId: expect.any(String),
    });
    const decisionSession = (flixor.plexServer.makeTranscodeDecision as ReturnType<typeof vi.fn>).mock.calls[0][1].sessionId;
    const urlSession = (flixor.plexServer.getTranscodeUrl as ReturnType<typeof vi.fn>).mock.calls[0][1].sessionId;
    expect(decisionSession).toBe(urlSession);
    // start.m3u8 is loaded by the player (hls.js), not pre-fetched here — no
    // redundant round-trip before playback.
    expect(flixor.plexServer.startTranscodeSession).not.toHaveBeenCalled();
    expect(result.sessionId).toBe("abc-123");
    expect(result.url).toBe("http://plex/session/abc/base/index.m3u8");
    expect(getActiveSessionId()).toBe("abc-123");
  });

  it("stops existing session before starting a new one", async () => {
    // Start first session
    await startTranscode("111");
    expect(getActiveSessionId()).toBe("abc-123");

    // Start second session — should stop the first
    await startTranscode("222");
    expect(flixor.plexServer.stopTranscode).toHaveBeenCalledWith("abc-123");
  });
});

describe("stopTranscode", () => {
  it("calls plexServer.stopTranscode and clears active session", async () => {
    await startTranscode("12345");
    expect(getActiveSessionId()).toBe("abc-123");

    await stopTranscode("abc-123");
    expect(flixor.plexServer.stopTranscode).toHaveBeenCalledWith("abc-123");
    expect(getActiveSessionId()).toBeNull();
  });

  it("does not clear active session if IDs don't match", async () => {
    await startTranscode("12345");
    await stopTranscode("other-session");
    expect(getActiveSessionId()).toBe("abc-123");
  });

  it("handles server errors gracefully", async () => {
    vi.mocked(flixor.plexServer.stopTranscode).mockRejectedValueOnce(new Error("network"));
    await startTranscode("12345");
    // Should not throw
    await stopTranscode("abc-123");
    expect(getActiveSessionId()).toBeNull();
  });
});

describe("updateTranscode", () => {
  it("stops old session and starts a new one with updated settings", async () => {
    const first = await startTranscode("12345", { maxVideoBitrate: 4000 });

    const updated = await updateTranscode("12345", first.sessionId, {
      maxVideoBitrate: 12000,
      subtitleStreamID: "301",
    });

    // Should have stopped the old session
    expect(flixor.plexServer.stopTranscode).toHaveBeenCalledWith("abc-123");
    // Should have started a new one with the updated streams (decision first)
    expect(updated.sessionId).toBe("abc-123");
    expect(flixor.plexServer.makeTranscodeDecision).toHaveBeenLastCalledWith("12345", {
      audioStreamID: undefined,
      subtitleStreamID: "301",
      mediaIndex: 0,
      sessionId: expect.any(String),
      maxVideoBitrate: 12000,
      videoResolution: undefined,
    });
    expect(flixor.plexServer.getTranscodeUrl).toHaveBeenLastCalledWith("12345", {
      audioStreamID: undefined,
      subtitleStreamID: "301",
      mediaIndex: 0,
      sessionId: expect.any(String),
      maxVideoBitrate: 12000,
      videoResolution: undefined,
      directStream: undefined,
      offset: undefined,
    });
  });
});

describe("stopActiveSession", () => {
  it("stops the active session if one exists", async () => {
    await startTranscode("12345");
    await stopActiveSession();
    expect(flixor.plexServer.stopTranscode).toHaveBeenCalledWith("abc-123");
    expect(getActiveSessionId()).toBeNull();
  });

  it("does nothing if no active session", async () => {
    await stopActiveSession();
    // stopTranscode should not have been called (no active session)
    expect(flixor.plexServer.stopTranscode).not.toHaveBeenCalled();
  });
});

describe("visibility change cleanup", () => {
  it("stops active session when document becomes hidden", async () => {
    await startTranscode("12345");

    // Simulate document becoming hidden
    Object.defineProperty(document, "hidden", { value: true, writable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    // Give the async handler a tick to run
    await new Promise((r) => setTimeout(r, 10));

    expect(flixor.plexServer.stopTranscode).toHaveBeenCalledWith("abc-123");

    // Restore
    Object.defineProperty(document, "hidden", { value: false, writable: true });
  });

  it("does nothing when document becomes visible", async () => {
    await startTranscode("12345");
    vi.clearAllMocks();

    Object.defineProperty(document, "hidden", { value: false, writable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    await new Promise((r) => setTimeout(r, 10));

    expect(flixor.plexServer.stopTranscode).not.toHaveBeenCalled();
  });
});
