/**
 * AccessibilityBadges — Image-based CC, SDH, AD badges.
 *
 * Renders badge images for Closed Captions, SDH subtitles, and Audio Description
 * when detected. Returns null when none are present.
 *
 * Validates: Requirements 14.4, 14.5 · Design §14
 */

// Relative to the document (BASE_URL = "./"), NOT root-absolute: "/badges/..."
// resolves to file:///badges/... on the TV's local scheme and fails to load.
const BADGES = `${import.meta.env.BASE_URL}badges`;

export interface AccessibilityBadgesProps {
  hasCC?: boolean;
  hasSDH?: boolean;
  hasAD?: boolean;
}

export function AccessibilityBadges({ hasCC, hasSDH, hasAD }: AccessibilityBadgesProps) {
  if (!hasCC && !hasSDH && !hasAD) return null;

  return (
    <div style={{ display: "grid", gridAutoFlow: "column", justifyContent: "start", alignItems: "center", gridGap: 6 }}>
      {hasCC && (
        <img
          src={`${BADGES}/cc.png`}
          alt="CC"
          style={{ height: 20, width: "auto", objectFit: "contain" }}
          loading="lazy"
        />
      )}
      {hasSDH && (
        <img
          src={`${BADGES}/sdh.png`}
          alt="SDH"
          style={{ height: 20, width: "auto", objectFit: "contain" }}
          loading="lazy"
        />
      )}
      {hasAD && (
        <img
          src={`${BADGES}/ad.png`}
          alt="AD"
          style={{ height: 20, width: "auto", objectFit: "contain" }}
          loading="lazy"
        />
      )}
    </div>
  );
}
