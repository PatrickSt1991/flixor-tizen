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
const mockGetPhotoTranscodeUrl = vi.fn().mockReturnValue("");

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

vi.mock("../../services/settings", () => ({
  loadSettings: () => ({
    preferredQuality: "original",
    preferredPlaybackSpeed: 1,
    statsHudEnabled: false,
  }),
  saveSettings: vi.fn(),
}));

vi.mock("../../services/streamDecision", () => ({
  decideStream: () => ({ strategy: "direct-play", maxBitrate: 0 }),
  getQualityOptions: () => [{ label: "Original", bitrate: 0 }],
  getAudioOptions: () => [],
  getSubtitleOptions: () => [],
  getBackendStreamUrl: vi.fn().mockResolvedValue(null),
  updateBackendProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/transcode", () => ({
  startTranscode: vi.fn(),
  stopActiveSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/streaming", () => ({
  isHlsStream: () => false,
  createHlsPlayer: vi.fn(),
  destroyHlsPlayer: vi.fn(),
  isDashStream: () => false,
  createDashPlayer: vi.fn(),
  destroyDashPlayer: vi.fn(),
}));

vi.mock("../../services/traktScrobbler", () => {
  class MockTraktScrobbler {
    start = vi.fn();
    pause = vi.fn();
    resume = vi.fn();
    stop = vi.fn().mockResolvedValue(undefined);
    isCurrentlyScrobbling = () => false;
    isPaused = () => false;
    static convertPlexToTraktMedia = vi.fn().mockReturnValue(null);
  }
  return { TraktScrobbler: MockTraktScrobbler };
});

// Stub child components
vi.mock("../../components/StatsHUD", () => ({ StatsHUD: () => <div data-testid="stats-hud" /> }));
vi.mock("../../components/TrackPicker", () => ({ TrackPicker: ({ title }: any) => <div data-testid={`track-picker-${title}`} /> }));
vi.mock("../../components/VersionPickerModal", () => ({ VersionPickerModal: () => <div data-testid="version-picker" /> }));
vi.mock("../../components/NextEpisodeCountdown", () => ({ NextEpisodeCountdown: () => <div data-testid="next-ep-countdown" /> }));
vi.mock("../../components/SeekSlider", () => ({ SeekSlider: () => <div data-testid="seek-slider" /> }));

describe("PlayerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = { ratingKey: "100" };
  });

  it("shows initializing message when no video url yet", () => {
    mockGetMetadata.mockReturnValue(new Promise(() => {}));
    render(<PlayerPage />);
    expect(screen.getByText("Initializing player...")).toBeInTheDocument();
  });

  it("renders video element after loading a movie", async () => {
    mockGetMetadata.mockResolvedValue({
      ratingKey: "100",
      title: "Test Movie",
      type: "movie",
      Media: [{ container: "mkv", videoCodec: "h264", width: 1920, height: 1080, bitrate: 8000, Part: [{ key: "/video/100", Stream: [] }] }],
    });
    await act(async () => {
      render(<PlayerPage />);
    });
    const video = document.querySelector("video");
    expect(video).toBeTruthy();
  });

  it("shows controls overlay on mouse move", async () => {
    mockGetMetadata.mockResolvedValue({
      ratingKey: "100",
      title: "Overlay Movie",
      type: "movie",
      Media: [{ container: "mkv", videoCodec: "h264", width: 1920, height: 1080, bitrate: 8000, Part: [{ key: "/video/100", Stream: [] }] }],
    });
    await act(async () => {
      render(<PlayerPage />);
    });
    const container = document.querySelector(".player-container");
    expect(container).toBeTruthy();
    await act(async () => {
      fireEvent.mouseMove(container!);
    });
    expect(screen.getByText("Overlay Movie")).toBeInTheDocument();
  });

  it("renders exit button in controls overlay", async () => {
    mockGetMetadata.mockResolvedValue({
      ratingKey: "100",
      title: "Exit Movie",
      type: "movie",
      Media: [{ container: "mkv", videoCodec: "h264", width: 1920, height: 1080, bitrate: 8000, Part: [{ key: "/video/100", Stream: [] }] }],
    });
    await act(async () => {
      render(<PlayerPage />);
    });
    fireEvent.mouseMove(document.querySelector(".player-container")!);
    const exitBtn = screen.getByText("×");
    expect(exitBtn).toBeInTheDocument();
    fireEvent.click(exitBtn);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("shows episode metadata for TV episodes", async () => {
    mockGetMetadata.mockResolvedValue({
      ratingKey: "200",
      title: "Pilot",
      type: "episode",
      parentIndex: 1,
      index: 1,
      grandparentTitle: "Breaking Bad",
      parentRatingKey: "parent-1",
      Media: [{ container: "mkv", videoCodec: "h264", width: 1920, height: 1080, bitrate: 8000, Part: [{ key: "/video/200", Stream: [] }] }],
    });
    mockGetChildren.mockResolvedValue([
      { ratingKey: "200", title: "Pilot" },
      { ratingKey: "201", title: "Cat's in the Bag" },
    ]);
    await act(async () => {
      render(<PlayerPage />);
    });
    fireEvent.mouseMove(document.querySelector(".player-container")!);
    expect(screen.getByText("Pilot")).toBeInTheDocument();
    expect(screen.getByText(/S1:E1/)).toBeInTheDocument();
  });

  it("shows quality options in controls", async () => {
    mockGetMetadata.mockResolvedValue({
      ratingKey: "100",
      title: "Quality Movie",
      type: "movie",
      Media: [{ container: "mkv", videoCodec: "h264", width: 1920, height: 1080, bitrate: 8000, Part: [{ key: "/video/100", Stream: [] }] }],
    });
    await act(async () => {
      render(<PlayerPage />);
    });
    fireEvent.mouseMove(document.querySelector(".player-container")!);
    expect(screen.getByText("Quality")).toBeInTheDocument();
    expect(screen.getByText("Original")).toBeInTheDocument();
  });

  it("renders seek slider in controls", async () => {
    mockGetMetadata.mockResolvedValue({
      ratingKey: "100",
      title: "Seek Movie",
      type: "movie",
      Media: [{ container: "mkv", videoCodec: "h264", width: 1920, height: 1080, bitrate: 8000, Part: [{ key: "/video/100", Stream: [] }] }],
    });
    await act(async () => {
      render(<PlayerPage />);
    });
    fireEvent.mouseMove(document.querySelector(".player-container")!);
    expect(screen.getByTestId("seek-slider")).toBeInTheDocument();
  });

  it("shows speed button in controls", async () => {
    mockGetMetadata.mockResolvedValue({
      ratingKey: "100",
      title: "Speed Movie",
      type: "movie",
      Media: [{ container: "mkv", videoCodec: "h264", width: 1920, height: 1080, bitrate: 8000, Part: [{ key: "/video/100", Stream: [] }] }],
    });
    await act(async () => {
      render(<PlayerPage />);
    });
    fireEvent.mouseMove(document.querySelector(".player-container")!);
    expect(screen.getByText("Speed: 1x")).toBeInTheDocument();
  });
});
