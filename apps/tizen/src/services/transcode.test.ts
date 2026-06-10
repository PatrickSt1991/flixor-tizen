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
      makeTranscodeDecision: vi.fn().mockResolvedValue(undefined),
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
  it("builds the start URL and starts the session (no decision call)", async () => {
    const result = await startTranscode("12345", {
      maxVideoBitrate: 8000,
      videoResolution: "1920x1080",
      audioStreamID: "201",
      mediaIndex: 0,
    });

    // The /decision endpoint 400s on this server and poisons the session, so we
    // skip it entirely and let start.m3u8 handle subtitle burning.
    expect(flixor.plexServer.makeTranscodeDecision).not.toHaveBeenCalled();
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
    expect(flixor.plexServer.startTranscodeSession).toHaveBeenCalledWith(
      "http://plex/transcode/start.m3u8",
    );
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
    // Should have started a new one with the updated streams on the start URL
    expect(updated.sessionId).toBe("abc-123");
    expect(flixor.plexServer.makeTranscodeDecision).not.toHaveBeenCalled();
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
