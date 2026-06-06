import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { SmartImage } from "./SmartImage";
import { getProgressDisplay, formatDuration } from "../utils/episodeCardUtils";

export interface EpisodeLandscapeCardProps {
  episodeNumber: number;
  title: string;
  overview?: string;
  thumbnailUrl?: string;
  duration?: number; // in minutes
  progress?: number; // 0-100
  onPress?: () => void;
}

export function EpisodeLandscapeCard({
  episodeNumber,
  title,
  overview,
  thumbnailUrl,
  duration,
  progress,
  onPress,
}: EpisodeLandscapeCardProps) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onPress?.(),
  });

  const display = getProgressDisplay(progress ?? 0);

  return (
    <button
      ref={ref}
      className={`elc${focused ? " spatial-focused" : ""}`}
      style={{
        position: "relative",
        width: 300,
        height: 187.5, /* 16/10 of 300 — aspect-ratio is Chrome 88+ */
        flexShrink: 0,
        borderRadius: 12,
        overflow: "hidden",
        background: "#222",
        border: focused ? "3px solid #ff4b2b" : "3px solid transparent",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        transform: focused ? "scale(1.05)" : "scale(1)",
        outline: "none",
      }}
      tabIndex={0}
      onClick={() => onPress?.()}
    >
      {/* Thumbnail */}
      {thumbnailUrl ? (
        <div style={{ position: "absolute", inset: 0 }}>
          <SmartImage
            src={thumbnailUrl}
            alt={title}
            width="100%"
            height="100%"
          />
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#333",
          }}
        />
      )}

      {/* Gradient overlay for text readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)",
        }}
      />

      {/* Episode number badge (top-left) */}
      <span
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          background: "rgba(0,0,0,0.7)",
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          padding: "3px 8px",
          borderRadius: 6,
        }}
      >
        Episode {episodeNumber}
      </span>

      {/* Checkmark (top-right) when ≥85% */}
      {display === "checkmark" && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#000"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Content overlay (bottom) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 10,
        }}
      >
        {/* Title (single line, truncated) */}
        <div
          style={{
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: 2,
          }}
        >
          {title}
        </div>

        {/* Overview (2 lines max) */}
        {overview && (
          <p
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: 12,
              lineHeight: 1.4,
              margin: "2px 0",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {overview}
          </p>
        )}

        {/* Duration */}
        {duration != null && duration > 0 && (
          <div
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 12,
              marginTop: 4,
            }}
          >
            {formatDuration(duration)}
          </div>
        )}
      </div>

      {/* Progress bar (1–84%) */}
      {display === "bar" && (
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
  );
}
