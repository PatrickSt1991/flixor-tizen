/**
 * Billboard — Full-width hero display for featured content.
 *
 * Validates: Requirements 11.1–11.4 · Design §11
 */

import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import ContentRatingBadge from "./ContentRatingBadge";
import { SmartImage } from "./SmartImage";

export interface BillboardProps {
  title: string;
  backdropUrl?: string;
  overview?: string;
  contentRating?: string;
  onPlay?: () => void;
}

export function Billboard({
  title,
  backdropUrl,
  overview,
  contentRating,
  onPlay,
}: BillboardProps) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onPlay?.(),
  });

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "50vh",
        overflow: "hidden",
        background: "#111",
      }}
    >
      {/* Backdrop image */}
      {backdropUrl ? (
        <div style={{ position: "absolute", inset: 0 }}>
          <SmartImage
            src={backdropUrl}
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
            background: "#222",
          }}
        />
      )}

      {/* Gradient overlay: transparent top → opaque dark bottom */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.95) 100%)",
        }}
      />

      {/* Content overlay (bottom-left) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "24px 32px",
          display: "grid",
          gridGap: 10,
        }}
      >
        {/* Title */}
        <h1
          style={{
            color: "#fff",
            fontSize: 28,
            fontWeight: 700,
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </h1>

        {/* Overview (2 lines max) */}
        {overview && (
          <p
            style={{
              color: "rgba(255,255,255,0.75)",
              fontSize: 14,
              lineHeight: 1.5,
              margin: 0,
              maxWidth: 600,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {overview}
          </p>
        )}

        {/* Play button + content rating badge */}
        <div style={{ display: "grid", gridAutoFlow: "column", justifyContent: "start", alignItems: "center", gridGap: 12 }}>
          <button
            ref={ref}
            onClick={() => onPlay?.()}
            style={{
              display: "inline-grid",
              gridAutoFlow: "column",
              alignItems: "center",
              gridGap: 8,
              padding: "10px 24px",
              borderRadius: 8,
              border: focused
                ? "3px solid #ff4b2b"
                : "3px solid transparent",
              background: "#fff",
              color: "#000",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              outline: "none",
              transition: "all 0.2s ease",
              transform: focused ? "scale(1.05)" : "scale(1)",
            }}
            tabIndex={0}
          >
            ▶ Play
          </button>

          {contentRating && (
            <ContentRatingBadge rating={contentRating} size="md" />
          )}
        </div>
      </div>
    </div>
  );
}
