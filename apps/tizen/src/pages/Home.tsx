import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  useFocusable,
  FocusContext,
  setFocus,
} from "@noriginmedia/norigin-spatial-navigation";
import { flixor } from "../services/flixor";
import { loadSettings } from "../services/settings";
import * as tmdbService from "../services/tmdb";
import { getWatchlist as getPlexWatchlist } from "../services/plextv";
import type { PlexMediaItem, TMDBMedia } from "@flixor/core";
import { TopNav } from "../components/TopNav";
import { HeroCarousel } from "../components/HeroCarousel";
import { HomeHero } from "../components/HomeHero";
import { ContentRow } from "../components/ContentRow";
import { ContinueWatchingLandscapeCard } from "../components/ContinueWatchingLandscapeCard";
import { ContinueWatchingPosterCard } from "../components/ContinueWatchingPosterCard";
import { TraktSection } from "../components/TraktSection";
import { SkeletonRow } from "../components/SkeletonRow";
import { SmartImage } from "../components/SmartImage";
import { Billboard } from "../components/Billboard";
import { UltraBlurBackground } from "../components/UltraBlurBackground";
import { SectionBanner } from "../components/SectionBanner";
import {
  extractUltraBlurColors,
  type UltraBlurColors,
} from "../services/colorExtractor";
import type { RowData } from "../types";

/** Hero item extended with optional trailer info */
export type HeroItem = PlexMediaItem & {
  videoUrl?: string; // Direct Plex trailer URL (from Extras.Metadata)
  ytKey?: string; // YouTube trailer key (from TMDB videos)
};

