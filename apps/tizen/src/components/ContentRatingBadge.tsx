/**
 * ContentRatingBadge — Pill-shaped badge with color coding by rating category.
 *
 * Color mapping:
 *   Green  → G, PG, TV-Y, TV-Y7, TV-G
 *   Yellow → PG-13, TV-PG, TV-14
 *   Red    → R, NC-17, TV-MA
 *   Gray   → NR / unknown
 *
 * Returns null for empty/undefined ratings.
 *
 * Reference: web_frontend/src/components/ContentRatingBadge.tsx
 */

import { normalizeRating } from "../utils/contentRatingUtils";

export interface ContentRatingBadgeProps {
  rating?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

type ColorSet = { bg: string; text: string; border: string };

const green: ColorSet = { bg: "rgba(22,163,74,0.2)", text: "#4ade80", border: "rgba(34,197,94,0.5)" };
const yellow: ColorSet = { bg: "rgba(202,138,4,0.2)", text: "#facc15", border: "rgba(234,179,8,0.5)" };
const orange: ColorSet = { bg: "rgba(234,88,12,0.2)", text: "#fb923c", border: "rgba(249,115,22,0.5)" };
const red: ColorSet = { bg: "rgba(220,38,38,0.2)", text: "#f87171", border: "rgba(239,68,68,0.5)" };
const darkRed: ColorSet = { bg: "rgba(153,27,27,0.2)", text: "#fca5a5", border: "rgba(220,38,38,0.5)" };
const gray: ColorSet = { bg: "rgba(82,82,82,0.2)", text: "#a3a3a3", border: "rgba(115,115,115,0.5)" };

const ratingColors: Record<string, ColorSet> = {
  G: green,
  PG: yellow,
  "PG-13": orange,
  R: red,
  "NC-17": darkRed,
  NR: gray,
  "TV-Y": green,
  "TV-Y7": green,
  "TV-G": green,
  "TV-PG": yellow,
  "TV-14": orange,
  "TV-MA": red,
};

/** Image-based rating types that have PNG assets in /badges/ */
type ImageRatingType = "g" | "pg" | "pg13" | "r" | "tvg" | "tvpg" | "tv14" | "tvma" | "unrated";

const ratingImageMap: Record<string, ImageRatingType> = {
  G: "g",
  PG: "pg",
  "PG-13": "pg13",
  R: "r",
  "TV-G": "tvg",
  "TV-PG": "tvpg",
  "TV-14": "tv14",
  "TV-MA": "tvma",
  NR: "unrated",
  UNRATED: "unrated",
};

const sizeHeight: Record<string, number> = { sm: 14, md: 22, lg: 28 };
const textSize: Record<string, { fontSize: number; px: number; py: number }> = {
  sm: { fontSize: 9, px: 4, py: 1 },
  md: { fontSize: 12, px: 8, py: 3 },
  lg: { fontSize: 14, px: 10, py: 4 },
};

export default function ContentRatingBadge({
  rating,
  size = "md",
  className = "",
}: ContentRatingBadgeProps) {
  if (!rating) return null;

  const normalized = normalizeRating(rating);
  const imageType = ratingImageMap[normalized];

  // Prefer image badge when asset exists
  if (imageType) {
    return (
      <img
        // Relative to the document (BASE_URL = "./"), NOT root-absolute:
        // "/badges/..." resolves to file:///badges/... on the TV's local
        // scheme and fails to load. import.meta.env.BASE_URL keeps it relative.
        src={`${import.meta.env.BASE_URL}badges/${imageType}.png`}
        alt={normalized}
        className={className}
        style={{ height: sizeHeight[size], width: "auto", objectFit: "contain" }}
        loading="lazy"
      />
    );
  }

  // Fallback: colored text pill
  const colors = ratingColors[normalized] || gray;
  const ts = textSize[size];

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        letterSpacing: "0.04em",
        borderRadius: 4,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.text,
        fontSize: ts.fontSize,
        padding: `${ts.py}px ${ts.px}px`,
      }}
    >
      {normalized}
    </span>
  );
}

/** Text-only variant (no image, no pill background). */
export function ContentRatingText({
  rating,
  className = "",
}: Pick<ContentRatingBadgeProps, "rating" | "className">) {
  if (!rating) return null;

  const normalized = normalizeRating(rating);
  const colors = ratingColors[normalized] || gray;

  return (
    <span className={className} style={{ fontWeight: 500, color: colors.text }}>
      {normalized}
    </span>
  );
}
