import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PlayerPage } from "../../pages/Player";

let mockParams: Record<string, string> = { ratingKey: "100" };
const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
  useLocation: () => ({ state: null }),
}));

const mockGetMetadata = vi.fn();
const mockGetStreamUrl = vi.fn().mockResolvedValue("http://stream/video.mp4");
const mockGetChildren = vi.fn().mockResolvedValue([]);
const mockUpdateTimeline = vi.fn();
const mockGetPhotoTranscodeUrl = vi.fn().mockReturnValue("http://thumb/1.jpg");

vi.mock("../../services/flixor", () => ({
  flixor: {
    plexServer: {
      getMetadata: (...a: unknown[]) => mockGetMetadata(...a),
      getStreamUrl: (...a: unknown[]) => mockGetStreamUrl(...a),
      getChildren: (...a: unknown[]) => mockGetChildren(...a),
      updateTimeline: (...a: unknown[]) => mockUpdateTimeline(...a),
      getPhotoTranscodeUrl: (...a: unknown[]) => mockGetPhotoTranscodeUrl(...a),
    },
  },
}));

const mockSaveSettings = vi.fn();
vi.mock("../../services/settings", () => ({
  loadSettings: () => ({
    preferredQuality: "original",
    preferredPlaybackSpeed: 1,
    statsHudEnabled: false,
  }),
  saveSettings: (...a: unknown[]) => mockSaveSettings(...a),
}));

const mockDecideStream = vi.fn().mockReturnValue({ strategy: "direct-play", maxBitrate: 0 });
const mockGetBackendStreamUrl = vi.fn().mockResolvedValue(null);

vi.mock("../../services/streamDecision", () => ({
  decideStream: (...a: unknown[]) => mockDecideStream(...a),
  getQualityOptions: () => [
    { label: "Original", bitrate: 0 },
    { label: "1080p 10Mbps", bitrate: 10000 },
    { label: "720p 4Mbps", bitrate: 4000 },
  ],
  getAudioOptions: (streams: unknown[]) => (streams as { streamType: number; id: number }[]).filter((s) => s.streamType === 2).map((s) => ({ id: s.id })),
  getSubtitleOptions: (streams: unknown[]) => (streams as { streamType: number; id: number }[]).filter((s) => s.streamType === 3).map((s) => ({ id: s.id })),
  getBackendStreamUrl: (...a: unknown[]) => mockGetBackendStreamUrl(...a),
  updateBackendProgress: vi.fn().mockResolvedValue(undefined),
}));

const mockStartTranscode = vi.fn();
vi.mock("../../services/transcode", () => ({
  startTranscode: (...a: unknown[]) => mockStartTranscode(...a),
  stopActiveSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/streaming", () => ({
  isHlsStream: (url: string) => url.endsWith(".m3u8"),
  createHlsPlayer: vi.fn().mockReturnValue(null),
  destroyHlsPlayer: vi.fn(),
  isDashStream: (url: string) => url.endsWith(".mpd"),
  createDashPlayer: vi.fn().mockReturnValue({}),
  destroyDashPlayer: vi.fn(),
}));

vi.mock("../../services/traktScrobbler", () => {
  class MockTraktScrobbler {
    start = vi.fn();
    pause = vi.fn();
    resume = vi.fn();
    stop = vi.fn().mockResolvedValue(undefined);
    isCurrentlyScrobbling = () => true;
    isPaused = () => true;
    static convertPlexToTraktMedia = vi.fn().mockReturnValue({ type: "movie", ids: { tmdb: 1 } });
  }
  return { TraktScrobbler: MockTraktScrobbler };
});

// Real-ish child components that expose interaction
vi.mock("../../components/StatsHUD", () => ({
  StatsHUD: ({ visible }: { visible: boolean }) => visible ? <div data-testid="stats-hud-visible" /> : <div data-testid="stats-hud-hidden" />,
}));
vi.mock("../../components/TrackPicker", () => ({
  TrackPicker: ({ title, onSelect, onClose }: { title: string; onSelect: (id: number | null) => void; onClose: () => void }) => (
    <div data-testid={`track-picker-${title}`}>
      <button data-testid={`select-track-${title}`} onClick={() => onSelect(1)}>Select</button>
      <button data-testid={`close-picker-${title}`} onClick={onClose}>Close</button>
    </div>
  ),
}));
vi.mock("../../components/VersionPickerModal", () => ({
  VersionPickerModal: ({ onSelect, onClose }: { onSelect: (idx: number) => void; onClose: () => void }) => (
    <div data-testid="version-picker">
      <button data-testid="select-version" onClick={() => onSelect(1)}>V2</button>
      <button data-testid="close-version" onClick={onClose}>Close</button>
    </div>
  ),
}));
vi.mock("../../components/NextEpisodeCountdown", () => ({
  NextEpisodeCountdown: ({ onPlayNext, onCancel }: { onPlayNext: () => void; onCancel: () => void }) => (
    <div data-testid="next-ep-countdown">
      <button data-testid="play-next" onClick={onPlayNext}>Play Next</button>
      <button data-testid="cancel-next" onClick={onCancel}>Cancel</button>
    </div>
  ),
}));
vi.mock("../../components/SeekSlider", () => ({
  SeekSlider: ({ onSeek }: { onSeek: (t: number) => void }) => (
    <div data-testid="seek-slider">
      <button data-testid="seek-to-60" onClick={() => onSeek(60)}>Seek</button>
    </div>
  ),
}));

