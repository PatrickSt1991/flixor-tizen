import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  useFocusable,
  FocusContext,
} from "@noriginmedia/norigin-spatial-navigation";
import { MediaCard } from "./MediaCard";
import { scrollFocusedIntoView } from "../utils/tvScroll";
import type { PlexMediaItem } from "@flixor/core";

type CardVariant = "landscape" | "poster" | "continue";

interface ContentRowProps {
  title: string;
  items: PlexMediaItem[];
  variant?: CardVariant;
  seeAllLink?: string;
  onItemClick: (item: PlexMediaItem) => void;
  onItemFocus?: (item: PlexMediaItem) => void;
}

function FocusableCard({
  item,
  variant,
  onItemClick,
  onItemFocus,
}: {
  item: PlexMediaItem;
  variant: CardVariant;
  onItemClick: (item: PlexMediaItem) => void;
  onItemFocus?: (item: PlexMediaItem) => void;
}) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onItemClick(item),
    onFocus: () => {
      onItemFocus?.(item);
      scrollFocusedIntoView(ref.current as HTMLElement | null);
    },
  });

  return (
    <div
      ref={ref}
      className={`focusable-card-wrapper${focused ? " focused" : ""}`}
    >
      <MediaCard
        item={item}
        variant={variant}
        onClick={() => onItemClick(item)}
        onFocus={() => onItemFocus?.(item)}
      />
    </div>
  );
}

export function ContentRow({
  title,
  items,
  variant = "poster",
  seeAllLink,
  onItemClick,
  onItemFocus,
}: ContentRowProps) {
  const navigate = useNavigate();

  const { ref, focusKey } = useFocusable({
    trackChildren: true,
    // Left/right stay inside this row; at the row's ends nothing happens.
    // Up/down pass through to the neighboring sections.
    isFocusBoundary: true,
    focusBoundaryDirections: ["left", "right"],
  });

  const handleSeeAll = useCallback(() => {
    if (seeAllLink) navigate(seeAllLink);
  }, [seeAllLink, navigate]);

  if (items.length === 0) return null;

  return (
    <FocusContext.Provider value={focusKey}>
      <section ref={ref} className="tv-row-section">
        <div className="content-row-header">
          <h2 className="row-title">{title}</h2>
          {seeAllLink && (
            <button className="see-all-btn" onClick={handleSeeAll}>
              See All ›
            </button>
          )}
        </div>
        <div className="tv-row content-row-scroll">
          {items.map((item) => (
            <FocusableCard
              key={item.ratingKey}
              item={item}
              variant={variant}
              onItemClick={onItemClick}
              onItemFocus={onItemFocus}
            />
          ))}
        </div>
      </section>
    </FocusContext.Provider>
  );
}
