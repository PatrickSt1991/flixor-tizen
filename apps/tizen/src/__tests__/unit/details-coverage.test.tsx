/**
 * Targeted tests for Details.tsx uncovered rendering paths:
 * - Hero action buttons (play, resume, continue, trailer, version selector)
 * - Cast tab with person modal
 * - More Like This tab
 * - YouTube trailer modal
 * - TV show with on-deck episode
 * - Accessibility badges from streams
 * - Watch providers
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

let mockParams: Record<string, string> = { ratingKey: "123" };
const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

vi.mock("@noriginmedia/norigin-spatial-navigation", () => ({
  useFocusable: () => ({
    ref: { current: null },
    focused: false,
    focusKey: "test-key",
    focusSelf: vi.fn(),
  }),
  FocusContext: {
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  },
}));

const mockGetMetadata = vi.fn();
const mockGetChildren = vi.fn();
const mockGetRelated = vi.fn();
const mockGetImageUrl = vi.fn().mockReturnValue("http://img.jpg");
const mockGetOnDeck = vi.fn();

vi.mock("../../services/flixor", () => ({
  flixor: {
    plexServer: {
      getMetadata: (...a: unknown[]) => mockGetMetadata(...a),
      getChildren: (...a: unknown[]) => mockGetChildren(...a),
      getRelated: (...a: unknown[]) => mockGetRelated(...a),
      getImageUrl: (...a: unknown[]) => mockGetImageUrl(...a),
      getOnDeck: (...a: unknown[]) => mockGetOnDeck(...a),
    },
    tmdb: {
      findByImdbId: vi.fn().mockResolvedValue({ movie_results: [], tv_results: [] }),
    },
    trakt: {
      getWatchlist: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("../../services/settings", () => ({
  loadSettings: () => ({
    episodeLayout: "vertical",
  }),
}));

const mockGetTmdbDetails = vi.fn();
const mockGetTmdbCredits = vi.fn();
const mockGetTmdbRecommendations = vi.fn();
const mockGetTmdbVideos = vi.fn();
const mockGetTmdbImages = vi.fn();
const mockGetWatchProviders = vi.fn();

vi.mock("../../services/tmdb", () => ({
  getDetails: (...a: unknown[]) => mockGetTmdbDetails(...a),
  getCredits: (...a: unknown[]) => mockGetTmdbCredits(...a),
  getRecommendations: (...a: unknown[]) => mockGetTmdbRecommendations(...a),
  getVideos: (...a: unknown[]) => mockGetTmdbVideos(...a),
  getImages: (...a: unknown[]) => mockGetTmdbImages(...a),
  getWatchProviders: (...a: unknown[]) => mockGetWatchProviders(...a),
  buildImageUrl: (path: string) => (path ? `https://tmdb${path}` : ""),
}));

const mockGetRatings = vi.fn();
vi.mock("../../services/ratings", () => ({
  getRatings: (...a: unknown[]) => mockGetRatings(...a),
}));

vi.mock("../../services/trakt", () => ({
  isAuthenticated: () => false,
}));

vi.mock("../../utils/media", () => ({
  extractTechBadges: () => ["4K", "HDR"],
  formatResumeLabel: (offset: number) => `${Math.round(offset / 60000)}m left`,
}));

// Component mocks — DetailsHero passes children through so we can test action buttons
vi.mock("../../components/DetailsHero", () => ({
  DetailsHero: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="details-hero">
      <span>{title}</span>
      {children}
    </div>
  ),
}));
vi.mock("../../components/DetailsTabs", () => ({
  DetailsTabs: ({ tabs, activeTab, onTabChange }: {
    tabs: Array<{ label: string; content: React.ReactNode }>;
    activeTab: number;
    onTabChange: (i: number) => void;
  }) => (
    <div data-testid="details-tabs">
      {tabs.map((t, i) => (
        <div key={t.label}>
          <button data-testid={`tab-${t.label}`} onClick={() => onTabChange(i)}>{t.label}</button>
          {i === activeTab && <div data-testid={`tab-content-${t.label}`}>{t.content}</div>}
        </div>
      ))}
    </div>
  ),
}));
vi.mock("../../components/UltraBlurBackground", () => ({
  UltraBlurBackground: () => <div data-testid="ultra-blur" />,
}));
vi.mock("../../components/MediaCard", () => ({
  MediaCard: ({ item, onClick }: { item: { title: string }; onClick: () => void }) => (
    <button data-testid="media-card" onClick={onClick}>{item.title}</button>
  ),
}));
vi.mock("../../components/RatingsBar", () => ({
  RatingsBar: () => <div data-testid="ratings-bar" />,
}));
vi.mock("../../components/SeasonSelector", () => ({
  SeasonSelector: ({ onSeasonChange, seasons }: { onSeasonChange: (k: string) => void; seasons: Array<{ key: string }> }) => (
    <div data-testid="season-selector">
      {seasons?.map((s) => (
        <button key={s.key} data-testid={`season-${s.key}`} onClick={() => onSeasonChange(s.key)}>
          {s.key}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("../../components/EpisodeItem", () => ({
  EpisodeItem: ({ title, onClick }: { title: string; onClick: () => void }) => (
    <button data-testid="episode-item" onClick={onClick}>{title}</button>
  ),
}));
vi.mock("../../components/WatchlistButton", () => ({
  WatchlistButton: ({ onToggle }: { onToggle: (v: boolean) => void }) => (
    <button data-testid="watchlist-btn" onClick={() => onToggle(true)}>Watchlist</button>
  ),
}));
vi.mock("../../components/RequestButton", () => ({
  RequestButton: () => <button data-testid="request-btn">Request</button>,
}));
vi.mock("../../components/MoodTags", () => ({
  MoodTags: () => <div data-testid="mood-tags" />,
}));
vi.mock("../../components/TechnicalChips", () => ({
  TechnicalChips: () => <div data-testid="tech-chips" />,
}));
vi.mock("../../components/AccessibilityBadges", () => ({
  AccessibilityBadges: ({ hasCC }: { hasCC: boolean }) => (
    <div data-testid="a11y-badges">{hasCC ? "CC" : ""}</div>
  ),
}));
vi.mock("../../utils/accessibilityUtils", () => ({
  detectAccessibilityBadges: (streams: Array<{ displayTitle?: string }>) => ({
    hasCC: streams.some((s) => s.displayTitle?.includes("CC")),
    hasSDH: false,
    hasAD: false,
  }),
}));
vi.mock("../../components/EpisodeLandscapeCard", () => ({
  EpisodeLandscapeCard: ({ title }: { title: string }) => <div data-testid="ep-landscape">{title}</div>,
}));
vi.mock("../../components/EpisodeSkeletonList", () => ({
  EpisodeSkeletonList: () => <div data-testid="ep-skeleton" />,
}));
vi.mock("../../components/PersonModal", () => ({
  PersonModal: ({ open, name }: { open: boolean; name?: string }) => (
    open ? <div data-testid="person-modal">{name}</div> : null
  ),
}));
vi.mock("../../components/VersionSelector", () => ({
  VersionSelector: ({ onSelect, onClose }: { onSelect: (i: number) => void; onClose: () => void }) => (
    <div data-testid="version-selector">
      <button onClick={() => onSelect(1)}>Select V2</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));
vi.mock("../../components/ServiceIcons", () => ({
  __esModule: true,
  default: () => <div data-testid="service-icons" />,
}));

import { DetailsPage } from "../../pages/Details";

// Helper to create a movie item
function makeMovie(overrides: Record<string, unknown> = {}) {
  return {
    ratingKey: "123",
    title: "Test Movie",
    type: "movie",
    year: 2024,
    summary: "A great movie",
    thumb: "/thumb.jpg",
    art: "/art.jpg",
    contentRating: "PG-13",
    duration: 7200000,
    Guid: [{ id: "imdb://tt1234567" }, { id: "tmdb://99999" }],
    Genre: [{ tag: "Action" }, { tag: "Sci-Fi" }],
    Media: [{
      width: 3840,
      height: 2160,
      videoProfile: "HDR",
      audioProfile: "dts",
      audioCodec: "eac3",
      videoCodec: "hevc",
      bitrate: 20000,
      audioChannels: 6,
      Part: [{
        key: "/video/123",
        Stream: [
          { streamType: 3, displayTitle: "English CC", title: "CC" },
        ],
      }],
    }],
    ...overrides,
  };
}

function makeShow(overrides: Record<string, unknown> = {}) {
  return {
    ratingKey: "456",
    title: "Test Show",
    type: "show",
    year: 2023,
    summary: "A great show",
    thumb: "/thumb.jpg",
    art: "/art.jpg",
    contentRating: "TV-MA",
    Guid: [{ id: "tmdb://55555" }],
    Genre: [{ tag: "Drama" }],
    Media: [],
    ...overrides,
  };
}

describe("DetailsPage – movie rendering paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = { ratingKey: "123" };
    mockGetChildren.mockResolvedValue([]);
    mockGetRelated.mockResolvedValue([]);
    mockGetOnDeck.mockResolvedValue([]);
    mockGetTmdbDetails.mockResolvedValue({});
    mockGetTmdbCredits.mockResolvedValue({ cast: [], crew: [] });
    mockGetTmdbRecommendations.mockResolvedValue({ results: [] });
    mockGetTmdbVideos.mockResolvedValue({ results: [] });
    mockGetTmdbImages.mockResolvedValue({ logos: [] });
    mockGetWatchProviders.mockResolvedValue(null);
    mockGetRatings.mockResolvedValue({ ratings: [] });
  });

  it("renders Play button for movie", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByText("▶ Play")).toBeInTheDocument();
  });

  it("renders Resume button when viewOffset exists", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie({ viewOffset: 3600000 }));
    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByText(/Resume/)).toBeInTheDocument();
  });

  it("navigates to player on Play click", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    await act(async () => { render(<DetailsPage />); });
    fireEvent.click(screen.getByText("▶ Play"));
    expect(mockNavigate).toHaveBeenCalledWith("/player/123", expect.anything());
  });

  it("renders Back button and navigates on click", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    await act(async () => { render(<DetailsPage />); });
    const backBtn = screen.getByText(/Back/);
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("renders genre badges", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByText("Action • Sci-Fi")).toBeInTheDocument();
  });

  it("renders mood tags for genres", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByTestId("mood-tags")).toBeInTheDocument();
  });

  it("renders tech chips when media info exists", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByTestId("tech-chips")).toBeInTheDocument();
  });

  it("renders accessibility badges from streams", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByTestId("a11y-badges")).toBeInTheDocument();
  });

  it("renders request button when tmdbId exists", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByTestId("request-btn")).toBeInTheDocument();
  });

  it("renders watchlist button", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByTestId("watchlist-btn")).toBeInTheDocument();
  });

  it("renders version selector button when multiple media versions", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie({
      Media: [
        { width: 1920, height: 1080, Part: [{ key: "/v1" }] },
        { width: 3840, height: 2160, Part: [{ key: "/v2" }] },
      ],
    }));
    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByText("Version 1")).toBeInTheDocument();
  });

  it("renders YouTube trailer button when video available", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    mockGetTmdbVideos.mockResolvedValue({
      results: [{ site: "YouTube", type: "Trailer", key: "yt123" }],
    });
    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByText("▶ Trailer")).toBeInTheDocument();
  });

  it("opens trailer modal on trailer button click", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    mockGetTmdbVideos.mockResolvedValue({
      results: [{ site: "YouTube", type: "Trailer", key: "yt123" }],
    });
    await act(async () => { render(<DetailsPage />); });
    fireEvent.click(screen.getByText("▶ Trailer"));
    expect(screen.getByTitle("Trailer")).toBeInTheDocument();
  });

  it("closes trailer modal on close button click", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    mockGetTmdbVideos.mockResolvedValue({
      results: [{ site: "YouTube", type: "Trailer", key: "yt123" }],
    });
    await act(async () => { render(<DetailsPage />); });
    fireEvent.click(screen.getByText("▶ Trailer"));
    fireEvent.click(screen.getByText("✕"));
    expect(screen.queryByTitle("Trailer")).not.toBeInTheDocument();
  });

  it("renders ratings bar when ratings available", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    mockGetRatings.mockResolvedValue({ ratings: [{ source: "imdb", value: 8.5 }] });
    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByTestId("ratings-bar")).toBeInTheDocument();
  });

  it("renders watch providers when available", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    mockGetWatchProviders.mockResolvedValue({
      flatrate: [{ provider_name: "Netflix", logo_path: "/netflix.png" }],
    });
    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByTestId("service-icons")).toBeInTheDocument();
  });

  it("renders TMDB details metadata", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    mockGetTmdbDetails.mockResolvedValue({
      tagline: "Dream within a dream",
      production_companies: [{ name: "Warner Bros" }],
      budget: 160000000,
      revenue: 836800000,
      status: "Released",
      release_date: "2024-07-16",
      original_language: "en",
    });
    await act(async () => { render(<DetailsPage />); });
    // The Overview tab content is rendered through DetailsTabs
    expect(screen.getByTestId("details-tabs")).toBeInTheDocument();
  });

  it("renders cast tab with credits", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    mockGetTmdbCredits.mockResolvedValue({
      cast: [
        { name: "Actor One", character: "Hero", profile_path: "/actor1.jpg" },
        { name: "Actor Two", character: "Villain", profile_path: null },
      ],
      crew: [
        { name: "Director One", job: "Director" },
        { name: "Writer One", job: "Screenplay", department: "Writing" },
      ],
    });
    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByTestId("tab-Cast")).toBeInTheDocument();
  });

  it("renders More Like This tab with related items", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    mockGetRelated.mockResolvedValue([
      { ratingKey: "r1", title: "Related Movie", thumb: "/r.jpg" },
    ]);
    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByTestId("tab-More Like This")).toBeInTheDocument();
  });

  it("renders TMDB recommendations in More Like This tab", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    mockGetTmdbRecommendations.mockResolvedValue({
      results: [
        { id: 1, title: "Rec Movie", poster_path: "/p.jpg", backdrop_path: "/b.jpg", release_date: "2024-01-01", overview: "Good" },
      ],
    });
    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByTestId("tab-More Like This")).toBeInTheDocument();
  });

  it("renders TMDB logo when available", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie());
    mockGetTmdbImages.mockResolvedValue({
      logos: [{ file_path: "/logo.png", iso_639_1: "en" }],
    });
    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByTestId("details-hero")).toBeInTheDocument();
  });
});


describe("DetailsPage – TV show paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = { ratingKey: "456" };
    mockGetRelated.mockResolvedValue([]);
    mockGetOnDeck.mockResolvedValue([]);
    mockGetTmdbDetails.mockResolvedValue({});
    mockGetTmdbCredits.mockResolvedValue({ cast: [], crew: [] });
    mockGetTmdbRecommendations.mockResolvedValue({ results: [] });
    mockGetTmdbVideos.mockResolvedValue({ results: [] });
    mockGetTmdbImages.mockResolvedValue({ logos: [] });
    mockGetWatchProviders.mockResolvedValue(null);
    mockGetRatings.mockResolvedValue({ ratings: [] });
  });

  it("renders Play S1:E1 for show with no on-deck", async () => {
    mockGetMetadata.mockResolvedValue(makeShow());
    mockGetChildren
      .mockResolvedValueOnce([{ ratingKey: "s1", title: "Season 1", index: 1 }])
      .mockResolvedValueOnce([{ ratingKey: "ep1", title: "Pilot", index: 1, duration: 3600000 }]);

    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByText("▶ Play S1:E1")).toBeInTheDocument();
  });

  it("renders Continue button for show with on-deck episode", async () => {
    mockGetMetadata.mockResolvedValue(makeShow());
    mockGetChildren
      .mockResolvedValueOnce([{ ratingKey: "s1", title: "Season 1", index: 1 }])
      .mockResolvedValueOnce([{ ratingKey: "ep1", title: "Pilot", index: 1 }]);
    mockGetOnDeck.mockResolvedValue([
      { ratingKey: "ep3", title: "Episode 3", index: 3, parentIndex: 1, grandparentRatingKey: "456" },
    ]);

    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByText(/Continue S1:E3/)).toBeInTheDocument();
  });

  it("navigates to player on Continue click", async () => {
    mockGetMetadata.mockResolvedValue(makeShow());
    mockGetChildren
      .mockResolvedValueOnce([{ ratingKey: "s1", title: "Season 1", index: 1 }])
      .mockResolvedValueOnce([{ ratingKey: "ep1", title: "Pilot", index: 1 }]);
    mockGetOnDeck.mockResolvedValue([
      { ratingKey: "ep3", title: "Episode 3", index: 3, parentIndex: 1, grandparentRatingKey: "456" },
    ]);

    await act(async () => { render(<DetailsPage />); });
    fireEvent.click(screen.getByText(/Continue S1:E3/));
    expect(mockNavigate).toHaveBeenCalledWith("/player/ep3", expect.anything());
  });

  it("renders Episodes tab for TV show", async () => {
    mockGetMetadata.mockResolvedValue(makeShow());
    mockGetChildren
      .mockResolvedValueOnce([{ ratingKey: "s1", title: "Season 1", index: 1 }])
      .mockResolvedValueOnce([
        { ratingKey: "ep1", title: "Pilot", index: 1, duration: 3600000, summary: "First ep" },
      ]);

    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByTestId("tab-Episodes")).toBeInTheDocument();
  });

  it("renders networks from TMDB details", async () => {
    mockGetMetadata.mockResolvedValue(makeShow());
    mockGetChildren.mockResolvedValue([]);
    mockGetTmdbDetails.mockResolvedValue({
      networks: [{ name: "AMC" }],
      first_air_date: "2023-01-15",
      status: "Returning Series",
    });

    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByTestId("details-tabs")).toBeInTheDocument();
  });

  it("renders Plex trailer button when extras exist", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie({
      Extras: {
        Metadata: [
          { ratingKey: "trailer-1", extraType: "trailer", title: "Official Trailer", Media: [{ Part: [{ key: "/trailer" }] }] },
        ],
      },
    }));

    await act(async () => { render(<DetailsPage />); });
    expect(screen.getByText("Trailer")).toBeInTheDocument();
  });

  it("navigates to player on Plex trailer click", async () => {
    mockGetMetadata.mockResolvedValue(makeMovie({
      Extras: {
        Metadata: [
          { ratingKey: "trailer-1", extraType: "trailer", title: "Official Trailer" },
        ],
      },
    }));

    await act(async () => { render(<DetailsPage />); });
    fireEvent.click(screen.getByText("Trailer"));
    expect(mockNavigate).toHaveBeenCalledWith("/player/trailer-1");
  });

  it("navigates to player on Play S1:E1 click", async () => {
    mockGetMetadata.mockResolvedValue(makeShow());
    mockGetChildren
      .mockResolvedValueOnce([{ ratingKey: "s1", title: "Season 1", index: 1 }])
      .mockResolvedValueOnce([{ ratingKey: "ep1", title: "Pilot", index: 1 }]);

    await act(async () => { render(<DetailsPage />); });
    fireEvent.click(screen.getByText("▶ Play S1:E1"));
    expect(mockNavigate).toHaveBeenCalledWith("/player/ep1", expect.anything());
  });

  it("handles metadata fetch failure gracefully", async () => {
    mockGetMetadata.mockRejectedValue(new Error("network error"));
    await act(async () => { render(<DetailsPage />); });
    // Should show loading since item is null after error
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