export function Home() {
  const [heroItems, setHeroItems] = useState<HeroItem[]>([]);
  const [rows, setRows] = useState<RowData[]>([]);
  const [continueWatchingItems, setContinueWatchingItems] = useState<
    PlexMediaItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [activeBackdrop, setActiveBackdrop] = useState<string | null>(null);
  const [ultraBlurColors, setUltraBlurColors] =
    useState<UltraBlurColors | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { ref: pageRef, focusKey: pageFocusKey } = useFocusable({
    focusKey: "home-page",
    trackChildren: true,
    isFocusBoundary: false,
  });

  useEffect(() => {
    // Reset state so stale data from a previous profile doesn't linger
    setLoading(true);
    setHeroItems([]);
    setRows([]);
    setContinueWatchingItems([]);
    setActiveBackdrop(null);
    setUltraBlurColors(null);

    const fetchContinueWatching = async () => {
      const settings = loadSettings();
      if (settings.showContinueWatchingRow === false) return [];
      try {
        const result = await flixor.plexServer.getContinueWatching();
        if (result.items.length > 0) {
          setContinueWatchingItems(result.items);
          return result.items.slice(0, 5);
        }
      } catch (e) {
        console.error("Plex Continue Watching failed", e);
      }
      return [];
    };

    const fetchWatchlist = async (newRows: RowData[]) => {
      const settings = loadSettings();
      if (settings.showWatchlistRow === false) return;
      try {
        const watchlistItems = await getPlexWatchlist();
        if (watchlistItems.length > 0) {
          newRows.push({
            title: "Watchlist",
            items: watchlistItems.slice(0, 15),
            variant: "poster",
          });
        }
      } catch (e) {
        console.error("Plex.tv Watchlist failed", e);
      }
    };

    const fetchTrending = async (newRows: RowData[]) => {
      const settings = loadSettings();
      if (settings.showTrendingRows === false) return [];
      const candidates: PlexMediaItem[] = [];
      try {
        const trendingResult = await tmdbService.getTrending("movie", "week");
        if (trendingResult.results.length > 0) {
          const trendingItems: PlexMediaItem[] = trendingResult.results
            .slice(0, 15)
            .map(
              (m: TMDBMedia) =>
                ({
                  ratingKey: `tmdb-movie-${m.id}`,
                  key: `tmdb-movie-${m.id}`,
                  type: "movie",
                  title: (m.title || m.name) as string,
                  thumb: tmdbService.buildImageUrl(m.poster_path, "poster"),
                  art: tmdbService.buildImageUrl(m.backdrop_path, "backdrop"),
                  year: Number(
                    ((m.release_date || "") as string).split("-")[0],
                  ),
                  summary: m.overview as string,
                  duration: 0,
                  guid: `tmdb://${m.id}`,
                }) as PlexMediaItem,
            );
          newRows.push({
            title: "Popular Movies",
            items: trendingItems,
            variant: "poster",
          });
          candidates.push(...trendingItems.slice(0, 5));
        }

        const trendingTV = await tmdbService.getTrending("tv", "week");
        if (trendingTV.results.length > 0) {
          const tvItems: PlexMediaItem[] = trendingTV.results.slice(0, 15).map(
            (m: TMDBMedia) =>
              ({
                ratingKey: `tmdb-tv-${m.id}`,
                key: `tmdb-tv-${m.id}`,
                type: "show",
                title: (m.name || m.title) as string,
                thumb: tmdbService.buildImageUrl(m.poster_path, "poster"),
                art: tmdbService.buildImageUrl(m.backdrop_path, "backdrop"),
                year: Number(
                  ((m.first_air_date || "") as string).split("-")[0],
                ),
                summary: m.overview as string,
                duration: 0,
                guid: `tmdb://${m.id}`,
              }) as PlexMediaItem,
          );
          newRows.push({
            title: "Trending Shows",
            items: tvItems,
            variant: "poster",
          });
          candidates.push(...tvItems.slice(0, 5));
        }
      } catch (e) {
        console.error("TMDB Trending failed", e);
      }
      return candidates;
    };

    /**
     * Resolve trailer URLs for hero items.
     * - Plex items: fetch metadata with extras, extract first trailer Part key → build direct video URL
     * - TMDB items: fetch videos, find YouTube trailer → store ytKey
     */
    const resolveHeroTrailers = async (
      items: PlexMediaItem[],
    ): Promise<HeroItem[]> => {
      const results: HeroItem[] = await Promise.all(
        items.map(async (item): Promise<HeroItem> => {
          const heroItem: HeroItem = { ...item };
          try {
            const rk = item.ratingKey || "";

            // TMDB items have ratingKeys like "tmdb-movie-123" or "tmdb-tv-456"
            const tmdbMatch = rk.match(/^tmdb-(movie|tv)-(\d+)$/);
            if (tmdbMatch) {
              const mediaType = tmdbMatch[1] as "movie" | "tv";
              const tmdbId = Number(tmdbMatch[2]);
              const videos = await tmdbService.getVideos(tmdbId, mediaType);
              const trailer =
                (videos.results || []).find(
                  (v) => v.site === "YouTube" && v.type === "Trailer",
                ) || (videos.results || []).find((v) => v.site === "YouTube");
              if (trailer) {
                heroItem.ytKey = trailer.key;
              }
              return heroItem;
            }

            // Plex items: fetch full metadata with extras to get trailer
            if (rk && !rk.startsWith("trakt-")) {
              const metadata = await flixor.plexServer.getMetadata(rk);
              if (metadata?.Extras?.Metadata?.length) {
                // Use the first extra (typically the primary trailer)
                const trailerExtra = metadata.Extras.Metadata[0];
                const partKey = trailerExtra.Media?.[0]?.Part?.[0]?.key as
                  | string
                  | undefined;
                if (partKey) {
                  // Build direct video URL (baseUrl + partKey + token)
                  heroItem.videoUrl = flixor.plexServer.getImageUrl(partKey);
                }
              }
            }
          } catch (e) {
            console.error(
              `[Home] Trailer resolution failed for ${item.ratingKey}:`,
              e,
            );
          }
          return heroItem;
        }),
      );
      return results;
    };

    const loadContent = async () => {
      try {
        if (!flixor.isPlexAuthenticated) return;
        const settings = loadSettings();

        const newRows: RowData[] = [];
        const continueItems = await fetchContinueWatching();
        await fetchWatchlist(newRows);
        const trendingCandidates = await fetchTrending(newRows);

        const heroCandidates = [...continueItems, ...trendingCandidates];
        const heroWithTrailers = await resolveHeroTrailers(heroCandidates);
        setHeroItems(heroWithTrailers);

        const libraries = await flixor.plexServer.getLibraries();
        const movieLib = libraries.find((l) => l.type === "movie");
        const showLib = libraries.find((l) => l.type === "show");

        if (settings.showRecentlyAddedRows !== false) {
          if (movieLib) {
            const recentMovies = await flixor.plexServer.getRecentlyAdded(
              movieLib.key,
            );
            if (recentMovies.length > 0) {
              newRows.push({
                title: "Recently Added Movies",
                items: recentMovies.slice(0, 15),
                variant: "poster",
              });
            }
          }

          if (showLib) {
            const recentShows = await flixor.plexServer.getRecentlyAdded(
              showLib.key,
            );
            if (recentShows.length > 0) {
              newRows.push({
                title: "Recently Added Shows",
                items: recentShows.slice(0, 15),
                variant: "poster",
              });
            }
          }
        }

        if (settings.showCollectionsRow !== false) {
          try {
            const collections = await flixor.plexServer.getAllCollections();
            if (collections.length > 0) {
              newRows.push({
                title: "Collections",
                items: collections.slice(0, 15),
                variant: "poster",
              });
            }
          } catch (e) {
            console.error("Failed to load collections", e);
          }
        }

        // Genre-based rows from Plex libraries
        if (settings.showGenreRows !== false) {
          const genreRowDefs: {
            label: string;
            type: "movie" | "show";
            genre: string;
          }[] = [
            { label: "TV Shows - Children", type: "show", genre: "Children" },
            {
              label: "Movies - Documentary",
              type: "movie",
              genre: "Documentary",
            },
            { label: "Movies - Drama", type: "movie", genre: "Drama" },
            { label: "TV Shows - Reality", type: "show", genre: "Reality" },
            { label: "Movies - Animation", type: "movie", genre: "Animation" },
            { label: "Movies - History", type: "movie", genre: "History" },
          ];
          try {
            for (const gr of genreRowDefs) {
              const lib = libraries.find((l) => l.type === gr.type);
              if (!lib) continue;
              try {
                const genreList = await flixor.plexServer.getGenres(lib.key);
                const genreMatch = genreList.find(
                  (g) => g.title.toLowerCase() === gr.genre.toLowerCase(),
                );
                if (!genreMatch) continue;
                const genreItems = await flixor.plexServer.getItemsByGenre(
                  lib.key,
                  genreMatch.key,
                  { size: 12 },
                );
                if (genreItems.length > 0) {
                  newRows.push({
                    title: gr.label,
                    items: genreItems.slice(0, 12),
                    variant: "poster",
                  });
                }
              } catch {
                /* skip genre */
              }
            }
          } catch {
            /* skip all genre rows */
          }
        }

        setRows(newRows);
      } catch (err) {
        console.error("Failed to load content", err);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [navigate, location.key]);

  // Focus the hero carousel once content has loaded so D-PAD navigation works
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        setFocus("hero-carousel");
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const handleItemClick = useCallback(
    (item: PlexMediaItem) => navigate(`/details/${item.ratingKey}`),
    [navigate],
  );

  const handleItemFocus = useCallback((item: PlexMediaItem) => {
    const bg = flixor.plexServer.getImageUrl(item.art || item.thumb);
    if (bg) {
      setActiveBackdrop(bg);
      extractUltraBlurColors(bg).then((colors) => {
        if (colors) setUltraBlurColors(colors);
      });
    }
  }, []);

  const handleFocus = (e: React.FocusEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".hero-section")) {
      const container = document.querySelector(".tv-container");
      if (container) container.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  if (loading) {
    return (
      <FocusContext.Provider value={pageFocusKey}>
        <div ref={pageRef} className="tv-container">
          <TopNav />
          <div className="hero-section">
            <div className="skeleton-hero shimmer" style={{ height: 400 }} />
          </div>
          <SkeletonRow count={6} variant="poster" />
          <SkeletonRow count={6} variant="poster" />
          <SkeletonRow count={6} variant="poster" />
        </div>
      </FocusContext.Provider>
    );
  }

  /** Map row titles to seeAllLink paths where applicable */
  const getSeeAllLink = (title: string): string | undefined => {
    const linkMap: Record<string, string> = {
      "Popular Movies": "/browse/trending-movies",
      "Trending Shows": "/browse/trending-shows",
      "Recently Added Movies": "/browse/recently-added-movies",
      "Recently Added Shows": "/browse/recently-added-shows",
      Collections: "/browse/collections",
      Watchlist: "/browse/watchlist",
    };
    return linkMap[title];
  };

  return (
    <FocusContext.Provider value={pageFocusKey}>
      <div ref={pageRef} className="tv-container" onFocus={handleFocus}>
        {activeBackdrop ? (
          <div className="backdrop-layer">
            <SmartImage
              src={activeBackdrop}
              alt=""
              className="backdrop-layer-img"
              kind="backdrop"
              width="100%"
              height="100%"
            />
          </div>
        ) : (
          <div className="backdrop-layer" />
        )}
        <div className="backdrop-overlay-v" />
        <div className="backdrop-overlay-h" />

        {activeBackdrop && (
          <UltraBlurBackground src={activeBackdrop} colors={ultraBlurColors} />
        )}

        <TopNav />

        {!flixor.isPlexAuthenticated && (
          <SectionBanner
            title="Connect Your Plex Server"
            message="Link your Plex account to access your libraries, continue watching, and more."
            cta="Go to Settings"
            to="/settings"
          />
        )}

        {(() => {
          const settings = loadSettings();
          const layout = settings.heroLayout ?? "carousel";

          if (layout === "hidden") return null;

          if (layout === "static" && heroItems.length > 0) {
            const featured = heroItems[0];
            return (
              <HomeHero
                item={featured}
                onPlay={() => navigate(`/details/${featured.ratingKey}`)}
                onMoreInfo={() => navigate(`/details/${featured.ratingKey}`)}
              />
            );
          }

          // Default: carousel
          return (
            <HeroCarousel
              items={heroItems}
              onBackdropChange={setActiveBackdrop}
            />
          );
        })()}

        {heroItems.length > 0 &&
          (() => {
            const settings = loadSettings();
            const layout = settings.heroLayout ?? "carousel";
            // Only show Billboard when the hero carousel/static hero is hidden,
            // otherwise the same backdrop image appears twice ("repeating" effect)
            if (layout !== "hidden") return null;

            const featured = heroItems[0];
            const backdropUrl = featured.art?.startsWith("http")
              ? featured.art
              : flixor.plexServer.getImageUrl(featured.art || featured.thumb);
            return (
              <Billboard
                title={featured.title}
                backdropUrl={backdropUrl || undefined}
                overview={featured.summary}
                contentRating={featured.contentRating}
                onPlay={() => navigate(`/details/${featured.ratingKey}`)}
              />
            );
          })()}

        {continueWatchingItems.length > 0 &&
          (() => {
            const cardStyle =
              loadSettings().continueWatchingCardStyle ?? "landscape";
            const CardComponent =
              cardStyle === "poster"
                ? ContinueWatchingPosterCard
                : ContinueWatchingLandscapeCard;
            return (
              <section className="tv-row-section">
                <div className="content-row-header">
                  <h2 className="row-title">Continue Watching</h2>
                </div>
                <div className="tv-row content-row-scroll">
                  {continueWatchingItems.map((item) => (
                    <CardComponent
                      key={item.ratingKey}
                      item={item}
                      onSelect={(ratingKey) => navigate(`/player/${ratingKey}`)}
                    />
                  ))}
                </div>
              </section>
            );
          })()}

        {rows.map((row) => (
          <ContentRow
            key={row.title}
            title={row.title}
            items={row.items}
            variant={row.variant}
            seeAllLink={getSeeAllLink(row.title)}
            onItemClick={handleItemClick}
            onItemFocus={handleItemFocus}
          />
        ))}

        {loadSettings().showTraktRows !== false && (
          <>
            <TraktSection
              type="watchlist"
              mediaType="movies"
              title="Trakt Watchlist"
            />
            <TraktSection
              type="recommendations"
              mediaType="movies"
              title="Recommended for You"
            />
            <TraktSection
              type="trending"
              mediaType="movies"
              title="Trending on Trakt"
            />
          </>
        )}
      </div>
    </FocusContext.Provider>
  );
}
