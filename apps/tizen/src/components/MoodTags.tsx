/**
 * MoodTags — Deterministic genre-to-mood pill badges.
 *
 * Validates: Requirements 8.1–8.4 · Design §8
 */

import { deriveMoods } from "../utils/moodTagsUtils";

export interface MoodTagsProps {
  genres: string[];
}

export function MoodTags({ genres }: MoodTagsProps) {
  const moods = deriveMoods(genres);

  if (moods.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", margin: "0 -6px -6px 0" }}>
      {moods.map((mood) => (
        <span
          key={mood}
          style={{
            display: "inline-block",
            margin: "0 6px 6px 0",
            padding: "4px 12px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.85)",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          {mood}
        </span>
      ))}
    </div>
  );
}
