/**
 * Pure helpers for TechnicalChips — kept out of the component file so they
 * can be exported for tests without tripping react-refresh/only-export-components.
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
export function buildChips(props: TechnicalChipsProps): string[] {
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