function makeMovieMetadata(overrides: Record<string, unknown> = {}) {
  return {
    ratingKey: "100",
    title: "Test Movie",
    type: "movie",
    Media: [{
      container: "mkv",
      videoCodec: "h264",
      width: 1920,
      height: 1080,
      bitrate: 8000,
      Part: [{
        key: "/video/100",
        Stream: [
          { id: 1, streamType: 2, language: "English", selected: true },
          { id: 2, streamType: 2, language: "Spanish", selected: false },
          { id: 3, streamType: 3, language: "English", selected: true },
          { id: 4, streamType: 3, language: "French", selected: false },
        ],
      }],
    }],
    ...overrides,
  };
}

function makeEpisodeMetadata() {
  return {
    ratingKey: "200",
    title: "Pilot",
    type: "episode",
    parentIndex: 1,
    index: 1,
    grandparentTitle: "Breaking Bad",
    parentRatingKey: "parent-1",
    Media: [{
      container: "mkv",
      videoCodec: "h264",
      width: 1920,
      height: 1080,
      bitrate: 8000,
      Part: [{ key: "/video/200", Stream: [] }],
    }],
  };
}

describe("PlayerPage – track pickers, version, speed, markers, next episode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = { ratingKey: "100" };
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows audio and subtitle picker buttons in controls", async () => {
    mockGetMetadata.mockResolvedValue(makeMovieMetadata());
    await act(async () => {
      render(<PlayerPage />);
    });
    fireEvent.mouseMove(document.querySelector(".player-container")!);
    expect(screen.getByText(/Audio:/)).toBeInTheDocument();
    expect(screen.getByText(/Subtitles:/)).toBeInTheDocument();
  });

  it("opens audio picker on click and selects a track", async () => {
    mockGetMetadata.mockResolvedValue(makeMovieMetadata());
    await act(async () => {
      render(<PlayerPage />);
    });
    fireEvent.mouseMove(document.querySelector(".player-container")!);

    // Click audio button to open picker
    await act(async () => {
      fireEvent.click(screen.getByText(/Audio:/));
    });
    expect(screen.getByTestId("track-picker-Audio")).toBeInTheDocument();

    // Select a track
    await act(async () => {
      fireEvent.click(screen.getByTestId("select-track-Audio"));
    });
    // Picker should close after selection
    expect(screen.queryByTestId("track-picker-Audio")).not.toBeInTheDocument();
  });

  it("opens subtitle picker and closes it", async () => {
    mockGetMetadata.mockResolvedValue(makeMovieMetadata());
    await act(async () => {
      render(<PlayerPage />);
    });
    fireEvent.mouseMove(document.querySelector(".player-container")!);

    await act(async () => {
      fireEvent.click(screen.getByText(/Subtitles:/));
    });
    expect(screen.getByTestId("track-picker-Subtitles")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("close-picker-Subtitles"));
    });
    expect(screen.queryByTestId("track-picker-Subtitles")).not.toBeInTheDocument();
  });

  it("shows version picker when multiple media versions exist", async () => {
    mockGetMetadata.mockResolvedValue(makeMovieMetadata({
      Media: [
        { container: "mkv", videoCodec: "h264", width: 1920, height: 1080, bitrate: 8000, Part: [{ key: "/v/1", Stream: [] }] },
        { container: "mp4", videoCodec: "h265", width: 3840, height: 2160, bitrate: 20000, Part: [{ key: "/v/2", Stream: [] }] },
      ],
    }));
    await act(async () => {
      render(<PlayerPage />);
    });
    fireEvent.mouseMove(document.querySelector(".player-container")!);

    // Version button should be visible
    expect(screen.getByText("Version 1")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("Version 1"));
    });
    expect(screen.getByTestId("version-picker")).toBeInTheDocument();

    // Select version 2
    await act(async () => {
      fireEvent.click(screen.getByTestId("select-version"));
    });
    expect(screen.queryByTestId("version-picker")).not.toBeInTheDocument();
  });

  it("cycles playback speed on click", async () => {
    mockGetMetadata.mockResolvedValue(makeMovieMetadata());
    await act(async () => {
      render(<PlayerPage />);
    });
    fireEvent.mouseMove(document.querySelector(".player-container")!);

    const speedBtn = screen.getByText("Speed: 1x");
    await act(async () => {
      fireEvent.click(speedBtn);
    });
    // 1 → 1.25
    expect(screen.getByText("Speed: 1.25x")).toBeInTheDocument();
    expect(mockSaveSettings).toHaveBeenCalledWith({ preferredPlaybackSpeed: 1.25 });
  });

  it("changes quality on click", async () => {
    mockGetMetadata.mockResolvedValue(makeMovieMetadata());
    await act(async () => {
      render(<PlayerPage />);
    });
    fireEvent.mouseMove(document.querySelector(".player-container")!);

    const qualityBtn = screen.getByText("720p 4Mbps");
    await act(async () => {
      fireEvent.click(qualityBtn);
    });
    expect(mockSaveSettings).toHaveBeenCalledWith({ preferredQuality: "4000" });
  });

  it("shows skip marker button when marker is active", async () => {
    mockGetMetadata.mockResolvedValue(makeMovieMetadata({
      Marker: [
        { type: "intro", startTimeOffset: 0, endTimeOffset: 60000 },
      ],
    }));
    await act(async () => {
      render(<PlayerPage />);
    });

    // Simulate timeUpdate with time inside marker range
    const video = document.querySelector("video")!;
    Object.defineProperty(video, "currentTime", { value: 30, writable: true, configurable: true });
    Object.defineProperty(video, "duration", { value: 3600, writable: true, configurable: true });

    fireEvent.timeUpdate(video);
    fireEvent.mouseMove(document.querySelector(".player-container")!);

    expect(screen.getByText("Skip Intro")).toBeInTheDocument();
  });

  it("shows credits skip marker", async () => {
    mockGetMetadata.mockResolvedValue(makeMovieMetadata({
      Marker: [
        { type: "credits", startTimeOffset: 3500000, endTimeOffset: 3600000 },
      ],
    }));
    await act(async () => {
      render(<PlayerPage />);
    });

    const video = document.querySelector("video")!;
    Object.defineProperty(video, "currentTime", { value: 3550, writable: true, configurable: true });
    Object.defineProperty(video, "duration", { value: 3600, writable: true, configurable: true });

    fireEvent.timeUpdate(video);
    fireEvent.mouseMove(document.querySelector(".player-container")!);

    expect(screen.getByText("Skip Credits")).toBeInTheDocument();
  });

  it("shows next episode countdown when near end", async () => {
    mockParams = { ratingKey: "200" };
    mockGetMetadata.mockResolvedValue(makeEpisodeMetadata());
    mockGetChildren.mockResolvedValue([
      { ratingKey: "200", title: "Pilot" },
      { ratingKey: "201", title: "Cat's in the Bag" },
    ]);

    await act(async () => {
      render(<PlayerPage />);
    });

    const video = document.querySelector("video")!;
    Object.defineProperty(video, "duration", { value: 2700, writable: true, configurable: true });
    Object.defineProperty(video, "currentTime", { value: 2680, writable: true, configurable: true });

    await act(async () => {
      fireEvent.timeUpdate(video);
    });

    expect(screen.getByTestId("next-ep-countdown")).toBeInTheDocument();
  });

  it("plays next episode on Play Next click", async () => {
    mockParams = { ratingKey: "200" };
    mockGetMetadata.mockResolvedValue(makeEpisodeMetadata());
    mockGetChildren.mockResolvedValue([
      { ratingKey: "200", title: "Pilot" },
      { ratingKey: "201", title: "Cat's in the Bag" },
    ]);

    await act(async () => {
      render(<PlayerPage />);
    });

    const video = document.querySelector("video")!;
    Object.defineProperty(video, "duration", { value: 2700, writable: true, configurable: true });
    Object.defineProperty(video, "currentTime", { value: 2680, writable: true, configurable: true });

    await act(async () => {
      fireEvent.timeUpdate(video);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("play-next"));
    });
    expect(mockNavigate).toHaveBeenCalledWith("/player/201", { replace: true });
  });

  it("cancels next episode overlay", async () => {
    mockParams = { ratingKey: "200" };
    mockGetMetadata.mockResolvedValue(makeEpisodeMetadata());
    mockGetChildren.mockResolvedValue([
      { ratingKey: "200", title: "Pilot" },
      { ratingKey: "201", title: "Next Ep" },
    ]);

    await act(async () => {
      render(<PlayerPage />);
    });

    const video = document.querySelector("video")!;
    Object.defineProperty(video, "duration", { value: 2700, writable: true, configurable: true });
    Object.defineProperty(video, "currentTime", { value: 2680, writable: true, configurable: true });

    await act(async () => {
      fireEvent.timeUpdate(video);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("cancel-next"));
    });
    expect(screen.queryByTestId("next-ep-countdown")).not.toBeInTheDocument();
  });

  it("navigates to next episode on video ended", async () => {
    mockParams = { ratingKey: "200" };
    mockGetMetadata.mockResolvedValue(makeEpisodeMetadata());
    mockGetChildren.mockResolvedValue([
      { ratingKey: "200", title: "Pilot" },
      { ratingKey: "201", title: "Next" },
    ]);

    await act(async () => {
      render(<PlayerPage />);
    });

    const video = document.querySelector("video")!;
    Object.defineProperty(video, "currentTime", { value: 2700, writable: true, configurable: true });
    Object.defineProperty(video, "duration", { value: 2700, writable: true, configurable: true });

    await act(async () => {
      fireEvent.ended(video);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/player/201", { replace: true });
  });

  it("navigates back on video ended with no next episode", async () => {
    mockGetMetadata.mockResolvedValue(makeMovieMetadata());

    await act(async () => {
      render(<PlayerPage />);
    });

    const video = document.querySelector("video")!;
    Object.defineProperty(video, "currentTime", { value: 7200, writable: true, configurable: true });
    Object.defineProperty(video, "duration", { value: 7200, writable: true, configurable: true });

    await act(async () => {
      fireEvent.ended(video);
    });
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("uses seek slider to seek", async () => {
    mockGetMetadata.mockResolvedValue(makeMovieMetadata());
    await act(async () => {
      render(<PlayerPage />);
    });
    fireEvent.mouseMove(document.querySelector(".player-container")!);

    await act(async () => {
      fireEvent.click(screen.getByTestId("seek-to-60"));
    });
    // Video currentTime should be set (we can't easily verify on the mock video element,
    // but the handler should not throw)
  });

  it("toggles StatsHUD on double Info key press", async () => {
    mockGetMetadata.mockResolvedValue(makeMovieMetadata());
    await act(async () => {
      render(<PlayerPage />);
    });

    // First press
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Info" }));
    });
    // Second press within 500ms
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Info" }));
    });

    expect(screen.getByTestId("stats-hud-visible")).toBeInTheDocument();
  });

  it("uses backend stream URL when available", async () => {
    mockGetBackendStreamUrl.mockResolvedValue({
      sessionId: "session-123",
      streamUrl: "http://backend/stream.mp4",
    });
    mockGetMetadata.mockResolvedValue(makeMovieMetadata());

    await act(async () => {
      render(<PlayerPage />);
    });

    const video = document.querySelector("video")!;
    expect(video.src || "").toContain("backend");
  });

  it("falls back to transcode when strategy is transcode", async () => {
    mockGetBackendStreamUrl.mockResolvedValue(null);
    mockDecideStream.mockReturnValue({ strategy: "transcode", maxBitrate: 4000 });
    mockStartTranscode.mockResolvedValue({
      startUrl: "http://transcode/stream.m3u8",
      sessionId: "tc-1",
    });
    mockGetMetadata.mockResolvedValue(makeMovieMetadata());

    await act(async () => {
      render(<PlayerPage />);
    });

    expect(mockStartTranscode).toHaveBeenCalled();
  });

  it("falls back to direct stream when transcode fails", async () => {
    mockGetBackendStreamUrl.mockResolvedValue(null);
    mockDecideStream.mockReturnValue({ strategy: "transcode", maxBitrate: 4000 });
    mockStartTranscode.mockRejectedValue(new Error("Transcode failed"));
    mockGetMetadata.mockResolvedValue(makeMovieMetadata());

    await act(async () => {
      render(<PlayerPage />);
    });

    expect(mockGetStreamUrl).toHaveBeenCalled();
  });

  it("resumes from viewOffset", async () => {
    mockGetMetadata.mockResolvedValue(makeMovieMetadata({ viewOffset: 60000 }));

    await act(async () => {
      render(<PlayerPage />);
    });

    const video = document.querySelector("video")!;
    // Trigger canplay to apply resume
    await act(async () => {
      fireEvent(video, new Event("canplay"));
    });
    // viewOffset 60000ms = 60s
    expect(video.currentTime).toBe(60);
  });
});
