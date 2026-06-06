/**
 * TechnicalChips — Chip badges for media technical metadata.
 *
 * Validates: Requirements 10.1–10.4 · Design §10
 */

export interface TechnicalChipsProps {
  resolution?: string;
  bitrate?: number; // in kbps
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: string;
  hdr?: string;
}

/**
 * Pure helper: build an array of formatted chip strings from present fields.
 * Skips undefined/empty fields. Returns the array (may be empty).
 */
function buildChips(props: TechnicalChipsProps): string[] {
  const chips: string[] = [];

  if (props.resolution) {
    chips.push(props.resolution);
  }

  if (props.bitrate != null && props.bitrate > 0) {
    chips.push(`${(props.bitrate / 1000).toFixed(1)} Mbps`);
  }

  if (props.videoCodec) {
    chips.push(props.videoCodec.toUpperCase());
  }

  if (props.audioCodec) {
    const audio = props.audioChannels
      ? `${props.audioCodec.toUpperCase()} ${props.audioChannels}`
      : props.audioCodec.toUpperCase();
    chips.push(audio.trim());
  }

  if (props.hdr) {
    chips.push(props.hdr);
  }

  return chips;
}

export function TechnicalChips(props: TechnicalChipsProps) {
  const chips = buildChips(props);

  if (chips.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {chips.map((chip) => (
        <span
          key={chip}
          style={{
            display: "inline-block",
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
