export interface TizenSettings {
  // Discovery mode
  discoveryDisabled?: boolean;

  // Onboarding
  onboardingCompleted?: boolean;
  /** Show "Who's Watching" (and PIN) on every launch instead of restoring
   *  the last profile from storage. */
  alwaysAskProfile?: boolean;

  // Home screen
  showHeroSection?: boolean;
  showTrendingRows?: boolean;
  showTraktRows?: boolean;
  showContinueWatchingRow?: boolean;
  showWatchlistRow?: boolean;
  showRecentlyAddedRows?: boolean;
  showCollectionsRow?: boolean;
  showGenreRows?: boolean;

  // Search
  includeTmdbInSearch?: boolean;

  // TMDB config
  tmdbEnabled?: boolean;

  // MDBList
  mdblistEnabled?: boolean;
  mdblistApiKey?: string;

  // Overseerr
  overseerrEnabled?: boolean;
  overseerrUrl?: string;
  overseerrApiKey?: string;

  // Player
  preferredQuality?: string;
  preferredResolution?: string;
  preferredPlaybackSpeed?: number;

  // Backend proxy
  backendUrl?: string;

  // Playback preferences
  episodeLayout?: "horizontal" | "vertical";
  autoPlayNext?: boolean;
  streamsBackdrop?: boolean;

  // Playback stats HUD
  statsHudEnabled?: boolean;

  // Library-only mode
  libraryOnlyMode?: boolean;

  // Trakt token storage
  traktAccessToken?: string;
  traktRefreshToken?: string;
  traktExpiresAt?: number;

  // Plex TV token
  plexTvToken?: string;

  // Hero layout
  heroLayout?: "carousel" | "static" | "hidden";

  // Appearance
  theme?: string;
  cardStyle?: string;

  // Subtitle display
  subtitleSize?: string;
  subtitleColor?: string;
  subtitleBackground?: string;

  // Trakt scrobbling
  traktScrobblingEnabled?: boolean;

  // Per-source ratings visibility
  showImdb?: boolean;
  showRt?: boolean;
  showLetterboxd?: boolean;
  showMetacritic?: boolean;
  showTmdbRating?: boolean;
  showTraktRating?: boolean;

  // Catalog settings
  catalogDisabledLibraries?: string[];

  // Continue Watching settings
  continueWatchingCardStyle?: "landscape" | "poster";
  continueWatchingCachedStreams?: boolean;
  continueWatchingCacheDuration?: number; // minutes: 15, 30, 60, 360, 720, 1440

  // Details screen settings
  detailsPageLayout?: "tabbed" | "unified";
  showRtCritics?: boolean;
  showRtAudience?: boolean;

  // Performance
  performanceModeEnabled?: boolean;

  // TMDB settings
  tmdbBearerToken?: string;
}

export const DEFAULT_SETTINGS: TizenSettings = {
  onboardingCompleted: false,
  alwaysAskProfile: false,
  showHeroSection: true,
  showRecentlyAddedRows: true,
  showCollectionsRow: true,
  showGenreRows: true,
  tmdbEnabled: true,
  statsHudEnabled: false,
  libraryOnlyMode: false,
  showTrendingRows: true,
  showTraktRows: true,
  showContinueWatchingRow: true,
  showWatchlistRow: true,
  includeTmdbInSearch: true,
  autoPlayNext: true,
  heroLayout: "carousel",
  theme: "dark",
  cardStyle: "default",
  subtitleSize: "medium",
  subtitleColor: "#FFFFFF",
  subtitleBackground: "transparent",
  showImdb: true,
  showRt: true,
  showLetterboxd: true,
  showMetacritic: true,
  showTmdbRating: true,
  showTraktRating: true,
};

const KEY = "flixor.tizen.settings";

export function loadSettings(): TizenSettings {
  try {
    const s = localStorage.getItem(KEY);
    const stored: TizenSettings = s ? JSON.parse(s) : {};
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(patch: Partial<TizenSettings>): TizenSettings {
  const curr = loadSettings();
  const next = { ...curr, ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function setDiscoveryDisabled(disabled: boolean): TizenSettings {
  if (disabled) {
    return saveSettings({
      discoveryDisabled: true,
      libraryOnlyMode: true,
      tmdbEnabled: false,
      showTrendingRows: false,
      showTraktRows: false,
      includeTmdbInSearch: false,
    });
  }
  return saveSettings({ discoveryDisabled: false, libraryOnlyMode: false });
}
