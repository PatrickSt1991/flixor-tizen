/** Number of placeholder elements rendered per skeleton item. */
export const PLACEHOLDER_COUNT = 4;

export interface EpisodeSkeletonListProps {
  count?: number; // default 6
}

/**
 * Shimmer-animated skeleton placeholders for episode rows.
 * Displayed while episode data is loading on the Details page.
 *
 * Each row mirrors a simplified EpisodeLandscapeCard layout:
 * episode number · thumbnail · title · overview
 */
export function EpisodeSkeletonList({ count = 6 }: EpisodeSkeletonListProps) {
  if (count <= 0) return null;

  return (
    <div style={{ marginTop: 16, display: "grid", gridGap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "32px 176px 1fr",
            gridGap: 16,
            alignItems: "start",
            padding: "8px 0",
          }}
        >
          {/* Episode number placeholder */}
          <div
            className="skeleton"
            style={{
              width: 32,
              height: 24,
              borderRadius: 4,
              flexShrink: 0,
            }}
          />

          {/* Thumbnail placeholder (16:10 ≈ 176×110, design says 176×96) */}
          <div
            className="skeleton"
            style={{
              width: 176,
              height: 96,
              borderRadius: 12,
              flexShrink: 0,
            }}
          />

          {/* Title + overview placeholders */}
          <div style={{ display: "grid", gridGap: 8, alignContent: "start" }}>
            <div
              className="skeleton"
              style={{ height: 16, width: "40%", borderRadius: 4 }}
            />
            <div
              className="skeleton"
              style={{ height: 12, width: "80%", borderRadius: 4 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
