import type { PlexMediaItem } from "@flixor/core";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { SmartImage } from "./SmartImage";
import { scrollFocusedIntoView } from "../utils/tvScroll";
import { flixor } from "../services/flixor";
import { formatResumeLabel } from "../utils/media";

export interface ContinueWatchingLandscapeCardProps {
  item: PlexMediaItem;
  onSelect: (ratingKey: string) => void;
}

function formatEpisodeInfo(item: PlexMediaItem): string | null {
  if (item.type !== "episode" || !item.parentIndex || !item.index) return null;
  return `S${String(item.parentIndex).padStart(2, "0")}E${String(item.index).padStart(2, "0")}`;
}

export function ContinueWatchingLandscapeCard({
  item,
  onSelect,
}: ContinueWatchingLandscapeCardProps) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onSelect(item.ratingKey),
    onFocus: () => {
      scrollFocusedIntoView(ref.current as HTMLElement | null);
    },
  });

  const thumb = item.thumb || item.art;
  const imgSrc = thumb ? flixor.plexServer.getImageUrl(thumb, 400) : "";

  const progress =
    item.viewOffset && item.duration
      ? Math.min(100, Math.round((item.viewOffset / item.duration) * 100))
      : 0;

  const resumeLabel =
    item.viewOffset && item.duration
      ? formatResumeLabel(item.viewOffset, item.duration)
      : null;

  const episodeInfo = formatEpisodeInfo(item);
  const showTitle = item.type === "episode" ? item.grandparentTitle : null;

  return (
    <div className="tv-card-container landscape">
      <button
        ref={ref}
        className={`tv-card landscape${focused ? " spatial-focused" : ""}`}
        style={{
          position: "relative",
          overflow: "hidden",
          border: focused ? "3px solid #ff4b2b" : "3px solid transparent",
          transition: "all 0.2s ease",
          transform: focused ? "scale(1.05)" : "scale(1)",
        }}
        tabIndex={0}
        onClick={() => onSelect(item.ratingKey)}
      >
        <SmartImage src={imgSrc} alt={item.title} className="card-img-smart" />

        {/* Bottom gradient */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "60%",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Episode badge (top-left) */}
        {episodeInfo && (
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 6,
            }}
          >
            {episodeInfo}
          </span>
        )}

        {/* Info overlay (bottom) */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "8px 10px",
            pointerEvents: "none",
          }}
        >
          {showTitle && (
            <div
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 11,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {showTitle}
            </div>
          )}
          <div
            style={{
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.title}
          </div>
          {resumeLabel && (
            <div
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 11,
                marginTop: 2,
              }}
            >
              {resumeLabel}
            </div>
          )}
        </div>

        {/* Progress bar */}
        {progress > 0 && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 3,
              background: "rgba(255,255,255,0.3)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "#e50914",
              }}
            />
          </div>
        )}
      </button>
    </div>
  );
}
