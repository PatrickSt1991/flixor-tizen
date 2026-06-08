import type { PlexMediaItem } from "@flixor/core";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { SmartImage } from "./SmartImage";
import { flixor } from "../services/flixor";
import { scrollFocusedIntoView } from "../utils/tvScroll";

export function LandscapeCard({
  item,
  onClick,
  onFocus,
}: {
  item: PlexMediaItem;
  onClick: () => void;
  onFocus?: () => void;
}) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onClick(),
    onFocus: () => {
      scrollFocusedIntoView(ref.current as HTMLElement | null);
      onFocus?.();
    },
  });

  const thumb = item.thumb || item.art;
  const imgSrc = thumb ? flixor.plexServer.getImageUrl(thumb, 400) : "";
  const meta = [item.year, item.contentRating].filter(Boolean).join(" · ");

  return (
    <div className="tv-card-container landscape">
      <button
        ref={ref}
        className={`tv-card landscape${focused ? " spatial-focused" : ""}`}
        tabIndex={0}
        onClick={onClick}
      >
        <SmartImage src={imgSrc} alt={item.title} className="card-img-smart" />
        <div className="landscape-overlay">
          <span className="landscape-title">{item.title}</span>
          {meta && <span className="landscape-meta">{meta}</span>}
        </div>
      </button>
    </div>
  );
}
