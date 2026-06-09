/**
 * AccessibilityBadges — Image-based CC, SDH, AD badges.
 *
 * Renders badge images for Closed Captions, SDH subtitles, and Audio Description
 * when detected. Returns null when none are present.
 *
 * Validates: Requirements 14.4, 14.5 · Design §14
 */

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
          src="/badges/cc.png"
          alt="CC"
          style={{ height: 20, width: "auto", objectFit: "contain" }}
          loading="lazy"
        />
      )}
      {hasSDH && (
        <img
          src="/badges/sdh.png"
          alt="SDH"
          style={{ height: 20, width: "auto", objectFit: "contain" }}
          loading="lazy"
        />
      )}
      {hasAD && (
        <img
          src="/badges/ad.png"
          alt="AD"
          style={{ height: 20, width: "auto", objectFit: "contain" }}
          loading="lazy"
        />
      )}
    </div>
  );
}
