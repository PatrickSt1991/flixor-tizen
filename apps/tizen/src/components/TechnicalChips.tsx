/**
 * TechnicalChips — Chip badges for media technical metadata.
 *
 * Validates: Requirements 10.1–10.4 · Design §10
 */

import { buildChips } from "../utils/technicalChipsUtils";
import type { TechnicalChipsProps } from "../utils/technicalChipsUtils";

export type { TechnicalChipsProps } from "../utils/technicalChipsUtils";

export function TechnicalChips(props: TechnicalChipsProps) {
  const chips = buildChips(props);

  if (chips.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", margin: "0 -6px -6px 0" }}>
      {chips.map((chip) => (
        <span
          key={chip}
          style={{
            display: "inline-block",
            margin: "0 6px 6px 0",
            padding: "8px 18px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.85)",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.05em",
            whiteSpace: "nowrap",
          }}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}
