import {
  useFocusable,
  FocusContext,
} from "@noriginmedia/norigin-spatial-navigation";
import type { SearchResult } from "../types";
import { scrollFocusedIntoView } from "../utils/tvScroll";

interface SearchResultsProps {
  results: SearchResult[];
  onSelect: (result: SearchResult) => void;
  loading?: boolean;
  title?: string;
  variant?: "grid" | "trending";
}

export function SearchResults({
  results,
  onSelect,
  loading,
  title,
  variant = "grid",
}: SearchResultsProps) {
  const { ref, focusKey } = useFocusable();

  if (loading) {
    return <div className="loading">Searching...</div>;
  }

  if (results.length === 0) return null;

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="search-results-section">
        {title && (
          <h2 className="row-title" style={{ padding: "0 80px" }}>
            {title}
          </h2>
        )}
        <div className="tv-grid" style={{ padding: "20px 80px" }}>
          {results.map((item) => (
            <ResultCard
              key={item.id}
              item={item}
              variant={variant}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </FocusContext.Provider>
  );
}

function ResultCard({
  item,
  variant,
  onSelect,
}: {
  item: SearchResult;
  variant: "grid" | "trending";
  onSelect: (result: SearchResult) => void;
}) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onSelect(item),
    onFocus: () => {
      scrollFocusedIntoView(ref.current as HTMLElement | null);
    },
  });

  const isTrending = variant === "trending";
  const cardClass = isTrending ? "trending-card" : "search-result-card";

  return (
    <button
      ref={ref}
      className={`${cardClass}${focused ? " spatial-focused" : ""}`}
      onClick={() => onSelect(item)}
    >
      {item.image && (
        <img
          src={item.image}
          alt={item.title}
          className={isTrending ? "trending-img" : "card-img"}
        />
      )}
      <div className={isTrending ? "trending-info" : "search-result-info"}>
        <span className={isTrending ? "trending-title" : "search-result-title"}>
          {item.title}
        </span>
        <span className={isTrending ? "trending-meta" : "search-result-meta"}>
          {item.year}
          {!isTrending && !item.available && " · TMDB"}
          {isTrending && ` · ${item.type === "movie" ? "Movie" : "TV Show"}`}
        </span>
      </div>
      {!isTrending && item.available && (
        <span className="availability-badge available">In Library</span>
      )}
    </button>
  );
}
