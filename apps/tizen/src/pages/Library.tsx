import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useFocusable,
  FocusContext,
  setFocus,
} from "@noriginmedia/norigin-spatial-navigation";
import { flixor } from "../services/flixor";
import { loadSettings } from "../services/settings";

/** Search field that only opens the on-screen keyboard when the user
 *  presses OK on it. A bare <input autoFocus> kept NATIVE focus while
 *  spatial focus was on a card — OK anywhere opened the Samsung IME. */
function LibrarySearchInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { ref, focused } = useFocusable({
    onEnterPress: () => inputRef.current?.focus(),
  });

  // Leaving the field with the D-pad must close the IME / drop native focus
  useEffect(() => {
    if (!focused) inputRef.current?.blur();
  }, [focused]);

  return (
    <div ref={ref}>
      <input
        ref={inputRef}
        type="text"
        className={`search-input library-search${focused ? " spatial-focused" : ""}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
import type { PlexMediaItem } from "@flixor/core";
import { TopNav } from "../components/TopNav";
import { PosterCard } from "../components/PosterCard";
import { FilterBar, type FilterOption } from "../components/FilterBar";
import { SkeletonRow } from "../components/SkeletonRow";
import { VirtualGrid, type VirtualGridItem } from "../components/VirtualGrid";
import { SectionBanner } from "../components/SectionBanner";

const PAGE_SIZE = 50;

export function LibraryPage() {
  const { type } = useParams<{ type: string }>();
  const [allItems, setAllItems] = useState<PlexMediaItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<PlexMediaItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [genres, setGenres] = useState<{ key: string; title: string }[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const libKeyRef = useRef<string | null>(null);
  const navigate = useNavigate();

  const {
    ref: pageRef,
    focusKey: pageFocusKey,
  } = useFocusable({
    focusKey: "library-page",
    trackChildren: true,
  });

  // Focus the GRID once content loads — NOT the page container. Focusing the
  // page delegated to its first child (the top nav), so returning from a
  // details page landed on the nav's Home button instead of a poster.
  // setFocus on the grid delegates to its first card.
  useEffect(() => {
    if (!loading && filteredItems.length > 0) {
      const timer = setTimeout(() => setFocus("library-grid"), 100);
      return () => clearTimeout(timer);
    }
  }, [loading, filteredItems.length]);

  useEffect(() => {
    const loadLibrary = async () => {
      setLoading(true);
      setSearchQuery("");
      setSelectedGenre(null);
      setAllItems([]);
      setFilteredItems([]);
      setHasMore(true);
      try {
        const libs = await flixor.plexServer.getLibraries();
        const settings = loadSettings();
        const disabledKeys = settings.catalogDisabledLibraries || [];
        const enabledLibs = libs.filter((l) => !disabledKeys.includes(l.key));
        const targetLib = enabledLibs.find((l) => l.type === type);
        if (targetLib) {
          libKeyRef.current = targetLib.key;
          const [content, genreList] = await Promise.all([
            flixor.plexServer.getLibraryItems(targetLib.key, {
              sort: "addedAt:desc",
              offset: 0,
              limit: PAGE_SIZE,
            }),
            flixor.plexServer.getGenres(targetLib.key),
          ]);
          setAllItems(content);
          setFilteredItems(content);
          setGenres(genreList);
          setHasMore(content.length >= PAGE_SIZE);
        }
      } catch (err) {
        console.error("Failed to load library:", err);
      } finally {
        setLoading(false);
      }
    };
    loadLibrary();
  }, [type]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !libKeyRef.current) return;
    setLoadingMore(true);
    try {
      const next = await flixor.plexServer.getLibraryItems(libKeyRef.current, {
        sort: "addedAt:desc",
        offset: allItems.length,
        limit: PAGE_SIZE,
      });
      if (next.length < PAGE_SIZE) setHasMore(false);
      setAllItems((prev) => [...prev, ...next]);
    } catch (err) {
      console.error("Failed to load more:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, allItems.length]);

  useEffect(() => {
    let result = allItems;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => item.title.toLowerCase().includes(q));
    }
    if (selectedGenre) {
      result = result.filter((item) => {
        return item.Genre?.some((g) => g.tag === selectedGenre);
      });
    }
    setFilteredItems(result);
  }, [searchQuery, selectedGenre, allItems]);

  const genreFilterOptions: FilterOption[] = genres.map((g) => ({
    id: g.title,
    label: g.title,
  }));

  type LibraryGridItem = VirtualGridItem & { _item: PlexMediaItem };

  const gridItems: LibraryGridItem[] = filteredItems.map((item) => ({
    id: item.ratingKey,
    _item: item,
  }));

  const isFiltering = !!(searchQuery || selectedGenre);

  const renderCard = useCallback(
    (gridItem: LibraryGridItem) => (
      <PosterCard
        item={gridItem._item}
        onClick={() => navigate(`/details/${gridItem._item.ratingKey}`)}
      />
    ),
    [navigate],
  );

  return (
    <FocusContext.Provider value={pageFocusKey}>
      <div ref={pageRef} className="tv-container pt-nav">
        <TopNav />
        <h1 className="library-title" style={{ margin: "20px 80px 0" }}>
          {type === "movie" ? "Movies" : "TV Shows"}
        </h1>

        <div className="library-filters">
          <LibrarySearchInput
            placeholder={`Search ${type === "movie" ? "movies" : "shows"}...`}
            value={searchQuery}
            onChange={setSearchQuery}
          />
          {genreFilterOptions.length > 0 && (
            <FilterBar
              options={genreFilterOptions}
              activeId={selectedGenre}
              onSelect={setSelectedGenre}
            />
          )}
        </div>

        {loading ? (
          <div style={{ padding: "0 80px" }}>
            <SkeletonRow count={6} variant="poster" />
            <SkeletonRow count={6} variant="poster" />
          </div>
        ) : !flixor.isPlexAuthenticated ? (
          <div style={{ padding: "0 80px" }}>
            <SectionBanner
              title="Connect Your Plex Server"
              message="Link your Plex account to browse your library."
              cta="Go to Settings"
              to="/settings"
            />
          </div>
        ) : filteredItems.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px",
              color: "rgba(255,255,255,0.4)",
              fontSize: "24px",
            }}
          >
            No results found
          </div>
        ) : (
          <div style={{ padding: "0 80px 100px", width: "100%", flex: 1 }}>
            <VirtualGrid<LibraryGridItem>
              items={gridItems}
              render={renderCard}
              hasMore={!isFiltering && hasMore}
              loadMore={!isFiltering ? loadMore : undefined}
              focusKey="library-grid"
            />
          </div>
        )}
      </div>
    </FocusContext.Provider>
  );
}
